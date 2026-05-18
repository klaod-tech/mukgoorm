# Step 1 — 먹구름봇: 음식 추천 Softmax 적용

> ⬅️ [목차](n8n_ml_nodes.md) | ⬅️ [Step 0 먼저 완료](n8n_00_setup.md)  
> ⏱️ 예상 소요 시간: 20분  
> **대상 워크플로우:** `먹구름_봇` (또는 현재 `/webhook/food`를 담당하는 워크플로우)

---

## 목표

음식 추천 흐름에 **Softmax**을 추가합니다.  
유저별 로짓을 읽어서 취향에 맞는 카테고리 식당이 위로 올라오게 합니다.

### 수정 전 흐름
```
취향 정리(Set) → 식당1(Supabase) → 메뉴1(Supabase) → 식당 메뉴 연동1(Code) → Decision(AI) → ...
```

### 수정 후 흐름
```
취향 정리(Set) → [로짓 조회] → [로짓 집계] → 식당1(Supabase) → 메뉴 → 식당 메뉴 연동1 → [Softmax] → Decision(AI) → ...
                  ↑ 신규         ↑ 신규                                                       ↑ 신규
```

> 📌 **노드 위치 중요**  
> - `로짓 조회`, `로짓 집계`는 `취향 정리` → `식당1` **사이**에 삽입  
> - `Softmax`는 `식당 메뉴 연동1` → `Decision` **사이**에 삽입

---

## 1-1. 워크플로우 열기

1. n8n → **Workflows** → `먹구름_봇` 클릭
2. 캔버스에서 `/webhook/food` 시작점 찾기
3. `음식 추천 입력` → `키워드 추출` → `유저 정보1` → `취향 정리` → `식당1` 체인을 찾기

> 💡 노드가 너무 많아서 찾기 힘들면: 캔버스 빈 곳 우클릭 → **Find Node** 에서 `취향 정리` 검색

---

## 1-2. 로짓 조회 노드 추가

**`취향 정리` → `식당1` 사이에 삽입합니다.**

### 연결 끊기
1. `취향 정리`와 `식당1` 사이의 **연결선(화살표)** 클릭
2. `Delete` 키 눌러서 연결 끊기

### Supabase 노드 추가
1. `취향 정리` 노드 오른쪽 **+** 버튼 클릭 → `Supabase` 검색 → 선택
2. 아래 설정 입력:

| 항목 | 값 |
|------|-----|
| **Credential** | 기존 Supabase 계정 선택 |
| **Resource** | Row |
| **Operation** | **Get Many** (`Get All`이라고 표시될 수도 있음) |
| **Table** | `user_preference_logits` |
| **Return All** | ✅ 체크 (7개 카테고리 전부 가져와야 함) |

3. **Always Output Data** → ✅ 체크 (신규 유저 0행 처리용)

4. **Filters** 섹션 → **Add Filter**:

```
Key Name  : user_id
Condition : equal
Key Value : {{ ($('키워드 추출').item.json.body || $('키워드 추출').item.json).user_id }}
```

> ⚠️ n8n 버전에 따라 webhook body가 `body.user_id` 또는 `user_id` 형태로 올 수 있어  
> 두 경우 모두 처리하는 표현식입니다.

5. 노드 이름 → `로짓 조회` 로 변경

---

## 1-3. 로짓 집계 노드 추가

**`로짓 조회` 바로 다음에 추가합니다.**

`로짓 조회`는 최대 7개의 row를 반환합니다 (카테고리당 1개).  
이 7개를 **하나의 객체(map)** 로 합쳐야 다음 노드에서 쓰기 편합니다.

1. `로짓 조회` 노드 **+** 클릭 → `Code` 검색 → 선택
2. Language: **JavaScript**
3. 코드 전체 교체 (Ctrl+A → 붙여넣기):

```javascript
// ────────────────────────────────────────────────
// 로짓 집계 노드
// ────────────────────────────────────────────────
// 목적:
//   로짓 조회 노드가 돌려준 배열(최대 7개 row)을
//   { '한식': 2.1, '분식': 1.5, ... } 형태의 맵으로 변환
//
// 왜 필요한가:
//   로짓 조회가 여러 item을 반환하면 다음 노드가
//   item 수만큼 반복 실행됩니다. 1개로 합쳐서 넘겨야
//   식당1이 한 번만 실행됩니다.
// ────────────────────────────────────────────────

const items = $input.all()  // 로짓 조회 결과 (0~7개)

const logit_map     = {}    // { 카테고리: 로짓 점수 }
const updated_at_map = {}   // { 카테고리: 마지막 업데이트 시각 } — 시간 감쇠에 사용

items.forEach(item => {
  const { category, logit, updated_at } = item.json
  if (category) {
    logit_map[category]      = logit ?? 0
    updated_at_map[category] = updated_at ?? null
  }
})

// 단 1개의 item만 반환 → 식당1이 1번만 실행됨
return [{ json: { logit_map, updated_at_map } }]
```

4. 노드 이름 → `로짓 집계` 로 변경
5. `로짓 집계` 출력을 **`식당1`** 에 연결

> 💡 연결 방법: `로짓 집계` 오른쪽 점을 드래그해서 `식당1` 왼쪽에 놓기

---

## 1-4. Softmax 노드 추가

**`식당 메뉴 연동1` → `Decision` 사이에 삽입합니다.**

### 연결 끊기
1. `식당 메뉴 연동1`과 `Decision` 사이의 연결선 클릭 → `Delete`

### Code 노드 추가
1. `식당 메뉴 연동1` 오른쪽 **+** → `Code` 선택
2. 코드 전체 교체:

```javascript
// ────────────────────────────────────────────────
// Softmax 노드
// ────────────────────────────────────────────────
// 목적:
//   식당 메뉴 연동1이 만든 restaurants 배열을
//   유저의 취향(로짓) 기반 확률 점수로 재정렬
//
// 적용하는 3가지 보정:
//   1. Temporal Decay: 오래된 피드백 가중치 감소 (γ=0.95/일)
//   2. Temperature Softmax: 확률 분포를 평탄하게 (T=1.5)
//   3. Dirichlet Floor: 모든 카테고리 최소 확률 보장 (ε=0.1)
// ────────────────────────────────────────────────

const T     = 1.5   // Temperature: 높을수록 다양한 추천, 낮을수록 취향 집중
const EPS   = 0.10  // Epsilon: 어떤 카테고리도 이 비율 이하로 내려가지 않음
const GAMMA = 0.95  // 시간 감쇠율 (0.95 = 매일 5%씩 감소)
const K     = 7     // 카테고리 수 (한식/중식/양식/분식/일식/디저트/기타)

const CATS = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타']

// ① 로짓 집계 노드에서 만든 맵 가져오기
const logitData    = $('로짓 집계').first().json
const logitMap     = logitData.logit_map      || {}
const updatedAtMap = logitData.updated_at_map || {}

// ② Temporal Decay 적용
//    오래된 피드백일수록 가중치를 줄임
//    예: 30일 전 피드백 → logit × 0.95^30 ≈ 21% 만 반영
const today = new Date()
const effectiveLogits = {}

CATS.forEach(cat => {
  const daysSince = updatedAtMap[cat]
    ? (today.getTime() - new Date(updatedAtMap[cat]).getTime()) / 86400000
    : 0
  effectiveLogits[cat] = (logitMap[cat] ?? 0) * Math.pow(GAMMA, daysSince)
})

// ③ Temperature Softmax 적용
//    점수 차이를 확률로 변환. T가 크면 분포가 평탄해짐.
let expSum = 0
const expMap = {}

CATS.forEach(cat => {
  expMap[cat] = Math.exp((effectiveLogits[cat] || 0) / T)
  expSum += expMap[cat]
})

// ④ Dirichlet Floor 적용
//    어떤 카테고리도 완전히 0%가 되지 않도록 최소값 보장
//    최소 확률 = ε/K ≈ 1.4%
const probs = {}
CATS.forEach(cat => {
  probs[cat] = (1 - EPS) * (expMap[cat] / expSum) + EPS / K
})

// ⑤ 식당에 점수 부여 후 정렬
//    restaurants.category는 Supabase text[] 배열이므로 첫 번째 값 사용
const restaurants = $input.first().json.restaurants || []

const sorted = [...restaurants]
  .map(r => ({
    ...r,
    _score: probs[(Array.isArray(r.category) ? r.category[0] : r.category) || '기타'] || (EPS / K)
  }))
  .sort((a, b) => b._score - a._score)  // 높은 점수 먼저

return [{ json: { restaurants: sorted } }]
```

3. 노드 이름 → `Softmax` 로 변경
4. `Softmax` 출력을 **`Decision`** 에 연결

---

## 1-5. 전체 흐름 확인

캔버스를 스크롤해서 아래 순서로 연결됐는지 육안으로 확인하세요.

```
취향 정리(Set)
    ↓
로짓 조회(Supabase - Get Many, user_preference_logits, Always Output Data ✅)
    ↓
로짓 집계(Code - 7개 row → 1개 map)
    ↓
식당1(Supabase - Get Many, restaurants)
    ↓
메뉴(Supabase - Get Many, menu_items)
    ↓
식당 메뉴 연동1(Code - 식당+메뉴 합치기)
    ↓
Softmax(Code - Temperature+Decay+Floor)
    ↓
Decision(AI Agent)
    ↓
...
```

---

## 1-6. 저장 및 활성화

1. 우측 상단 **Save** 클릭
2. 워크플로우 상태가 **Active** (초록 토글) 인지 확인
3. Inactive라면 토글 클릭해서 Active로 변경

---

## 🧪 테스트

### 사전 데이터 준비
```sql
-- Supabase SQL Editor에서 실행
-- test_user_001이 한식을 매우 좋아하는 상태로 설정
INSERT INTO user_preference_logits (user_id, category, logit, sample_count)
VALUES
  ('test_user_001', '한식',   3.5, 15),
  ('test_user_001', '분식',   2.1,  8),
  ('test_user_001', '양식',  -0.5,  2),
  ('test_user_001', '중식',   0.3,  3),
  ('test_user_001', '일식',   0.0,  0),
  ('test_user_001', '디저트', 0.0,  0),
  ('test_user_001', '기타',   0.0,  0)
ON CONFLICT (user_id, category)
DO UPDATE SET logit = EXCLUDED.logit;
```

### 추천 요청
```bash
POST http://n8n-host:5678/webhook/food
Content-Type: application/json

{
  "user_id": "test_user_001",
  "message": "오늘 점심 추천해줘",
  "location": "역삼동"
}
```

### 성공 기준
- 응답의 `restaurants` 배열 상위에 **한식** 카테고리 식당이 오면 성공
- 응답에 `_score` 필드가 붙어있으면 Softmax이 작동 중

---

## ✅ Step 1 체크리스트

```
[x] 취향 정리 → 식당1 사이에 로짓 조회 노드 삽입 (Always Output Data ✅)
[x] 로짓 집계 노드 추가 및 코드 적용
[x] 식당 메뉴 연동1 → Decision 사이에 Softmax 노드 삽입
[x] C: 응답 포맷 category 배열 → string 변환 처리
[x] 전체 연결 순서 확인
[x] 완료 (2026-05-18)
```

완료 → [Step 2: 피드백 로짓 업데이트](n8n_02_피드백_로짓.md) 진행
