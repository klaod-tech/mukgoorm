# n8n 웹훅 제작 명세서

> 작성일: 2026-05-12  
> 대상: n8n 워크플로우 담당 팀원  
> 목적: 프론트엔드와의 계약 — 이 문서에 정의된 입출력 스펙을 반드시 지켜야 프론트가 정상 동작함

---

## 핵심 원칙

1. **응답 구조 변경 금지** — 필드명, 타입, 중첩 구조를 임의로 바꾸지 말 것. 추가는 괜찮음, 제거/변경은 사전 협의 필요
2. **필수 필드 누락 금지** — `(필수)` 표시된 필드가 없으면 프론트가 크래시됨
3. **항상 JSON 응답** — Content-Type: application/json, 에러 시에도 JSON으로 반환
4. **HTTP 상태코드 준수** — 성공 200, 클라이언트 오류 400, 서버 오류 500
5. **ML 데이터 반드시 저장** — `intent_logs`, `restaurant_log` INSERT는 선택이 아닌 필수

---

## 웹훅 목록

| 엔드포인트 | 역할 | 응답 시간 목표 |
|-----------|------|--------------|
| `POST /webhook/food` | 음식 추천 (1단계) | A/B: 1초 이내, C: 5초 이내 |
| `POST /webhook/food/menu` | 식당 메뉴 조회 (2단계) | 0.5초 이내 |
| `POST /webhook/food/select` | 메뉴 선택 기록 (3단계) | 0.5초 이내 |
| `POST /webhook/food/feedback` | ML 피드백 저장 | 0.5초 이내 |

---

## 1단계: POST /webhook/food

### Request Body

```json
{
  "user_id": "uuid-string",
  "message": "탕수육 먹고싶어",
  "location": "역삼동"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `user_id` | string | ✅ | Supabase Auth UID |
| `message` | string | ✅ | 유저 원본 메시지 |
| `location` | string | ❌ | 없으면 users.village 사용 |

### Response Body

```json
{
  "path": "B",
  "description": "탕수육을 파는 식당을 찾았어요!",
  "message": "탕수육 파는 곳 찾았어!",
  "keyword": "탕수육",
  "restaurants": [
    {
      "restaurant_id": "uuid-string",
      "food_name": "온천식당",
      "location": "역삼동 123-4",
      "category": "중식",
      "description": "바삭한 탕수육으로 유명한 동네 중식당",
      "phone": "02-1234-5678",
      "reason": "탕수육 메뉴 보유",
      "link": "https://map.naver.com/..."
    }
  ],
  "intent_log_id": "uuid-string"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `path` | "A"\|"B"\|"C" | ✅ | 의도 분류 경로 |
| `description` | string | ✅ | 경로 설명 (UI에 표시됨) |
| `message` | string | ✅ | 캐릭터 대사용 요약 |
| `keyword` | string | ✅ | 추출된 핵심 키워드 |
| `restaurants` | array | ✅ | 추천 식당 목록 (빈 배열 허용) |
| `intent_log_id` | string | ✅ | ML 피드백용 ID — **경로 무관하게 항상 반환** |

### restaurants 배열 각 항목

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `restaurant_id` | string | ✅ | restaurants 테이블 PK |
| `food_name` | string | ✅ | 식당 이름 |
| `location` | string | ✅ | 주소 |
| `category` | string | ✅ | 음식 카테고리 |
| `description` | string | ❌ | 식당 설명 |
| `phone` | string | ❌ | 전화번호 |
| `reason` | string | ❌ | 추천 이유 |
| `link` | string | ❌ | 지도 링크 |

### ML 데이터 저장 요구사항

이 웹훅이 호출될 때 반드시 `intent_logs` 테이블에 INSERT:

```sql
INSERT INTO intent_logs (
  id,           -- 응답의 intent_log_id와 동일한 UUID
  user_id,
  message,      -- 원본 유저 메시지
  keyword,      -- 추출된 키워드
  predicted_path, -- A/B/C
  path_description,
  is_correct,   -- NULL (피드백 전)
  true_path,    -- NULL (피드백 전)
  created_at
) VALUES (...)
```

---

## 2단계: POST /webhook/food/menu

### Request Body

```json
{
  "restaurant_id": "uuid-string"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `restaurant_id` | string | ✅ | 1단계에서 받은 식당 ID |

### Response Body

```json
{
  "restaurant_id": "uuid-string",
  "menus": [
    {
      "id": "uuid-string",
      "menu_name": "탕수육 (소)",
      "price": 12000,
      "description": "바삭한 튀김에 새콤달콤 소스",
      "tags": ["인기", "추천"],
      "allergens": ["밀", "대두"]
    },
    {
      "id": "uuid-string",
      "menu_name": "짜장면",
      "price": 8000,
      "description": null,
      "tags": null,
      "allergens": null
    }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `restaurant_id` | string | ✅ | |
| `menus` | array | ✅ | 빈 배열 허용 (메뉴 정보 없는 식당) |

### menus 배열 각 항목

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | menu_items 테이블 PK |
| `menu_name` | string | ✅ | 메뉴 이름 |
| `price` | number\|null | ✅ | 가격 (정보 없으면 null) |
| `description` | string\|null | ✅ | 메뉴 설명 |
| `tags` | string[]\|null | ✅ | 태그 목록 |
| `allergens` | string[]\|null | ✅ | 알레르기 유발 성분 |

---

## 3단계: POST /webhook/food/select

### Request Body

```json
{
  "user_id": "uuid-string",
  "restaurant_id": "uuid-string",
  "menu_name": "탕수육 (소)",
  "location": "역삼동",
  "tags": "중식,인기",
  "message": "탕수육 먹고싶어"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `user_id` | string | ✅ | |
| `restaurant_id` | string | ✅ | |
| `menu_name` | string | ✅ | 선택한 메뉴 이름 |
| `location` | string | ❌ | 유저 위치 |
| `tags` | string | ❌ | 메뉴 태그 (쉼표 구분) |
| `message` | string | ❌ | 원본 유저 메시지 |

### Response Body

```json
{
  "message": "기록했어!"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `message` | string | ✅ | 완료 메시지 |

### ML 데이터 저장 요구사항 ★★★ 가장 중요

이 웹훅이 핵심 ML 데이터를 쌓는 단계. 반드시 `restaurant_log` 테이블에 INSERT:

```sql
INSERT INTO restaurant_log (
  id,
  user_id,
  restaurant_id,
  menu_name,
  selected_at,
  location,
  tags
) VALUES (...)
```

`restaurant_log` 테이블 스키마:

```sql
CREATE TABLE restaurant_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id),
  menu_name      TEXT NOT NULL,
  selected_at    TIMESTAMPTZ DEFAULT now(),
  location       TEXT,
  tags           TEXT
);
```

> **왜 중요한가**: 이 테이블이 "이 유저가 실제로 무엇을 먹었는지"를 기록하는 유일한 소스.
> 유저 선호도 변화 추적, 협업 필터링, 개인화 추천 모두 이 테이블에서 시작됨.

---

## 피드백: POST /webhook/food/feedback

### Request Body

```json
{
  "intent_log_id": "uuid-string",
  "is_correct": false,
  "true_path": "B"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `intent_log_id` | string | ✅ | 1단계에서 받은 ID |
| `is_correct` | boolean | ✅ | 의도 분류가 맞았는지 |
| `true_path` | "A"\|"B"\|"C"\|null | ❌ | 틀렸을 때 실제 경로 |

### Response Body

```json
{
  "message": "피드백 저장 완료"
}
```

### 저장 요구사항

`intent_logs` 테이블 UPDATE:

```sql
UPDATE intent_logs
SET is_correct = $is_correct,
    true_path = $true_path
WHERE id = $intent_log_id
```

---

## 에러 응답 형식

모든 웹훅에서 에러 발생 시 동일한 형식으로 반환:

```json
{
  "error": "에러 원인 설명",
  "code": "NOT_FOUND"
}
```

| HTTP 상태코드 | 상황 |
|-------------|------|
| 200 | 성공 |
| 400 | 필수 필드 누락, 잘못된 입력 |
| 404 | restaurant_id 존재하지 않음 |
| 500 | n8n 내부 오류, DB 연결 실패 |

> **중요**: 에러 시 빈 응답 또는 HTML 반환 금지. 반드시 JSON 반환.

---

## DB 테이블 요구사항 체크리스트

n8n 제작 전 Supabase에서 아래 테이블이 존재하는지 확인:

```
[ ] restaurants         — 식당 목록 (restaurant_id, name, location, category, ...)
[ ] menu_items          — 메뉴 목록 (id, restaurant_id, menu_name, price, tags, allergens, ...)
[ ] intent_logs         — ML 학습 데이터 (id, user_id, message, keyword, predicted_path, is_correct, true_path, ...)
[ ] restaurant_log      — 유저 선택 이력 (id, user_id, restaurant_id, menu_name, selected_at, ...)
[ ] food_feedback       — 좋아요/싫어요 (기존 테이블, 유지)
```

---

## 테스트 체크리스트

워크플로우 완성 후 아래 시나리오 직접 테스트:

```
[ ] /webhook/food — A경로: 식당 이름 직접 입력 시 해당 식당 1개 반환
[ ] /webhook/food — B경로: 메뉴 이름 입력 시 해당 메뉴 보유 식당들 반환
[ ] /webhook/food — C경로: "뭐 먹을까?" 입력 시 GPT 추천 4개 반환
[ ] /webhook/food — 모든 경로에서 intent_log_id 반환됨
[ ] /webhook/food — Supabase intent_logs에 실제로 INSERT됐는지 확인
[ ] /webhook/food/menu — 유효한 restaurant_id로 menus 배열 반환
[ ] /webhook/food/menu — 메뉴 없는 식당은 빈 배열 반환 (에러 아님)
[ ] /webhook/food/select — 호출 후 restaurant_log에 실제로 INSERT됐는지 확인
[ ] /webhook/food/feedback — 호출 후 intent_logs의 is_correct가 업데이트됐는지 확인
[ ] 모든 웹훅 — user_id 누락 시 400 반환
[ ] 모든 웹훅 — 존재하지 않는 restaurant_id 사용 시 404 반환
```

---

## 변경이 필요할 때

웹훅 응답 구조를 바꿔야 하는 상황이 생기면:

1. 이 문서에 먼저 변경 내용 기록
2. 프론트엔드 담당자에게 사전 공유
3. 둘 다 준비된 후 동시 배포

**절대 하면 안 되는 것**: 기존 필드명 변경, 필수 필드 제거, 응답 구조 개편을 사전 공유 없이 단독으로 배포.
