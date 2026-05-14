# n8n ML 노드 수정 가이드

> 담당: n8n 워크플로우 팀원
> 전제조건: `supabase/schemaV2.sql` 을 Supabase SQL Editor에서 먼저 실행할 것
> 수정 대상 파일: `AI 비서 v3.json` (n8n에 이미 임포트된 워크플로우)

---

## 시작 전 확인

### Supabase 테이블 확인
n8n 작업 전에 아래 테이블이 존재하는지 Supabase Table Editor에서 확인하세요.

| 테이블 | 확인 방법 |
|--------|----------|
| `user_preference_logits` | Table Editor → 목록에서 확인 |
| `worldcup_sessions` | Table Editor → 목록에서 확인 |
| `food_feedback` | `category` 컬럼이 있는지 확인 |

없으면 `supabase/schemaV2.sql` 파일 내용을 Supabase → SQL Editor에 붙여넣고 실행하세요.

---

## 수정 1 — `/webhook/feedback` 로짓 업데이트 추가

### 목적
유저가 식당 카드에서 👍/👎를 누르면 해당 카테고리의 로짓을 +0.2 / -0.2 업데이트해서 다음 추천에 반영합니다.

### 현재 흐름 (수정 전)
```
피드백 입력 → 음식 피드백(Supabase Insert) → [연결 없음]
```

### 목표 흐름 (수정 후)
```
피드백 입력 → 음식 피드백 → 로짓 조회 → 로짓 계산 → 로짓 저장 → Respond to Webhook
```

---

### Step 1 — 워크플로우 열기

1. n8n 좌측 메뉴 → **Workflows** 클릭
2. `AI 비서 v3` 워크플로우 클릭해서 열기
3. 캔버스에서 `피드백 입력` 웹훅 노드를 찾기 (보통 왼쪽 하단)

---

### Step 2 — 로짓 조회 노드 추가

`음식 피드백` 노드 오른쪽에 새 노드를 추가합니다.

1. `음식 피드백` 노드 오른쪽 끝의 **+** 버튼 클릭
2. 검색창에 `Supabase` 입력 → **Supabase** 선택
3. 아래와 같이 설정:

| 항목 | 값 |
|------|----|
| Credential | 기존 Supabase 계정 선택 |
| Operation | **Get Many** |
| Table ID | `user_preference_logits` |

4. **Filters** 섹션 → **Add Filter** 두 번 클릭해서 조건 2개 추가:

**조건 1:**
| 항목 | 값 |
|------|----|
| Key Name | `user_id` |
| Condition | `eq` |
| Key Value | `{{ $('피드백 입력').item.json.body.user_id }}` |

**조건 2:**
| 항목 | 값 |
|------|----|
| Key Name | `category` |
| Condition | `eq` |
| Key Value | `{{ $('피드백 입력').item.json.body.category }}` |

5. 노드 이름을 `로짓 조회`로 변경 (노드 클릭 후 상단 이름 수정)

---

### Step 3 — 로짓 계산 노드 추가

`로짓 조회` 노드 오른쪽에 Code 노드를 추가합니다.

1. `로짓 조회` 노드의 **+** 버튼 클릭
2. 검색창에 `Code` 입력 → **Code** 선택
3. Language는 **JavaScript** 유지
4. 코드 영역에 아래 내용을 **완전히 교체**해서 붙여넣기:

```javascript
const body = $('피드백 입력').item.json.body
const feedback = body.feedback   // 'like' 또는 'dislike'
const userId   = body.user_id
const category = body.category

const ALPHA = 0.2
const delta = feedback === 'like' ? ALPHA : -ALPHA

// 기존 로짓 가져오기 (row 없으면 0에서 시작)
const rows = $input.all()
const currentLogit = rows.length > 0 ? (rows[0].json.logit ?? 0) : 0
const newLogit = currentLogit + delta

return [{
  json: {
    user_id:      userId,
    category:     category,
    logit:        newLogit,
    updated_at:   new Date().toISOString(),
  }
}]
```

5. 노드 이름을 `로짓 계산`으로 변경

---

### Step 4 — 로짓 저장 노드 추가 (Upsert)

`로짓 계산` 노드 오른쪽에 Supabase 노드를 추가합니다.

1. `로짓 계산` 노드의 **+** 버튼 클릭
2. `Supabase` 노드 추가
3. 아래와 같이 설정:

| 항목 | 값 |
|------|----|
| Credential | 기존 Supabase 계정 선택 |
| Operation | **Upsert** |
| Table ID | `user_preference_logits` |

4. **Fields to Send** 섹션에서 필드 4개 추가:

| Name | Value |
|------|-------|
| `user_id` | `{{ $json.user_id }}` |
| `category` | `{{ $json.category }}` |
| `logit` | `{{ $json.logit }}` |
| `updated_at` | `{{ $json.updated_at }}` |

5. **On Conflict** 항목에 `user_id,category` 입력
   - 이게 없으면 같은 유저의 같은 카테고리가 매번 새로 Insert됩니다 — 반드시 입력하세요
6. 노드 이름을 `로짓 저장`으로 변경

---

### Step 5 — Respond to Webhook 연결

1. `로짓 저장` 노드의 **+** 버튼 클릭
2. `Respond to Webhook` 노드 추가
3. **Response Body**에 아래 입력:

```json
{ "message": "피드백 저장 완료" }
```

---

### Step 6 — 노드 연결 확인 후 저장

캔버스에서 흐름이 아래와 같이 연결됐는지 확인:
```
피드백 입력 → 음식 피드백 → 로짓 조회 → 로짓 계산 → 로짓 저장 → Respond to Webhook
```

오른쪽 상단 **Save** 버튼 클릭 → **Activate** 상태인지 확인 (초록 토글)

---

### 테스트 (수정 1)

Postman 또는 curl로 아래 요청 전송:

```bash
POST http://localhost:5678/webhook/feedback
Content-Type: application/json

{
  "user_id": "test_user_001",
  "restaurant_id": "아무-uuid",
  "food_name": "김치찌개",
  "category": "한식",
  "feedback": "like"
}
```

Supabase Table Editor → `user_preference_logits` 확인:
- `user_id = test_user_001`, `category = 한식` 행의 `logit`이 0.2가 되어있으면 성공
- 한 번 더 보내면 0.4가 되어야 함

---

---

## 수정 2 — `5개 출력` 노드를 Softmax 정렬로 교체

### 목적
음식 추천 시 단순 랜덤 출력 대신, 유저의 학습된 선호도를 반영한 Softmax 확률 기반 정렬로 교체합니다.

> ⚠️ **주의**: `취향 정리` 노드는 **Set 노드**입니다 — 코드가 없으므로 건드리지 마세요.
> 수정 대상은 `5개 출력` Code 노드와 그 앞에 삽입하는 신규 노드입니다.

### 현재 흐름 (수정 전)
```
취향 정리(Set) → 식당1 → 5개 출력(Code, 랜덤) → 메뉴1 → ...
```

### 목표 흐름 (수정 후)
```
취향 정리(Set, 유지) → 식당1 → 로짓 전체 조회(신규) → 5개 출력(Code, 교체) → 메뉴1 → ...
```

---

### Step 1 — `식당1` → `5개 출력` 사이에 로짓 조회 노드 삽입

1. `식당1` → `5개 출력` 연결선 클릭 후 **Delete**로 연결 끊기
2. `식당1` 노드의 **+** 버튼 클릭 → `Supabase` 추가
3. 아래와 같이 설정:

| 항목 | 값 |
|------|----|
| Operation | **Get Many** |
| Table ID | `user_preference_logits` |
| Filter Key Name | `user_id` |
| Filter Condition | `eq` |
| Filter Key Value | `{{ $('음식 추천 입력').item.json.body.user_id }}` |

4. 이름: `로짓 전체 조회`
5. `로짓 전체 조회` 출력을 `5개 출력` 노드에 연결

---

### Step 2 — `5개 출력` 노드 코드 교체

1. `5개 출력` 노드 더블클릭
2. 기존 코드 전체 선택(Ctrl+A) 후 아래 코드로 **완전히 교체**:

```javascript
const TEMPERATURE = 1.5   // 클수록 다양한 카테고리 추천 (1.0~2.0 권장)
const EPSILON     = 0.10  // 최소 확률 보장 (어떤 카테고리도 0%가 안 됨)
const GAMMA       = 0.95  // 시간 감쇠율 (1일 기준, 낮을수록 오래된 기록 빨리 소멸)
const K           = 7     // 카테고리 개수 (변경 금지)

// 날씨/시간대별 보너스 점수
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

// ① 시간 감쇠 적용 로짓 계산
// 오래된 피드백일수록 가중치가 줄어들어 오늘 기분에 덜 영향을 줌
const today = new Date()
const logitRows = $('로짓 전체 조회').all()
const logitMap = {}
logitRows.forEach(r => {
  const daysSince = (today - new Date(r.json.updated_at)) / 86400000
  logitMap[r.json.category] = (r.json.logit ?? 0) * Math.pow(GAMMA, daysSince)
})

// ② Temperature Softmax 계산
// exp(logit / T) → 정규화 → 카테고리별 선호 확률
const categories = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타']
let expSum = 0
const expMap = {}
categories.forEach(cat => {
  expMap[cat] = Math.exp((logitMap[cat] ?? 0) / TEMPERATURE)
  expSum += expMap[cat]
})

// ③ Dirichlet Floor 적용
// 어떤 카테고리도 0%가 되지 않도록 최소 확률 EPSILON/K 보장
const probs = {}
categories.forEach(cat => {
  probs[cat] = (1 - EPSILON) * (expMap[cat] / expSum) + EPSILON / K
})

// ④ 컨텍스트 보너스 (날씨·식사시간 — 이미 수집 중인 데이터 활용)
const body = $('음식 추천 입력').item.json.body
const weatherBonus = CONTEXT_BONUS.weather[body.weather ?? ''] ?? {}
const mealBonus    = CONTEXT_BONUS.meal_type[body.meal_type ?? ''] ?? {}

// 다음 노드(5개 출력)에서 사용할 데이터 전달
return [{ json: { probs, weatherBonus, mealBonus } }]
```

---

### Step 3 — `5개 출력` 노드 코드 교체

1. `5개 출력` 노드 더블클릭
2. 기존 코드 전체 선택 후 아래로 **완전히 교체**:

```javascript
// 취향 정리 노드에서 계산된 확률값 수신
const { probs, weatherBonus, mealBonus } = $('취향 정리').item.json

// 모든 식당 목록 가져오기
const restaurants = $input.all()

return restaurants
  .map(r => {
    const cat = r.json.category ?? '기타'
    // 최종 점수 = Softmax 확률 + 날씨 보너스 + 식사시간 보너스
    const score = (probs[cat] ?? 1 / 7)
                + (weatherBonus[cat] ?? 0)
                + (mealBonus[cat] ?? 0)
    return { json: { ...r.json, score } }
  })
  .sort((a, b) => b.json.score - a.json.score)  // 점수 높은 순 정렬
  .slice(0, 5)                                   // 상위 5개만
```

---

### 테스트 (수정 2)

1. 먼저 `test_user_001`의 `user_preference_logits`에 한식 logit을 높게 설정:
   - Supabase SQL Editor:
   ```sql
   INSERT INTO user_preference_logits (user_id, category, logit)
   VALUES ('test_user_001', '한식', 3.0),
          ('test_user_001', '중식', 0.5),
          ('test_user_001', '양식', 0.3),
          ('test_user_001', '분식', 1.0),
          ('test_user_001', '일식', 0.2),
          ('test_user_001', '디저트', 0.1),
          ('test_user_001', '기타', 0.0)
   ON CONFLICT (user_id, category) DO UPDATE SET logit = EXCLUDED.logit;
   ```

2. Postman으로 음식 추천 호출:
   ```bash
   POST http://localhost:5678/webhook/food
   {
     "user_id": "test_user_001",
     "message": "오늘 뭐 먹지?",
     "location": "역삼동"
   }
   ```

3. 응답의 `restaurants` 배열 첫 번째가 한식 카테고리 식당이면 성공

---

---

## 수정 3 — `/webhook/worldcup` 신규 워크플로우 생성

### 목적
음식 이상형 월드컵 완료 시 유저의 카테고리별 초기 로짓을 Supabase에 저장합니다.
React에서 월드컵 결과를 보내면 n8n이 처리하고 `user_preference_logits`를 초기화합니다.

### 받을 데이터 형태 (React → n8n)
```json
{
  "user_id": "uuid",
  "champion": "치킨",
  "rounds": [
    {
      "round": 1,
      "winner": "치킨",
      "loser": "피자",
      "winner_category": "분식",
      "loser_category": "양식"
    },
    {
      "round": 1,
      "winner": "삼겹살",
      "loser": "짜장면",
      "winner_category": "한식",
      "loser_category": "중식"
    }
  ]
}
```

### 목표 흐름
```
월드컵 입력 → 로짓 초기화 계산(Code) → Loop Over Items → 로짓 Upsert → 세션 저장 → 응답
```

---

### Step 1 — 새 워크플로우 생성

1. n8n 좌측 메뉴 → **Workflows** → **+ New Workflow** 클릭
2. 워크플로우 이름: `월드컵 선호도 초기화`

---

### Step 2 — Webhook 노드 추가

1. 캔버스 빈 곳 클릭 → **+** → `Webhook` 검색 → 추가
2. 설정:

| 항목 | 값 |
|------|----|
| HTTP Method | `POST` |
| Path | `worldcup` |
| Authentication | None |
| Response Mode | **Using 'Respond to Webhook' Node** |

3. 이름: `월드컵 입력`

---

### Step 3 — 로짓 초기화 계산 노드 (Code)

1. `월드컵 입력` 노드의 **+** → `Code` 노드 추가
2. 아래 코드 붙여넣기:

```javascript
const { user_id, rounds, champion } = $input.item.json.body

// 전체 카테고리 초기값 0으로 시작
const logitMap = {
  '한식': 0, '중식': 0, '양식': 0,
  '분식': 0, '일식': 0, '디저트': 0, '기타': 0
}

// 월드컵 각 라운드 결과 반영
// 승리: +0.5 / 탈락: -0.3 (승리 신호가 더 강함)
rounds.forEach(r => {
  if (logitMap[r.winner_category] !== undefined) {
    logitMap[r.winner_category] += 0.5
  }
  if (logitMap[r.loser_category] !== undefined) {
    logitMap[r.loser_category] -= 0.3
  }
})

// 응답용 top_categories 계산 (점수 높은 순 정렬)
const sorted = Object.entries(logitMap).sort((a, b) => b[1] - a[1])
const top_categories = sorted.slice(0, 3).map(e => e[0])

// Loop 노드에서 순회할 배열 생성 (카테고리별 1행씩)
const upsertRows = Object.entries(logitMap).map(([category, logit]) => ({
  user_id,
  category,
  logit,
  sample_count: rounds.length,
  updated_at: new Date().toISOString(),
}))

return [{ json: { user_id, upsertRows, top_categories, champion } }]
```

3. 이름: `로짓 초기화 계산`

---

### Step 4 — Loop Over Items 노드 추가

upsertRows 배열(7개 카테고리)을 한 번에 처리하기 위해 Loop를 사용합니다.

1. `로짓 초기화 계산` → **+** → `Loop Over Items` 검색 → 추가
2. **Items** 항목: `{{ $json.upsertRows }}`
3. 이름: `카테고리 반복`

---

### Step 5 — 로짓 Upsert 노드 추가

`카테고리 반복` 노드의 **loop** 출력(오른쪽 위 핀)에 연결합니다.

1. `카테고리 반복` 루프 출력 → **+** → `Supabase` 추가
2. 설정:

| 항목 | 값 |
|------|----|
| Operation | **Upsert** |
| Table ID | `user_preference_logits` |
| On Conflict | `user_id,category` |

3. **Fields to Send:**

| Name | Value |
|------|-------|
| `user_id` | `{{ $json.user_id }}` |
| `category` | `{{ $json.category }}` |
| `logit` | `{{ $json.logit }}` |
| `sample_count` | `{{ $json.sample_count }}` |
| `updated_at` | `{{ $json.updated_at }}` |

4. 이름: `로짓 Upsert`
5. `로짓 Upsert` 출력을 `카테고리 반복` 노드 **done** 입력에 연결 (루프 종료 신호)

---

### Step 6 — 세션 저장 노드

`카테고리 반복` 노드의 **done** 출력에 연결합니다.

1. `카테고리 반복` done 출력 → **+** → `Supabase` 추가
2. 설정:

| 항목 | 값 |
|------|----|
| Operation | **Create** |
| Table ID | `worldcup_sessions` |

3. **Fields to Send:**

| Name | Value |
|------|-------|
| `user_id` | `{{ $('로짓 초기화 계산').item.json.user_id }}` |
| `champion` | `{{ $('로짓 초기화 계산').item.json.champion }}` |
| `rounds` | `{{ JSON.stringify($('월드컵 입력').item.json.body.rounds) }}` |
| `completed` | `true` |

4. 이름: `세션 저장`

---

### Step 7 — Respond to Webhook 연결

1. `세션 저장` → **+** → `Respond to Webhook` 추가
2. **Response Body:**

```json
{
  "message": "선호도 분석 완료!",
  "top_categories": {{ $('로짓 초기화 계산').item.json.top_categories }},
  "champion": "{{ $('로짓 초기화 계산').item.json.champion }}"
}
```

3. 저장 → Activate

---

### 테스트 (수정 3)

```bash
POST http://localhost:5678/webhook/worldcup
Content-Type: application/json

{
  "user_id": "test_user_001",
  "champion": "치킨",
  "rounds": [
    { "round": 1, "winner": "치킨", "loser": "피자",
      "winner_category": "분식", "loser_category": "양식" },
    { "round": 1, "winner": "삼겹살", "loser": "짜장면",
      "winner_category": "한식", "loser_category": "중식" },
    { "round": 2, "winner": "치킨", "loser": "삼겹살",
      "winner_category": "분식", "loser_category": "한식" }
  ]
}
```

확인:
- 응답에 `top_categories` 배열 포함 여부
- Supabase `user_preference_logits`에 `test_user_001` 기준 7개 행 생성 여부
- Supabase `worldcup_sessions`에 세션 1개 저장 여부

---

## 전체 테스트 체크리스트

```
[ ] schemaV2.sql 실행 완료 → 3개 테이블/컬럼 확인
[ ] 수정 1: feedback like → logit +0.2 확인
[ ] 수정 1: feedback dislike → logit -0.2 확인
[ ] 수정 1: 처음 피드백 (row 없음) → logit 0.2로 생성되는지 확인
[ ] 수정 2: 한식 logit 높은 유저 → 음식 추천 시 한식 식당이 상위에 오는지 확인
[ ] 수정 2: 모든 카테고리 logit 동일 → 고르게 섞여 나오는지 확인
[ ] 수정 3: worldcup 완료 → 7개 카테고리 행 생성 확인
[ ] 수정 3: worldcup 완료 → worldcup_sessions에 저장 확인
[ ] 수정 3: 이미 logit 있는 유저가 월드컵 재도전 → 덮어쓰기(upsert) 되는지 확인
```
