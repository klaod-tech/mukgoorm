# Step 4 — 월드컵 워크플로우

> ⬅️ [목차](n8n_ml_nodes.md) | ⬅️ [Step 3 완료 후](n8n_03_메뉴선택_로짓.md)  
> **대상 워크플로우:** `먹구름_봇v4`

---

## 현황 요약

월드컵 워크플로우는 `먹구름_봇v4.json`에 **이미 구조가 완성**되어 있습니다.  
**단, 아래 2개 버그를 수정해야 React와 정상 연동됩니다.**

| 항목 | 상태 |
|------|------|
| 흐름 구조 (7노드) | ✅ v4에 존재 |
| `Code in JavaScript` 노드 참조 | ❌ 버그 1 — 존재하지 않는 노드 참조 |
| 최종 응답 형식 | ❌ 버그 2 — 메뉴선택 형식으로 잘못 연결됨 |

> React `Worldcup.tsx`는 완성 상태. 백엔드 버그 수정 후 바로 연동 가능.

---

## 실제 v4 흐름도

```
월드컵 입력 (Webhook POST /worldcup)
    ↓
월드컵 현재 로직 (Supabase Get Many — user_preference_logits)
    ↓
월드컵 로직 계산 (Code — 델타 계산 + Softmax + exists 플래그)
    ↓
월드컵 기록 (Supabase Create — worldcup_sessions)
    ↓
월드컵 응답 (Code — categories_to_upsert를 7개 항목으로 분리)
    ↓
정보 수정 여부 (IF — $json.exists is true)
 ├─ [true]  → 로직 업데이트2 (Supabase Update, user_preference_logits)
 └─ [false] → 로직 생성2    (Supabase Create, user_preference_logits)
    ↓
Code in JavaScript  ← ❌ 버그 1: $('월드컵 계산') → $('월드컵 로직 계산')으로 수정
    ↓
피드백 확인1 (Respond to Webhook)  ← ❌ 버그 2: 응답 Body 수정 필요
```

---

## React ↔ n8n 인터페이스

### React → n8n (요청)

`web/src/pages/Worldcup.tsx`의 `handleComplete()`가 전송합니다.

```json
POST /webhook/worldcup

{
  "user_id": "유저UUID",
  "champion": "돈까스",
  "rounds": [
    {
      "round": 1,
      "winner": "돈까스",
      "loser": "피자",
      "winner_category": "양식",
      "loser_category": "양식"
    }
  ]
}
```

**React FOOD_POOL 카테고리 (현재 5종):**

| 음식 | 카테고리 |
|------|---------|
| 삼겹살, 김치찌개, 비빔밥, 순대국밥, 족발 | 한식 |
| 짜장면, 짬뽕, 탕수육, 마라탕 | 중식 |
| 피자, 스테이크, 파스타, 햄버거 | 양식 |
| 치킨, 떡볶이 | 분식 |
| 아이스크림 | 디저트 |

> n8n은 7개 카테고리(한식/중식/양식/분식/일식/디저트/기타)를 관리하지만,  
> React FOOD_POOL에 일식·기타 메뉴가 없어서 실제 rounds에는 5종만 등장합니다.  
> 나머지 2종(일식·기타) logit은 초기값 그대로 저장됩니다.

### n8n → React (응답)

`web/src/lib/n8n.ts`의 `sendWorldcupResult()`가 기대하는 형식:

```json
{
  "message": "선호도 분석 완료! 👑 돈까스이(가) 우승했어요",
  "top_categories": ["한식", "양식", "중식"]
}
```

`top_categories`는 결과 화면에서 **선호 카테고리 TOP 3 칩**으로 표시됩니다.  
이 필드가 빠지면 칩이 렌더링되지 않고, 에러는 발생하지 않습니다(`?? []`로 처리).

---

## 수정 필요 사항

### 버그 1 — `Code in JavaScript` 노드 참조 오류

n8n 캔버스에서 `Code in JavaScript` 노드를 열어 코드를 아래로 교체합니다.

**현재 (잘못됨):**
```javascript
const data = $('월드컵 계산').first().json  // 이 노드는 존재하지 않음
```

**수정 후:**
```javascript
const data = $('월드컵 로직 계산').first().json

return [{
  json: {
    message: `선호도 분석 완료! 👑 ${data.champion}이(가) 우승했어요`,
    top_categories: data.top_categories
  }
}]
```

### 버그 2 — `피드백 확인1` 응답 형식 오류

`피드백 확인1` 노드는 메뉴 선택 흐름의 응답 노드와 연결이 잘못되어 있습니다.  
n8n 캔버스에서 `피드백 확인1` → **Response Body** 값을 아래로 수정합니다.

**현재 (잘못됨):**
```
={{ JSON.stringify({ ok: true, category: $json.category }) }}
```

**수정 후:**
```
={{ JSON.stringify($json) }}
```

`$json`에는 `Code in JavaScript`가 출력한 `{ message, top_categories }`가 그대로 담깁니다.

---

## 월드컵 로직 계산 — Code 노드 전체 코드 (참고)

v4에 적용된 코드입니다. 수정 불필요.

```javascript
const raw  = $('월드컵 입력').first().json
const body = raw.body || raw
const { user_id, champion = '', rounds = [] } = body

const CATS = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타']

// 기존 로짓 맵 (없으면 0 처리)
const currentMap = {}
$input.all().forEach(item => {
  if (item.json.category) {
    currentMap[item.json.category] = {
      logit:        item.json.logit        ?? 0,
      sample_count: item.json.sample_count ?? 0
    }
  }
})

// 승리 +0.5 / 탈락 -0.3
const deltaMap = {}
CATS.forEach(c => { deltaMap[c] = 0 })
rounds.forEach(r => {
  if (r.winner_category && deltaMap[r.winner_category] !== undefined)
    deltaMap[r.winner_category] += 0.5
  if (r.loser_category && deltaMap[r.loser_category] !== undefined)
    deltaMap[r.loser_category] -= 0.3
})

const now = new Date().toISOString()

const categories_to_upsert = CATS.map(cat => ({
  user_id,
  category:     cat,
  logit:        Math.round(((currentMap[cat]?.logit ?? 0) + (deltaMap[cat] || 0)) * 1000) / 1000,
  sample_count: (currentMap[cat]?.sample_count ?? 0) + 1,
  updated_at:   now,
  exists:       !!currentMap[cat]  // IF 분기용
}))

// Softmax (T=1.5, EPS=0.1, K=7) → top 3 추출
const T = 1.5, EPS = 0.1, K = 7
let expSum = 0
const expMap = {}
categories_to_upsert.forEach(c => {
  expMap[c.category] = Math.exp(c.logit / T)
  expSum += expMap[c.category]
})

const top_categories = Object.entries(expMap)
  .map(([cat, exp]) => ({ cat, p: (1 - EPS) * exp / expSum + EPS / K }))
  .sort((a, b) => b.p - a.p)
  .slice(0, 3)
  .map(e => e.cat)

return [{
  json: { user_id, champion, rounds, top_categories, categories_to_upsert, created_at: now }
}]
```

---

## 테스트

버그 수정 후 아래 요청으로 검증합니다.

```
POST http://localhost:5678/webhook/worldcup
Content-Type: application/json

{
  "user_id": "test_user_999",
  "champion": "삼겹살",
  "rounds": [
    { "round": 1, "winner": "삼겹살", "loser": "피자",   "winner_category": "한식", "loser_category": "양식" },
    { "round": 1, "winner": "짜장면", "loser": "치킨",   "winner_category": "중식", "loser_category": "분식" },
    { "round": 2, "winner": "삼겹살", "loser": "짜장면", "winner_category": "한식", "loser_category": "중식" }
  ]
}
```

**기대 응답:**
```json
{
  "message": "선호도 분석 완료! 👑 삼겹살이(가) 우승했어요",
  "top_categories": ["한식", "중식", "양식"]
}
```

**Supabase 확인:**
- `user_preference_logits` → `user_id = test_user_999` 행 7개 존재
- `worldcup_sessions` → 세션 1개 생성, `completed = true`
- 같은 user_id로 재실행 → logit이 누적되어야 함 (덮어쓰기 아님)

---

## ✅ Step 4 체크리스트

```
[x] 월드컵 입력 Webhook (path: worldcup) — v4에 존재
[x] 월드컵 현재 로직 Supabase (Get Many, user_preference_logits)
[x] 월드컵 로직 계산 Code (델타 + Softmax + exists 플래그)
[x] 월드컵 기록 Supabase (Create, worldcup_sessions)
[x] 월드컵 응답 Code (categories_to_upsert 7개 분리)
[x] 정보 수정 여부 IF ($json.exists 분기)
[x] 로직 업데이트2 / 로직 생성2 Supabase
[ ] Code in JavaScript — 노드 참조 수정 (버그 1)
[ ] 피드백 확인1 — Response Body 수정 (버그 2)
[ ] Save → Active 확인
[ ] 테스트: top_categories 3개 응답 확인
[ ] 테스트: worldcup_sessions 저장 확인
[ ] 테스트: user_preference_logits 7행 업데이트 확인
[ ] React 결과 화면 — TOP 3 칩 표시 확인
```

---

완료 → [목차로 돌아가기](n8n_ml_nodes.md)
