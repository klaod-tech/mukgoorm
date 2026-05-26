# AI 개인 비서 - 현황 정리
> 최종 업데이트: 2026-05-09

---

## 1. 전체 아키텍처

```
유저 입력
  → [React] GPT-4o mini 메시지 분류
  → [React] 해당 webhook 병렬 호출 (Promise.allSettled)
  → [n8n] 각 카테고리별 데이터 처리
  → [React] GPT-4o mini 응답 합성
  → UI 렌더링 (말풍선 + 카드)
```

---

## 2. n8n Webhook 구성 (8개)

| Webhook | Path | 역할 |
|---|---|---|
| 날씨 입력 | `/webhook/weather` | 날씨 조회 및 weather_log 저장 |
| 일기 입력 | `/webhook/diary` | 일기 등록/수정 (diary 테이블) |
| 일정 감지 | `/webhook/schedule` | 일정 등록/수정 (schedule 테이블) |
| 식사 입력 | `/webhook/meal` | 식사 기록 (meal_log 테이블) |
| 체중 관리 입력 | `/webhook/weight` | 체중 기록 (weight_log 테이블) |
| 이메일 입력 | `/webhook/email` | 이메일 조회 및 email_log 저장 |
| 음식 추천 입력 | `/webhook/food` | 맛집 추천 및 restaurant_log 저장 |
| 피드백 | `/webhook/feedback` | 음식 추천 피드백 저장 (미구현) |

---

## 3. React → n8n 요청 형식 (공통)

```json
{
  "user_id": "유저 UUID",
  "message": "원본 메시지",
  "date": "2026-05-09",
  "is_future": false,
  "location": "장소 또는 빈 문자열",
  "message_past": "과거 내용 요약",
  "message_future": "미래 내용 요약"
}
```

### 일기/일정 추가 필드
```json
{
  "is_update": true  // 기존 데이터 수정 시 true, 신규 등록 시 false
}
```

---

## 4. n8n → React 응답 형식

### 공통
```json
{
  "message": "처리 결과 한 문장"
}
```

### 날씨 webhook
```json
{
  "message": "오늘 서울 날씨 가져왔어!",
  "weather": {
    "temperature": 22,
    "low_temperature": 9,
    "high_temperature": 24,
    "sky": "맑음",
    "rain": "없음",
    "humidity": 55,
    "windSpeed": 3.2,
    "pm10": 28,
    "pm25": 13,
    "pm10_grade": "좋음",
    "pm25_grade": "좋음"
  }
}
```

### 음식추천 webhook
```json
{
  "message": "맛집 찾았어!",
  "recommendations": [
    {
      "restaurant_id": "uuid",
      "food_name": "가게이름",
      "category": "카테고리",
      "location": "주소",
      "description": "가게 설명",
      "phone": "전화번호",
      "link": "링크",
      "reason": "추천 이유"
    }
  ]
}
```

### 피드백 webhook (React → n8n)
```json
{
  "user_id": "test_user_001",
  "restaurant_id": "uuid",
  "food_name": "가게명",
  "feedback": "like"  // "like" 또는 "dislike"
}
```

---

## 5. n8n 각 Webhook 내부 흐름

### 날씨
```
날씨 입력 → Edit Fields(city/village) → 카카오 좌표
  → Code in JavaScript3(좌표 변환)
  → 최저최고기온 / 초단기실황 / 측정소 → 미세먼지
  → Merge1 → Code in JavaScript4(데이터 정제)
  → WeatherBOT → 새 날씨 등록 → 날씨 출력
```

### 일기
```
일기 입력 → 일기(Supabase 조회)
  → 정보 수정 여부3(is_update 판별)
  → 새 일기 등록 / 기존 일기 수정 → 일기 출력
```

### 일정
```
일정 감지 → 일정(Supabase 조회) → ScheduleBOT
  → 정보 수정 여부4(is_update 판별)
  → 새 일정 등록 / 기존 일정 수정 → 일정 출력
```

### 식사
```
식사 입력 → 식사(users 조회) → Edit Fields2 → MealBOT
  → 새 식사 등록 → 식사 출력
```

### 체중
```
체중 관리 입력 → 체중 관리(users 조회) → Edit Fields5 → WeightManageBOT
  → 체중 관리 등록 → 체중 관리 출력
```

### 이메일
```
이메일 입력 → 이메일(users 조회) → Edit Fields1 → EmailBOT
  → 새 이메일 등록 → 이메일 출력
```

### 음식추천
```
음식 추천 입력 → 유저 정보(users 조회) → Edit Fields6
  → 식당(restaurants 조회) → 식당 메뉴 연동(Code)
  → 메뉴(menu_items 조회) → FoodRecommend
  → 배열 출력(Code) → Loop Over Items
  → 추천된 가게 등록(restaurant_log) → 가게 출력
```

### 피드백 (미구현)
```
피드백 → Create a row6(food_feedback) → [Respond to Webhook 미연결]
```

---

## 6. Supabase 테이블 구성

| 테이블 | 역할 |
|---|---|
| `users` | 유저 기본 정보, 선호도, 알러지, 이메일 설정 |
| `diary` | 일기 기록 |
| `schedule` | 일정 관리 |
| `meal_log` | 식사 기록 |
| `weight_log` | 체중 기록 (매번 insert, 히스토리 누적) |
| `weather_log` | 날씨 기록 |
| `email_log` | 이메일 기록 |
| `restaurants` | 가게 정보 (팀원 입력) |
| `menu_items` | 메뉴 정보 (팀원 입력) |
| `restaurant_log` | 음식 추천 기록 (ML 학습용) |
| `food_feedback` | 음식 추천 피드백 (좋아요/싫어요) |

---

## 7. React ↔ n8n 조율 필요 사항

### ① 일기/일정 충돌 처리 (React 담당)
- React가 Supabase에서 직접 오늘 일기/일정 조회
- 충돌 감지 시 팝업: "이미 있어요. 덮어쓸까요?"
- 확인 시 `is_update: true` 달아서 webhook 재호출
- n8n은 `is_update` 플래그만 보고 등록/수정 분기

### ② 날씨 webhook 요청 시 city/village 포함 필요
React에서 날씨 webhook 호출 시 body에 반드시 포함:
```json
{
  "city": "아산시",
  "village": "탕정면"
}
```
n8n의 `날씨` Supabase 조회 노드가 제거되었으므로 React에서 직접 전달해야 함

### ③ 음식추천 피드백 버튼
- 추천 카드에 👍/👎 버튼 배치
- 클릭 시 `/webhook/feedback` POST 호출
- body: `{ user_id, restaurant_id, food_name, feedback: "like"/"dislike" }`
- 현재 n8n 피드백 webhook에 Respond to Webhook 미연결 → 구현 시 추가 필요

### ④ 일정 캘린더 UI
- React가 Supabase `schedule` 테이블 직접 조회
- 캘린더에 일정 렌더링
- 충돌 감지는 React에서 처리

### ⑤ meal_type 전달
음식추천 webhook 호출 시 현재 시간 기반으로 meal_type 포함 권장:
```json
{
  "meal_type": "점심"  // 아침/점심/저녁/간식
}
```

### ⑥ 응답 타임아웃
- 날씨 webhook: 외부 API 5개 순차 호출 → 최대 15초
- 음식추천 webhook: AI + Loop 4회 → 최대 20초
- React에서 webhook별 타임아웃 설정 필요

---

## 8. 현재 미완성 항목

| 항목 | 상태 | 비고 |
|---|---|---|
| 피드백 Respond to Webhook | ❌ 미연결 | 구현 시 추가 |
| restaurant_log ML 컬럼 | ⚠️ 팀원 테이블 확인 후 조정 | restaurant_id FK |
| 음식추천 실제 데이터 | ❌ 팀원 입력 대기 | restaurants/menu_items |
| Railway 배포 | ❌ 미진행 | 로컬 연동 완성 후 진행 |

---

## 9. 테스트 계정

```
user_id: test_user_001
webhook base URL: http://localhost:5678/webhook/
```
