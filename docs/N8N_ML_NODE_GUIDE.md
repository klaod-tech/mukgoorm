# n8n ML 노드 수정 가이드

> 대상: n8n 워크플로우 담당 팀원
> 목적: Softmax 기반 선호도 학습 시스템을 n8n에 연결하는 방법

---

## 사전 준비

Supabase에 아래 테이블이 먼저 생성되어 있어야 합니다.
`supabase/schemaV2.sql` 파일을 SQL Editor에서 실행하세요.

---

## 수정 1 — `/webhook/feedback` 에 로짓 업데이트 노드 추가

### 위치
`AI 비서 v3.json` → `피드백 입력` 웹훅 → `음식 피드백` Supabase 노드 뒤

### 추가할 노드 순서
```
피드백 입력 → 음식 피드백(기존) → [신규: 로짓 조회] → [신규: 로짓 업데이트] → Respond to Webhook
```

### 신규 노드 1 — 로짓 조회 (Supabase 노드)
- **Type**: Supabase
- **Operation**: Get Many
- **Table**: `user_preference_logits`
- **Filter**: `user_id` eq `{{ $('피드백 입력').item.json.body.user_id }}`
  AND `category` eq `{{ $('피드백 입력').item.json.body.category }}`

### 신규 노드 2 — 로짓 업데이트 (Code 노드)
```javascript
const body = $('피드백 입력').item.json.body
const feedback = body.feedback        // 'like' | 'dislike'
const userId = body.user_id
const category = body.category

const ALPHA = 0.2
const delta = feedback === 'like' ? ALPHA : -ALPHA

// 현재 로짓 가져오기 (없으면 0)
const rows = $input.all()
const currentLogit = rows.length > 0 ? (rows[0].json.logit ?? 0) : 0
const newLogit = currentLogit + delta

return [{
  json: {
    user_id: userId,
    category: category,
    logit: newLogit,
    sample_count_increment: 1,
  }
}]
```

### 신규 노드 3 — Supabase Upsert
- **Type**: Supabase
- **Operation**: Upsert
- **Table**: `user_preference_logits`
- **Fields**:
  - `user_id`: `{{ $json.user_id }}`
  - `category`: `{{ $json.category }}`
  - `logit`: `{{ $json.logit }}`
  - `updated_at`: `{{ new Date().toISOString() }}`
- **On Conflict**: `user_id, category`

---

## 수정 2 — `취향 정리` 노드를 Softmax 정렬로 교체

### 위치
`AI 비서 v3.json` → 음식 추천 흐름 → `취향 정리` 노드

### 노드 추가 순서
```
유저 정보1 → [신규: 로짓 전체 조회] → 취향 정리(수정) → 식당1 → ...
```

### 신규 노드 — 로짓 전체 조회 (Supabase 노드)
- **Type**: Supabase
- **Operation**: Get Many
- **Table**: `user_preference_logits`
- **Filter**: `user_id` eq `{{ $('음식 추천 입력').item.json.body.user_id }}`

### `취향 정리` 노드 코드 교체
기존 코드를 아래로 완전히 교체하세요:

```javascript
const TEMPERATURE = 1.5
const EPSILON     = 0.10
const GAMMA       = 0.95
const K           = 7

const CONTEXT_BONUS = {
  weather: {
    '비':   { '한식': 0.15, '일식': 0.10 },
    '눈':   { '한식': 0.20 },
    '맑음': { '양식': 0.05, '디저트': 0.10 },
    '흐림': { '중식': 0.05 },
  },
  meal_type: {
    '아침': { '디저트': 0.10, '양식': 0.05 },
    '점심': { '한식': 0.05, '분식': 0.05 },
    '저녁': { '한식': 0.10, '중식': 0.05 },
    '야식': { '분식': 0.15, '중식': 0.10 },
  }
}

// ① 시간 감쇠 적용 로짓
const today = new Date()
const logitRows = $('로짓 전체 조회').all()
const logitMap = {}
logitRows.forEach(r => {
  const daysSince = (today - new Date(r.json.updated_at)) / 86400000
  logitMap[r.json.category] = (r.json.logit ?? 0) * Math.pow(GAMMA, daysSince)
})

// ② Temperature Softmax
const categories = ['한식','중식','양식','분식','일식','디저트','기타']
let expSum = 0
const expMap = {}
categories.forEach(cat => {
  expMap[cat] = Math.exp((logitMap[cat] ?? 0) / TEMPERATURE)
  expSum += expMap[cat]
})

// ③ Dirichlet Floor
const probs = {}
categories.forEach(cat => {
  probs[cat] = (1 - EPSILON) * (expMap[cat] / expSum) + EPSILON / K
})

// ④ 컨텍스트 보너스
const body = $('음식 추천 입력').item.json.body
const weatherBonus = CONTEXT_BONUS.weather[body.weather ?? ''] ?? {}
const mealBonus    = CONTEXT_BONUS.meal_type[body.meal_type ?? ''] ?? {}

// ⑤ 결과 반환 (식당1 노드가 이 데이터로 필터링)
return [{ json: { probs, weatherBonus, mealBonus } }]
```

### `5개 출력` 노드 코드 수정
식당 목록에 점수를 부여하고 정렬하는 부분을 아래로 교체:

```javascript
const { probs, weatherBonus, mealBonus } = $('취향 정리').item.json

const restaurants = $input.all()
return restaurants
  .map(r => {
    const cat = r.json.category ?? '기타'
    const score = (probs[cat] ?? 1/7)
                + (weatherBonus[cat] ?? 0)
                + (mealBonus[cat] ?? 0)
    return { json: { ...r.json, score } }
  })
  .sort((a, b) => b.json.score - a.json.score)
  .slice(0, 5)
```

---

## 수정 3 — `/webhook/worldcup` 신규 워크플로우 생성

### 웹훅 설정
- **Path**: `worldcup`
- **Method**: POST

### 노드 순서
```
월드컵 입력 → 로짓 초기화 계산(Code) → Upsert 반복(Loop) → 세션 저장 → 응답
```

### 로짓 초기화 계산 (Code 노드)
```javascript
const { user_id, rounds, champion } = $input.item.json.body

// 카테고리별 로짓 누적
const logitMap = {
  '한식': 0, '중식': 0, '양식': 0,
  '분식': 0, '일식': 0, '디저트': 0, '기타': 0
}

rounds.forEach(r => {
  if (logitMap[r.winner_category] !== undefined) logitMap[r.winner_category] += 0.5
  if (logitMap[r.loser_category]  !== undefined) logitMap[r.loser_category]  -= 0.3
})

// Softmax로 top_categories 계산 (응답용)
const entries = Object.entries(logitMap).sort((a, b) => b[1] - a[1])
const top_categories = entries.slice(0, 3).map(e => e[0])

// Upsert용 배열
const upsertRows = Object.entries(logitMap).map(([category, logit]) => ({
  user_id, category, logit, sample_count: rounds.length
}))

return [{ json: { user_id, upsertRows, top_categories, champion } }]
```

### Loop + Supabase Upsert
- **Loop Over Items**: `upsertRows` 배열 순회
- 각 항목을 `user_preference_logits` 테이블에 Upsert
  - On Conflict: `user_id, category`

### 세션 저장 (Supabase Insert)
- **Table**: `worldcup_sessions`
- **Fields**:
  - `user_id`, `champion`, `rounds` (JSON), `completed: true`

### 응답 (Respond to Webhook)
```json
{
  "message": "선호도 분석 완료!",
  "top_categories": "{{ $('로짓 초기화 계산').item.json.top_categories }}",
  "champion": "{{ $('로짓 초기화 계산').item.json.champion }}"
}
```

---

## 테스트 체크리스트

```
[ ] /webhook/feedback — like 호출 후 user_preference_logits.logit 증가 확인
[ ] /webhook/feedback — dislike 호출 후 logit 감소 확인
[ ] /webhook/feedback — 존재하지 않는 category면 logit=0에서 시작하는지 확인
[ ] /webhook/food — 취향 정리 노드 이후 식당이 score 기준 정렬되는지 확인
[ ] /webhook/worldcup — 완료 후 user_preference_logits에 7개 카테고리 행 생성 확인
[ ] /webhook/worldcup — worldcup_sessions에 세션 저장 확인
```
