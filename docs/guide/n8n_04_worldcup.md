# Step 4 — 먹구름_봇v2: 월드컵 워크플로우 추가

> ⬅️ [목차](n8n_ml_nodes.md) | ⬅️ [Step 3 완료 후](n8n_03_메뉴선택_로짓.md)  
> ⏱️ 예상 소요 시간: 20분  
> **대상 워크플로우:** `먹구름_봇v2` (기존 워크플로우에 webhook 추가)

---

## 목표

음식 이상형 월드컵 완료 시 유저의 초기 선호도(로짓)를 Supabase에 저장합니다.

- **승리 카테고리:** +0.5 (가장 강한 신호)
- **탈락 카테고리:** -0.3

### 추가할 흐름
```
월드컵 입력(Webhook - /worldcup)         ← 신규 추가
    → 현재 로짓(Supabase)                ← 신규 추가
    → 월드컵 계산(Code)                  ← 신규 추가
    → 세션 저장(HTTP Request)            ← 신규 추가
    → 로짓 저장(HTTP Request)            ← 신규 추가
    → 최종 응답(Code)                    ← 신규 추가
    → 응답(Respond to Webhook)           ← 신규 추가
```

> 💡 `먹구름_봇v2`에는 이미 여러 webhook이 공존합니다.  
> 기존 노드에 영향 없이 캔버스 빈 공간에 새 흐름을 추가하면 됩니다.

---

## 월드컵 페어 구성 규칙 (React)

React Worldcup 페이지에서 Supabase `menu_items`를 가져와 페어를 구성할 때:

1. **음료/뷔페 키워드 제외**: `keywords` 배열에 아래 키워드가 있으면 제외
   ```
   소주, 맥주, 사케, 막걸리, 청주, 모주, 사이다, 콜라, 주스, 에이드, 식혜, 라떼, 뷔페
   ```

2. **category 매핑**: 각 메뉴의 `keywords[0]`을 `KEYWORD_CATEGORY_MAP`으로 변환  
   → 매핑 테이블 전체: [n8n_ml_nodes.md](n8n_ml_nodes.md#keyword--logit_category-매핑)

3. **rounds 데이터**: 각 라운드마다 `winner_category`, `loser_category` 포함

---

## React에서 보내는 데이터 형태

```json
{
  "user_id": "유저UUID",
  "champion": "돈까스",
  "rounds": [
    {
      "round": 1,
      "winner": "돈까스",
      "loser": "피자",
      "winner_category": "일식",
      "loser_category": "양식"
    }
  ]
}
```

---

## 4-1. 월드컵 입력 — Webhook 노드

`먹구름_봇v2` 캔버스 빈 공간 → **+** → `Webhook` 추가

| 항목 | 값 |
|------|-----|
| **HTTP Method** | POST |
| **Path** | `worldcup` |
| **Authentication** | None |
| **Response Mode** | Using 'Respond to Webhook' Node |

노드 이름: **`월드컵 입력`**

---

## 4-2. 현재 로짓 — Supabase 노드

기존 로짓이 있는 유저가 월드컵을 다시 하는 경우를 위해 현재 값을 먼저 읽습니다.

`월드컵 입력` **+** → `Supabase` 추가

| 항목 | 값 |
|------|-----|
| **Operation** | Get Many |
| **Table** | `user_preference_logits` |
| **Return All** | ✅ 체크 |

**Filter:**
```
Key Name  : user_id
Condition : equal
Key Value : {{ ($('월드컵 입력').item.json.body || $('월드컵 입력').item.json).user_id }}
```

노드 이름: **`현재 로짓`**

---

## 4-3. 월드컵 계산 — Code 노드

`현재 로짓` **+** → `Code` 추가

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

// 라운드별 델타 계산
// 승리: +0.5 / 탈락: -0.3
const deltaMap = {}
CATS.forEach(c => { deltaMap[c] = 0 })

;(rounds || []).forEach(r => {
  if (r.winner_category && deltaMap[r.winner_category] !== undefined) {
    deltaMap[r.winner_category] += 0.5
  }
  if (r.loser_category && deltaMap[r.loser_category] !== undefined) {
    deltaMap[r.loser_category] -= 0.3
  }
})

// 새 로짓 = 기존 로짓 + 델타
const now = new Date().toISOString()

const categories_to_upsert = CATS.map(cat => ({
  user_id,
  category:     cat,
  logit:        Math.round(((currentMap[cat]?.logit ?? 0) + (deltaMap[cat] || 0)) * 1000) / 1000,
  sample_count: (currentMap[cat]?.sample_count ?? 0) + (rounds.length > 0 ? 1 : 0),
  updated_at:   now
}))

// 응답용 Softmax (T=1.5, EPS=0.1, K=7)
const T = 1.5, EPS = 0.1, K = 7

const newLogitMap = {}
categories_to_upsert.forEach(c => { newLogitMap[c.category] = c.logit })

let expSum = 0
const expMap = {}
CATS.forEach(cat => {
  expMap[cat] = Math.exp(newLogitMap[cat] / T)
  expSum += expMap[cat]
})

const softmax = {}
CATS.forEach(cat => {
  softmax[cat] = Number(((1 - EPS) * expMap[cat] / expSum + EPS / K).toFixed(4))
})

const top_categories = Object.entries(softmax)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([cat]) => cat)

return [{
  json: {
    user_id,
    champion,
    rounds,
    top_categories,
    softmax,
    categories_to_upsert,
    created_at: now
  }
}]
```

노드 이름: **`월드컵 계산`**

---

## 4-4. 세션 저장 — HTTP Request 노드

`월드컵 계산` **+** → `HTTP Request` 추가

| 항목 | 값 |
|------|-----|
| **Method** | POST |
| **URL** | `https://[프로젝트ID].supabase.co/rest/v1/worldcup_sessions` |
| **Authentication** | Predefined Credential Type |
| **Credential Type** | Supabase API |
| **Credential** | Supabase account 선택 |

**Headers:**

| Name | Value |
|------|-------|
| `Prefer` | `return=minimal` |
| `Content-Type` | `application/json` |

**Body:**
- **Body Content Type**: Raw / **Content Type**: `application/json`

```
={{ JSON.stringify({
  user_id:    $json.user_id,
  champion:   $json.champion,
  rounds:     $json.rounds,
  completed:  true,
  created_at: $json.created_at
}) }}
```

노드 이름: **`세션 저장`**

---

## 4-5. 로짓 저장 — HTTP Request 노드

`세션 저장` **+** → `HTTP Request` 추가

7개 카테고리를 한 번에 Upsert합니다.

| 항목 | 값 |
|------|-----|
| **Method** | POST |
| **URL** | `https://[프로젝트ID].supabase.co/rest/v1/user_preference_logits` |
| **Authentication** | Predefined Credential Type |
| **Credential Type** | Supabase API |
| **Credential** | Supabase account 선택 |

**Headers:**

| Name | Value |
|------|-------|
| `Prefer` | `resolution=merge-duplicates` |
| `Content-Type` | `application/json` |

**Body:**
- **Body Content Type**: Raw / **Content Type**: `application/json`

```
={{ JSON.stringify($('월드컵 계산').first().json.categories_to_upsert) }}
```

> 💡 `$('월드컵 계산').first().json`을 참조하는 이유:  
> `세션 저장`이 `return=minimal`로 빈 응답을 돌려주기 때문에 직전 노드 참조 불가.

노드 이름: **`로짓 저장`**

---

## 4-6. 최종 응답 — Code 노드

`로짓 저장` **+** → `Code` 추가

```javascript
const data = $('월드컵 계산').first().json

return [{
  json: {
    message:        `선호도 분석 완료! 👑 ${data.champion}이(가) 우승했어요`,
    top_categories: data.top_categories,
    softmax:        data.softmax,
    champion:       data.champion
  }
}]
```

노드 이름: **`최종 응답`**

---

## 4-7. 응답 — Respond to Webhook

`최종 응답` **+** → `Respond to Webhook` 추가

| 항목 | 값 |
|------|-----|
| **Respond With** | JSON |
| **Response Body** | `={{ JSON.stringify($json) }}` |

노드 이름: **`응답`**

---

## 전체 흐름 확인

```
월드컵 입력(Webhook - POST /worldcup)
    ↓
현재 로짓(Supabase - Get Many, user_preference_logits)
    ↓
월드컵 계산(Code - 델타 계산 + Softmax)
    ↓
세션 저장(HTTP Request - POST worldcup_sessions)
    ↓
로짓 저장(HTTP Request - POST user_preference_logits, merge-duplicates)
    ↓
최종 응답(Code - 응답 JSON 구성)
    ↓
응답(Respond to Webhook)
```

**Save → Active 확인**

---

## 🧪 테스트

```json
POST http://localhost:5678/webhook/worldcup
Content-Type: application/json

{
  "user_id": "test_user_999",
  "champion": "돈까스",
  "rounds": [
    { "round": 1, "winner": "돈까스", "loser": "피자", "winner_category": "일식", "loser_category": "양식" },
    { "round": 1, "winner": "삼겹살", "loser": "짜장면", "winner_category": "한식", "loser_category": "중식" },
    { "round": 2, "winner": "돈까스", "loser": "삼겹살", "winner_category": "일식", "loser_category": "한식" }
  ]
}
```

**응답 확인:**
```json
{
  "message": "선호도 분석 완료! 👑 돈까스이(가) 우승했어요",
  "top_categories": ["일식", "한식", "..."],
  "softmax": { "일식": 0.42, "한식": 0.28, ... },
  "champion": "돈까스"
}
```

**Supabase 확인:**
- `user_preference_logits` → `user_id=test_user_999` 행 7개 (일식 logit 가장 높음)
- `worldcup_sessions` → 세션 1개 생성
- 같은 user_id로 재실행 → logit이 덮어써지지 않고 누적되어야 함

---

## ✅ Step 4 체크리스트

```
[ ] 먹구름_봇v2 캔버스에 월드컵 입력 Webhook 추가 (path: worldcup)
[ ] 현재 로짓 Supabase 노드 추가 (Get Many, user_preference_logits)
[ ] 월드컵 계산 Code 노드 추가
[ ] 세션 저장 HTTP Request 노드 추가 (worldcup_sessions)
[ ] 로짓 저장 HTTP Request 노드 추가 (user_preference_logits, merge-duplicates)
[ ] 최종 응답 Code 노드 추가
[ ] 응답 Respond to Webhook 노드 추가
[ ] Save → Active 확인
[ ] 테스트: 응답에 top_categories 포함 확인
[ ] 테스트: DB에 7개 행 업데이트 확인
[ ] 테스트: worldcup_sessions에 세션 저장 확인
```

---

## 🎉 전체 완료!

```
[x] Step 0: Supabase 테이블 생성 확인
[x] Step 1: 먹구름봇v2 음식 추천 Softmax 정렬 적용
[x] Step 2: 먹구름봇v2 피드백 로짓 ±0.2 업데이트
[ ] Step 3: 먹구름봇v2 메뉴 선택 로짓 +0.1 업데이트 (3-3만 미완)
[ ] Step 4: 먹구름봇v2 월드컵 로짓 업데이트
```

모두 완료 → [목차로 돌아가기](n8n_ml_nodes.md)
