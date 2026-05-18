# Step 4 — 월드컵 워크플로우 신규 생성

> ⬅️ [목차](n8n_ml_nodes.md) | ⬅️ [Step 3 완료 후](n8n_03_메뉴선택_로짓.md)  
> ⏱️ 예상 소요 시간: 20분  
> **작업 종류:** 신규 워크플로우 생성 (기존 수정 아님)

---

## 목표

음식 이상형 월드컵 완료 시 유저의 초기 선호도(로짓)를 Supabase에 저장합니다.

- **승리 카테고리:** +0.5 (가장 강한 신호)
- **탈락 카테고리:** -0.3

### 받을 데이터 형태 (React → n8n)
```json
{
  "user_id": "유저UUID",
  "champion": "돈까스",
  "rounds": [
    {
      "round": 1,
      "winner": "돈까스",
      "loser": "피자",
      "winner_category": "분식",
      "loser_category": "양식"
    },
    {
      "round": 2,
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
월드컵 입력(Webhook)
    → 현재 로짓 조회(Supabase)
    → 월드컵 계산(Code - 델타 누적 + 새 로짓 + Softmax)
    → 세션 저장(HTTP Request - worldcup_sessions)
    → 로짓 저장(HTTP Request - user_preference_logits Upsert)
    → 최종 응답(Code - top_categories 계산)
    → 응답(Respond to Webhook)
```

---

## 4-1. 새 워크플로우 생성

1. n8n 좌측 → **Workflows** → **+ New Workflow** 클릭
2. 워크플로우 이름: **`worldcup`** (또는 `월드컵 선호도`)
3. 빈 캔버스 준비

---

## 4-2. 월드컵 입력 — Webhook 노드

1. 캔버스 **+** → `Webhook` 검색 → 추가
2. 설정:

| 항목 | 값 |
|------|-----|
| **HTTP Method** | POST |
| **Path** | `worldcup` |
| **Authentication** | None |
| **Response Mode** | Using 'Respond to Webhook' Node |

노드 이름: **`월드컵 입력`**

---

## 4-3. 현재 로짓 조회 — Supabase 노드

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
Key Value : {{ ($input.first().json.body || $input.first().json).user_id }}
```

노드 이름: **`현재 로짓`**

---

## 4-4. 월드컵 계산 — Code 노드

`현재 로짓` **+** → `Code` 추가

```javascript
// ────────────────────────────────────────────────
// 월드컵 계산 노드
// ────────────────────────────────────────────────
// 목적:
//   1. 전체 라운드 결과 → 카테고리별 델타(점수 변화) 누적
//   2. 기존 로짓 + 델타 = 새 로짓
//   3. Softmax로 top_categories 계산 (응답용)
//   4. 7개 카테고리 upsert 데이터 준비
//
// 출력: 단 1개 item
//   - categories_to_upsert: [{user_id, category, logit, ...}, ...]
//   - top_categories: ['분식', '한식', '양식'] (상위 3개)
//   - softmax: { 분식: 0.52, 한식: 0.28, ... }
// ────────────────────────────────────────────────

const raw  = $('월드컵 입력').first().json
const body = raw.body || raw

const { user_id, champion = '', rounds = [] } = body

const CATS = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타']

// ① 기존 로짓 맵 만들기 (없으면 0 처리)
const currentMap = {}
$input.all().forEach(item => {
  if (item.json.category) {
    currentMap[item.json.category] = {
      logit:        item.json.logit        ?? 0,
      sample_count: item.json.sample_count ?? 0
    }
  }
})

// ② 라운드별 델타 계산
//    승리: +0.5 (강한 선호 신호)
//    탈락: -0.3 (거부감 — 승리보다 약하게)
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

// ③ 새 로짓 = 기존 로짓 + 델타
const now = new Date().toISOString()

const categories_to_upsert = CATS.map(cat => ({
  user_id,
  category:     cat,
  logit:        Math.round(((currentMap[cat]?.logit ?? 0) + (deltaMap[cat] || 0)) * 1000) / 1000,
  sample_count: (currentMap[cat]?.sample_count ?? 0) + (rounds.length > 0 ? 1 : 0),
  updated_at:   now
}))

// ④ 응답용 Softmax 계산
//    T=1.5, EPS=0.1, K=7
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

// 높은 확률 순으로 top 3 카테고리
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

## 4-5. 세션 저장 — HTTP Request 노드

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
- **Body Content Type**: Raw
- **Content Type**: `application/json`
- **Body**:

```
={{ JSON.stringify({
  user_id:   $json.user_id,
  champion:  $json.champion,
  rounds:    $json.rounds,
  completed: true,
  created_at: $json.created_at
}) }}
```

노드 이름: **`세션 저장`**

---

## 4-6. 로짓 저장 — HTTP Request 노드

`세션 저장` **+** → `HTTP Request` 추가

7개 카테고리를 한 번의 API 호출로 Upsert합니다.

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
- **Body Content Type**: Raw
- **Content Type**: `application/json`
- **Body**:

```
={{ JSON.stringify($('월드컵 계산').first().json.categories_to_upsert) }}
```

> 💡 **왜 `$('월드컵 계산').first().json`을 참조하는가?**  
> 이전 노드(`세션 저장`)의 응답 데이터 대신  
> `월드컵 계산` 노드에서 준비한 원본 데이터를 직접 가져옵니다.  
> `return=minimal`로 세션 저장이 빈 응답을 돌려주기 때문입니다.

노드 이름: **`로짓 저장`**

---

## 4-7. 최종 응답 — Code 노드

`로짓 저장` **+** → `Code` 추가

```javascript
// ────────────────────────────────────────────────
// 최종 응답 코드
// ────────────────────────────────────────────────
// 목적:
//   React가 받을 응답 JSON 구성
//   - top_categories: 상위 3개 선호 카테고리
//   - softmax: 전체 카테고리 확률 분포
//   - champion: 월드컵 최종 우승 음식
// ────────────────────────────────────────────────

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

## 4-8. Respond to Webhook 추가

`최종 응답` **+** → `Respond to Webhook` 추가

| 항목 | 값 |
|------|-----|
| **Respond With** | JSON |
| **Response Body** | `={{ JSON.stringify($json) }}` |

노드 이름: **`응답`**

---

## 4-9. 전체 흐름 확인

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

```bash
POST http://n8n-host:5678/webhook/worldcup
Content-Type: application/json

{
  "user_id": "test_user_999",
  "champion": "돈까스",
  "rounds": [
    {
      "round": 1,
      "winner": "돈까스",
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
    },
    {
      "round": 2,
      "winner": "돈까스",
      "loser": "삼겹살",
      "winner_category": "분식",
      "loser_category": "한식"
    }
  ]
}
```

### 성공 기준

**응답 확인:**
```json
{
  "message": "선호도 분석 완료! 👑 돈까스이(가) 우승했어요",
  "top_categories": ["분식", "한식", "..."],
  "softmax": { "분식": 0.42, "한식": 0.28, ... },
  "champion": "돈까스"
}
```

**Supabase 확인:**
1. `user_preference_logits` 테이블 → `user_id = test_user_999` 행 7개 생성
   - `분식`: logit이 가장 높음 (+0.5 × 2 = +1.0)
   - `양식`: 음수 (-0.3)
2. `worldcup_sessions` 테이블 → 세션 1개 생성

**재실행 확인 (월드컵 다시 하기):**
- 같은 `user_id`로 다시 요청 → 기존 값에 누적되는지 확인
- `user_preference_logits`의 logit이 덮어써지지 않고 합산되어야 함

---

## ✅ Step 4 체크리스트

```
[ ] 새 워크플로우 생성 (이름: worldcup)
[ ] 월드컵 입력 Webhook 노드 (path: worldcup)
[ ] 현재 로짓 조회 Supabase 노드
[ ] 월드컵 계산 Code 노드 (코드 적용)
[ ] 세션 저장 HTTP Request 노드 (worldcup_sessions)
[ ] 로짓 저장 HTTP Request 노드 (user_preference_logits, merge-duplicates)
[ ] 최종 응답 Code 노드
[ ] 응답 Respond to Webhook 노드
[ ] 전체 흐름 연결 확인
[ ] Save → Active 확인
[ ] 테스트: 응답에 top_categories 포함 확인
[ ] 테스트: DB에 7개 행 생성 확인
[ ] 테스트: worldcup_sessions에 세션 저장 확인
```

---

## 🎉 전체 완료!

모든 Step이 완료됐으면 아래 전체 체크리스트를 다시 확인하세요.

```
[ ] Step 0: Supabase 테이블 3개 생성 확인
[ ] Step 1: 먹구름봇 음식 추천 Softmax 정렬 적용
[ ] Step 2: 먹구름봇 피드백 로짓 ±0.2 업데이트
[ ] Step 3: 음식상세 메뉴 선택 로짓 +0.1 업데이트
[ ] Step 4: 월드컵 워크플로우 신규 생성
```

모두 완료 → [목차로 돌아가기](n8n_ml_nodes.md)
