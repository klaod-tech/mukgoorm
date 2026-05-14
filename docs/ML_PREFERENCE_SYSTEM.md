# ML 사용자 선호도 시스템

> 작성일: 2026-05-14
> 연관 문서: [CHARACTER_IMAGE_PLAN.md](CHARACTER_IMAGE_PLAN.md), [N8N_WEBHOOK_SPEC.md](N8N_WEBHOOK_SPEC.md)

---

## 1. 개요

사용자의 음식 선호도를 카테고리별 가중치 벡터로 표현하고,
이를 지속적으로 학습시켜 음식 추천 품질을 개인화한다.

**데이터 수집 경로 3가지:**
1. **음식 이상형 월드컵** — 온보딩 시 초기 선호도 구축
2. **붐업/붐다운 피드백** — 추천 후 실시간 라벨링
3. **실제 메뉴 선택** — restaurant_log (이미 수집 중)

---

## 2. 선호도 벡터 구조 (One-Hot 기반 가중치)

### 카테고리 정의
```python
CATEGORIES = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타']
# 인덱스:       0      1      2      3      4       5      6
```

### 사용자 선호도 벡터
```json
{
  "user_id": "uuid",
  "weights": {
    "한식":   0.85,
    "중식":   0.30,
    "양식":   0.60,
    "분식":   0.75,
    "일식":   0.40,
    "디저트": 0.20,
    "기타":   0.10
  },
  "sample_count": 47
}
```

- 각 값: 0.0 ~ 1.0 (0 = 싫어함, 1 = 매우 좋아함)
- 초기값: 0.5 (중립) → 월드컵으로 첫 조정 → 피드백으로 누적 학습

### 가중치 업데이트 규칙 (온라인 학습)

| 이벤트 | 변화량 | 학습률 |
|--------|--------|--------|
| 월드컵 선택 (승리) | +0.15 | 초기 학습이라 크게 |
| 월드컵 탈락 | -0.10 | |
| 붐업 (👍) | +0.08 | 사용 중 피드백 |
| 붐다운 (👎) | -0.08 | |
| 실제 메뉴 선택 | +0.05 | 행동 기반 약한 신호 |

```
new_weight = old_weight + (delta * (1 - |old_weight - 0.5| * 0.5))
```
> 0이나 1에 가까울수록 변화폭이 작아지는 감쇠 적용 — 극단값에 고착되는 것 방지

---

## 3. 선형 모델: 추천 점수 계산

### 식당 카테고리 벡터
```json
{
  "restaurant_id": "uuid",
  "category": "한식",
  "sub_tags": ["국밥", "찌개", "구이"]
}
```

### 추천 점수 (내적 계산)
```
score(user, restaurant) = user.weights[restaurant.category]
                        + Σ(tag_bonus for matching sub_tags)
```

n8n `취향 정리` 노드에서 이 점수를 계산하여 상위 N개 식당을 필터링.

---

## 4. DB 테이블 추가

### 4-1. user_preference_weights (핵심 테이블)
```sql
CREATE TABLE user_preference_weights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category     TEXT NOT NULL,   -- '한식', '중식', '양식', '분식', '일식', '디저트', '기타'
  weight       REAL NOT NULL DEFAULT 0.5,
  sample_count INTEGER DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, category)
);

-- 초기 데이터: 신규 유저 가입 시 모든 카테고리 0.5로 INSERT
```

### 4-2. worldcup_sessions (월드컵 진행 기록)
```sql
CREATE TABLE worldcup_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  champion    TEXT NOT NULL,
  top4        TEXT[],
  rounds      JSONB NOT NULL,   -- [{winner, loser, round}, ...]
  completed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- rounds JSONB 예시:
-- [
--   {"round": 1, "winner": "치킨", "loser": "피자",
--    "winner_category": "분식", "loser_category": "양식"},
--   ...
-- ]
```

### 4-3. food_feedback 테이블 확장
```sql
-- 기존 food_feedback에 category 컬럼 추가
ALTER TABLE food_feedback ADD COLUMN IF NOT EXISTS category TEXT;

-- 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_food_feedback_user_category
  ON food_feedback(user_id, category);
```

---

## 5. n8n 연동 계획

### 5-1. 음식 추천 흐름에 선호도 반영 (`/webhook/food`)

현재 흐름:
```
음식 추천 입력 → 키워드 추출 → 유저 정보1 → 취향 정리 → 식당1 → ...
```

변경 후:
```
음식 추천 입력 → 키워드 추출 → 유저 정보1
                                     ↓
                           user_preference_weights 조회  ← [추가]
                                     ↓
                              취향 정리 (가중치 포함)    ← [수정]
                                     ↓
                        식당 목록 × 선호도 점수 정렬     ← [추가]
                                     ↓
                              상위 5개 식당 출력
```

**`취향 정리` 노드에서 할 일:**
```javascript
// 현재 유저 선호도 벡터 로드
const prefs = $('user_preference_weights').all()
const weightMap = {}
prefs.forEach(p => { weightMap[p.json.category] = p.json.weight })

// 식당 목록에 점수 부여
const restaurants = $('식당1').all()
const scored = restaurants.map(r => ({
  ...r.json,
  score: (weightMap[r.json.category] ?? 0.5)
}))

// 점수 내림차순 정렬 후 상위 5개
return scored
  .sort((a, b) => b.score - a.score)
  .slice(0, 5)
  .map(r => ({ json: r }))
```

### 5-2. 피드백 반영 (`/webhook/feedback`)

**현재**: food_feedback 테이블에 like/dislike 저장만 함

**변경 후**: 저장 + user_preference_weights 즉시 업데이트

```javascript
// n8n Code 노드 추가
const { user_id, category, feedback } = $input.item.json.body
const delta = feedback === 'like' ? 0.08 : -0.08

// Supabase에서 현재 가중치 조회 후 업데이트
// (n8n Supabase 노드로 처리)
```

### 5-3. 월드컵 완료 후 초기 가중치 설정 (신규 webhook)

**새 webhook**: `POST /webhook/worldcup`

```json
// Request
{
  "user_id": "uuid",
  "rounds": [
    { "winner": "치킨", "loser": "피자", "winner_category": "분식", "loser_category": "양식" },
    { "winner": "치킨", "loser": "삼겹살", "winner_category": "분식", "loser_category": "한식" }
  ],
  "champion": "치킨"
}

// Response
{
  "message": "선호도 분석 완료!",
  "top_categories": ["분식", "한식", "일식"],
  "weights": { "분식": 0.75, "한식": 0.65, ... }
}
```

---

## 6. React 연동

### 6-1. 월드컵 페이지 (`/worldcup`)
- 온보딩 완료 후 자동 진입 OR 설정에서 재도전 가능
- 16강 브래킷 UI
- 완료 시 `/webhook/worldcup` POST → 가중치 초기화

### 6-2. 붐업/붐다운 버튼
음식 추천 카드에 추가:

```tsx
// RestaurantCard 컴포넌트에 추가
<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
  <button onClick={() => onFeedback(r, 'like')}>👍</button>
  <button onClick={() => onFeedback(r, 'dislike')}>👎</button>
</div>
```

피드백 payload:
```json
{
  "user_id": "uuid",
  "restaurant_id": "uuid",
  "food_name": "가게명",
  "category": "한식",
  "feedback": "like"
}
```

현재 `sendFeedback()` 함수에 `category` 필드만 추가하면 됨.

---

## 7. ML 발표 포인트 정리

### 이게 ML인 이유
- **특징(Feature)**: 음식 카테고리 → One-hot 인코딩
  ```
  [한식=1, 중식=0, 양식=0, 분식=0, 일식=0, 디저트=0, 기타=0]
  ```
- **레이블(Label)**: 붐업=1, 붐다운=0 (유저가 직접 라벨링)
- **모델**: 카테고리별 가중치 = 선형 회귀 계수와 동일한 역할
- **학습**: 피드백마다 가중치 업데이트 = 온라인 경사하강법(SGD) 단순화 버전
- **예측**: `score = weight · category_vector` = 내적 = 선형 분류기

### 발표 멘트 흐름
```
1. "사용자가 음식을 고를 때마다 데이터가 쌓입니다"
2. "카테고리를 One-hot 인코딩하면 특징 벡터가 됩니다"
3. "붐업/붐다운이 라벨 — 모델이 이걸로 학습합니다"
4. "결과적으로 다음 추천에서 선호 카테고리 식당이 앞에 나옵니다"
5. "데이터가 쌓일수록 개인화가 정확해집니다"
```

---

## 8. 구현 우선순위

| 항목 | 우선순위 | 담당 | 비고 |
|------|---------|------|------|
| DB 테이블 생성 (위 SQL) | ★★★ | 백엔드 | schemaV1.sql에 추가 |
| `/webhook/worldcup` n8n 구현 | ★★★ | n8n | 월드컵 완료 → 가중치 초기화 |
| `/webhook/feedback` 가중치 업데이트 추가 | ★★★ | n8n | 기존 webhook에 노드 추가 |
| 음식추천 `취향 정리` 노드 개선 | ★★☆ | n8n | 가중치 기반 정렬 |
| 월드컵 UI (React) | ★★☆ | 프론트 | Onboarding.tsx 또는 신규 페이지 |
| 식당 카드 붐업/붐다운 버튼 | ★★☆ | 프론트 | RestaurantCard 수정 |
| 가중치 시각화 (설정 페이지) | ★☆☆ | 프론트 | "내 음식 취향" 그래프 |
