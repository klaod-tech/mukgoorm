# ML 사용자 선호도 시스템

> 작성일: 2026-05-14
> 연관 문서: [CHARACTER_IMAGE_PLAN.md](CHARACTER_IMAGE_PLAN.md), [N8N_WEBHOOK_SPEC.md](N8N_WEBHOOK_SPEC.md)

---

## 1. 개요

사용자의 음식 선호도를 카테고리별 **로짓(logit) 벡터**로 표현하고,
피드백이 쌓일수록 **Softmax**로 변환한 확률 분포가 점점 선명해지는 구조로 개인화한다.

**데이터 수집 경로 3가지:**
1. **음식 이상형 월드컵** — 온보딩 시 초기 선호도 구축
2. **붐업/붐다운 피드백** — 추천 후 실시간 라벨링
3. **실제 메뉴 선택** — restaurant_log (이미 수집 중)

---

## 2. 핵심 원리: Softmax 기반 선호도 학습

### 왜 Softmax인가

단순 0~1 가중치와 Softmax의 차이:

```
[단순 가중치]  한식: 0.8  중식: 0.3  → 각 수치가 독립적, 학습할수록 차이가 선형으로만 커짐

[Softmax]     logit: [한식: 4.2, 중식: 0.8, 양식: 2.1, 분식: 3.1, 일식: 0.9, 디저트: 0.3]
                          ↓  exp(x_i) / Σ exp(x_j)
              확률:  [한식: 0.53, 중식: 0.02, 양식: 0.07, 분식: 0.20, 일식: 0.02, 디저트: 0.01]
```

**지수 함수 효과**: 로짓 차이가 클수록 확률 차이는 **폭발적으로** 커짐.
데이터가 쌓일수록 선호 카테고리가 확률 상위를 독점 → 추천이 점점 예리해짐.

### 학습 흐름

```
[초기 — 월드컵 직후]            [50회 피드백 후]           [200회 피드백 후]
한식:   0.35                    한식:   0.48               한식:   0.71
중식:   0.15                    중식:   0.12               중식:   0.03
양식:   0.14                    양식:   0.10               양식:   0.05
분식:   0.18                    분식:   0.20               분식:   0.14
일식:   0.10                    일식:   0.06               일식:   0.04
디저트: 0.05                    디저트: 0.03               디저트: 0.02
기타:   0.03                    기타:   0.01               기타:   0.01
```

초기엔 고르다가 → 점점 선호 카테고리로 확률이 집중됨.

---

## 3. 수학적 구조 (발표용)

### One-hot 인코딩
```
식당 카테고리 "한식" → x = [1, 0, 0, 0, 0, 0, 0]
식당 카테고리 "분식" → x = [0, 0, 0, 1, 0, 0, 0]
              카테고리:  한식 중식 양식 분식 일식 디저트 기타
```

### 사용자 로짓 벡터 (학습 파라미터)
```
θ = [θ_한식, θ_중식, θ_양식, θ_분식, θ_일식, θ_디저트, θ_기타]
    초기값: [0, 0, 0, 0, 0, 0, 0]  (중립)
```

### Softmax → 선호 확률
```
P(category_i | user) = exp(θ_i) / Σ_j exp(θ_j)
```

### 로짓 업데이트 (온라인 학습)
```
붐업(👍)  : θ_category += α  (α = 학습률)
붐다운(👎): θ_category -= α

→ 이는 Softmax Cross-Entropy Loss에 대한 온라인 SGD와 동일한 구조
```

### 추천 점수 계산
```
score(restaurant) = P(restaurant.category | user)   ← Softmax 확률
추천 순위 = score 내림차순 정렬
```

---

## 3-1. 편향 방지: 탐색-활용 균형 (Exploration vs Exploitation)

### 문제
Softmax를 순수하게 사용하면 인기 카테고리가 확률을 독점하고
비선호 카테고리는 0%에 수렴 → **필터 버블**: 같은 음식만 계속 추천됨.

또한 사람의 식욕은 날마다 달라지는데, 과거 피드백이 오늘 기분을 과도하게 지배하면 안 됨.

### 해결책 3계층

#### Layer 1 — Temperature Softmax (분포 과열 방지)
```
P(i) = exp(θ_i / T) / Σ_j exp(θ_j / T)

T = 1.0  →  학습된 그대로 (뾰족)
T = 2.0  →  분포가 평탄해져 다양성 증가
T = 0.5  →  분포가 더 극단적으로 (과적합 위험)
```

```
[T=1.0, 200회 피드백 후]       [T=2.0, 동일 데이터]
한식:   0.71  ← 독점           한식:   0.42  ← 선호하되 독점 아님
분식:   0.14                   분식:   0.21
양식:   0.05                   양식:   0.13
중식:   0.03                   중식:   0.09
기타:   0.07                   기타:   0.15  ← 가끔 다른 것도 추천
```

**우리 시스템**: T=1.5 고정 사용 (충분히 학습되면서 다양성 유지)

#### Layer 2 — 시간 감쇠 (Temporal Decay)
오래된 피드백은 오늘 기분에 영향을 덜 줘야 함.

```
effective_θ_i = Σ_t  feedback_t × γ^(days_since_t)

γ = 0.95  →  30일 전 피드백은 현재의 21%만 반영
γ = 0.90  →  30일 전 피드백은 현재의 4%만 반영
```

```
[어제 붐업한 한식]   가중치: 1.0  (100% 반영)
[1주 전 붐업]        가중치: 0.70
[1달 전 붐업]        가중치: 0.21
[3달 전 붐업]        가중치: 0.01  (거의 사라짐)
```

**우리 시스템**: γ = 0.95/day (약 2주가 "현재 기분"의 유효 반감기)

#### Layer 3 — 최소 확률 바닥 (Dirichlet Floor)
어떤 카테고리도 완전히 0%가 되지 않도록 보장.

```
P_final(i) = (1 - ε) × P_softmax(i) + ε × (1/K)

K = 카테고리 수 (7개)
ε = 0.1  →  최저 확률 = 10% × (1/7) ≈ 1.4%
```

어떤 카테고리든 최소 1.4% 확률은 유지 → 가끔 의외의 음식이 추천될 수 있음.

### 최종 점수 수식
```
1. 시간 감쇠 적용:  θ_eff = Σ feedback × γ^days
2. Temperature:    raw_prob = softmax(θ_eff / T)
3. Floor 적용:     P_final = (1 - ε) × raw_prob + ε/K
4. 추천 점수:      score(restaurant) = P_final[restaurant.category]
```

---

## 3-2. 컨텍스트 보너스 (이미 수집 중인 데이터 활용)

날씨·시간대 정보는 이미 webhook으로 들어오므로 추천 점수에 가산점을 줄 수 있음.

```javascript
// 컨텍스트 보너스 테이블
const CONTEXT_BONUS = {
  weather: {
    '비':  { '한식': +0.15, '일식': +0.10 },   // 비 오면 국물 음식
    '눈':  { '한식': +0.20 },                   // 눈 오면 따뜻한 한식
    '맑음': { '양식': +0.05, '디저트': +0.10 }, // 맑은 날 가벼운 음식
    '흐림': { '중식': +0.05 }
  },
  time_of_day: {
    '아침': { '디저트': +0.10, '양식': +0.05 }, // 아침엔 가벼운 것
    '점심': { '한식': +0.05, '분식': +0.05 },
    '저녁': { '한식': +0.10, '중식': +0.05 },  // 저녁엔 든든한 것
    '야식': { '분식': +0.15, '중식': +0.10 }
  }
}

// 최종 점수에 합산
score_final = P_final[category] + weather_bonus + time_bonus
```

**발표 포인트**: "이미 수집하고 있는 날씨·식사시간 데이터를 추천에도 활용합니다"

---

## 4. 로짓 업데이트 규칙

| 이벤트 | 업데이트 | 학습률 α | 이유 |
|--------|---------|---------|------|
| 월드컵 승리 | θ_winner += 0.5 | 0.5 | 초기 데이터, 강하게 반영 |
| 월드컵 탈락 | θ_loser -= 0.3 | 0.3 | 거부감은 조금 약하게 |
| 붐업 👍 | θ_category += 0.2 | 0.2 | 명시적 긍정 피드백 |
| 붐다운 👎 | θ_category -= 0.2 | 0.2 | 명시적 부정 피드백 |
| 메뉴 실제 선택 | θ_category += 0.1 | 0.1 | 행동 기반 약한 신호 |

> 로짓은 음수도 가능, 범위 제한 없음 — Softmax가 자동으로 정규화하므로 클리핑 불필요

---

## 5. DB 테이블

### 5-1. user_preference_logits (핵심 테이블)
```sql
CREATE TABLE user_preference_logits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  -- '한식' | '중식' | '양식' | '분식' | '일식' | '디저트' | '기타'
  logit        REAL NOT NULL DEFAULT 0.0,   -- 초기값 0 (중립)
  sample_count INTEGER DEFAULT 0,           -- 해당 카테고리 피드백 횟수
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, category)
);

-- 신규 유저 가입 시 7개 카테고리 전부 logit=0으로 INSERT
```

### 5-2. worldcup_sessions
```sql
CREATE TABLE worldcup_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  champion    TEXT NOT NULL,
  top4        TEXT[],
  rounds      JSONB NOT NULL,
  -- [{"round":1, "winner":"치킨", "loser":"피자",
  --   "winner_category":"분식", "loser_category":"양식"}, ...]
  completed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 5-3. food_feedback 확장
```sql
ALTER TABLE food_feedback ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_food_feedback_user_category
  ON food_feedback(user_id, category);
```

---

## 6. n8n 연동

### 6-1. 음식 추천 — 편향 방지 Softmax 정렬 (`취향 정리` 노드 수정)

```javascript
const TEMPERATURE = 1.5   // 분포 완화
const EPSILON     = 0.10  // 최소 확률 바닥
const GAMMA       = 0.95  // 시간 감쇠 (1일 단위)
const K           = 7     // 카테고리 수

const CONTEXT_BONUS = {
  weather: {
    '비':   { '한식': 0.15, '일식': 0.10 },
    '눈':   { '한식': 0.20 },
    '맑음': { '양식': 0.05, '디저트': 0.10 },
    '흐림': { '중식': 0.05 }
  },
  meal_type: {
    '아침': { '디저트': 0.10, '양식': 0.05 },
    '점심': { '한식': 0.05, '분식': 0.05 },
    '저녁': { '한식': 0.10, '중식': 0.05 },
    '야식': { '분식': 0.15, '중식': 0.10 }
  }
}

// ① 시간 감쇠 적용된 로짓 계산
const today = new Date()
const logits = $('user_preference_logits').all()
const logitMap = {}
logits.forEach(r => {
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

// ③ Dirichlet Floor 적용
const probs = {}
categories.forEach(cat => {
  probs[cat] = (1 - EPSILON) * (expMap[cat] / expSum) + EPSILON / K
})

// ④ 컨텍스트 보너스
const body = $('음식 추천 입력').item.json.body
const weather = body.weather ?? ''
const mealType = body.meal_type ?? ''
const weatherBonus = CONTEXT_BONUS.weather[weather] ?? {}
const mealBonus = CONTEXT_BONUS.meal_type[mealType] ?? {}

// ⑤ 식당 최종 점수 정렬
const restaurants = $('식당1').all()
return restaurants
  .map(r => {
    const cat = r.json.category
    const score = probs[cat] + (weatherBonus[cat] ?? 0) + (mealBonus[cat] ?? 0)
    return { ...r.json, score }
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 5)
  .map(r => ({ json: r }))
```

### 6-2. 피드백 처리 — 로짓 업데이트 (`/webhook/feedback` 노드 추가)

```javascript
// 피드백 수신 후 로짓 업데이트
const { user_id, category, feedback } = $input.item.json.body
const alpha = feedback === 'like' ? 0.2 : -0.2

// n8n Supabase 노드로:
// UPDATE user_preference_logits
// SET logit = logit + alpha,
//     sample_count = sample_count + 1,
//     updated_at = now()
// WHERE user_id = $user_id AND category = $category
```

### 6-3. 월드컵 완료 — 초기 로짓 설정 (신규 `POST /webhook/worldcup`)

```
월드컵 입력 → rounds 순회 →
  각 round마다:
    winner_category logit += 0.5
    loser_category  logit -= 0.3
→ worldcup_sessions 저장
→ 최종 로짓으로 Softmax 계산 → top_categories 응답
```

**Request:**
```json
{
  "user_id": "uuid",
  "champion": "치킨",
  "rounds": [
    { "winner": "치킨", "loser": "피자",
      "winner_category": "분식", "loser_category": "양식" }
  ]
}
```

**Response:**
```json
{
  "message": "선호도 분석 완료!",
  "top_categories": ["분식", "한식"],
  "softmax": { "분식": 0.42, "한식": 0.28, "양식": 0.12, ... }
}
```

---

## 7. React 연동

### 붐업/붐다운 버튼 (RestaurantCard)
```tsx
<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
  <button onClick={() => onFeedback(r, 'like')}>👍</button>
  <button onClick={() => onFeedback(r, 'dislike')}>👎</button>
</div>
```

**sendFeedback() 수정** — `category` 필드 추가:
```typescript
// web/src/lib/n8n.ts
export async function sendFeedback(params: {
  user_id: string
  restaurant_id: string
  food_name: string
  category: string    // ← 추가
  feedback: 'like' | 'dislike'
})
```

---

## 8. ML 발표 포인트

### 한 줄 설명
> "음식 카테고리를 One-hot 인코딩한 특징 벡터에, 사용자 피드백(라벨)으로 학습한
> 로짓을 Softmax 변환하여 개인화 추천 확률 분포를 만드는 온라인 학습 시스템"

### 발표 흐름
```
1. "월드컵에서 치킨을 계속 선택하면 '분식' 로짓이 올라갑니다"
2. "로짓을 Softmax에 통과시키면 카테고리별 선호 확률이 나옵니다"
3. "붐업/붐다운이 라벨 — 이게 쌓일수록 분포가 선호 카테고리로 집중됩니다"
4. (그래프) "하지만 한 카테고리가 독점하면 매일 같은 음식만 추천되죠"
5. "그래서 Temperature로 분포를 완화하고, 오래된 피드백은 감쇠시키고,
   모든 카테고리에 최소 확률을 보장해 다양성을 유지합니다"
6. "비 오는 날엔 국물 음식 보너스 — 이미 수집 중인 날씨 데이터도 활용합니다"
```

### 학술 용어 매핑 (교수님 질문 대비)
| 우리 시스템 | 학술 용어 |
|------------|---------|
| 카테고리 One-hot | 특징 벡터 (Feature vector) |
| 로짓 벡터 θ | 모델 파라미터 / 가중치 |
| 붐업=1 / 붐다운=0 | 이진 레이블 (Binary label) |
| 피드백마다 θ 업데이트 | 온라인 SGD (Stochastic Gradient Descent) |
| Softmax(θ / T) | Temperature-scaled 다항 로지스틱 회귀 |
| score = P(category\|user) | 추천 점수 (Relevance score) |
| 시간 감쇠 γ^days | 지수 이동 평균 (EMA) 가중치 |
| Floor ε/K 보장 | Dirichlet 사전 확률 / 라플라스 스무딩 |
| 컨텍스트 보너스 | 맥락적 특징 (Contextual feature) |
| 탐색-활용 균형 | Exploration-Exploitation Tradeoff |

---

## 9. 구현 우선순위

| 항목 | 우선순위 | 담당 | 비고 |
|------|---------|------|------|
| DB: `user_preference_logits` 테이블 생성 | ★★★ | 백엔드 | schemaV1.sql에 추가 |
| `/webhook/worldcup` n8n 구현 | ★★★ | n8n | 월드컵 완료 → 로짓 초기화 |
| `/webhook/feedback` 로짓 업데이트 추가 | ★★★ | n8n | 기존 webhook에 노드 추가 |
| `취향 정리` 노드 Softmax 정렬로 교체 | ★★☆ | n8n | 음식 추천 품질 직결 |
| 월드컵 UI (React) | ★★☆ | 프론트 | 신규 페이지 |
| 식당 카드 붐업/붐다운 버튼 | ★★☆ | 프론트 | RestaurantCard 수정 |
| 선호도 시각화 — Softmax 확률 그래프 | ★☆☆ | 프론트 | 발표 임팩트용 |
