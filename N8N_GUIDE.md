# n8n 연동 지침서

> 이 문서는 React 프론트엔드의 구조 변경 사항을 n8n 담당자에게 전달하기 위한 지침입니다.

---

## 1. React 프론트엔드 변경 사항

### 이전 구조
```
유저 메시지
  → POST /webhook/main (n8n이 모든 AI 분류·처리 담당)
  → React에 단일 응답 반환
```

### 변경된 구조
```
유저 메시지
  → [React] GPT-4o-mini 분류 (classifyMessage)
  → [React] 해당 카테고리 webhook만 병렬 호출 (dispatchToWebhooks)
  → [n8n]   각 webhook 워크플로우 독립 실행 및 응답
  → [React] GPT-4o-mini로 응답 합성 (synthesizeResponse)
  → 유저에게 자연스러운 단일 답변 + 카드 렌더링
```

**핵심 변경**: AI 분류 및 응답 합성은 React가 담당합니다. n8n은 각 카테고리별 실제 데이터 처리(저장, 조회, 외부 API 호출)에만 집중하면 됩니다.

---

## 2. React에 삽입된 AI 기능 (n8n에서 제거할 것)

| 기능 | 설명 |
|---|---|
| **메시지 분류** | GPT-4o-mini로 카테고리 판별 (날씨/식사/일기/일정/체중/이메일/음식추천) |
| **복합 의도 처리** | 여러 카테고리 동시 감지 → 해당 webhook 병렬 호출 |
| **응답 합성** | 여러 n8n 응답을 먹구름 말투로 자연스럽게 합쳐서 유저에게 전달 |

→ **n8n의 기존 메인 AI Agent 노드는 제거해도 됩니다.**

---

## 3. n8n 진행 목록

### ✅ 할 일 1: 기존 AI Agent 제거
- `/webhook/main` 워크플로우 안의 GPT 분류·합성 노드 제거
- React가 이 역할을 대신하기 때문에 중복 불필요
- `/webhook/main` 자체도 더 이상 사용하지 않음

### ✅ 할 일 2: Webhook을 7개로 분리

아래 경로로 각각 독립 워크플로우를 만들어 주세요:

| 경로 | 역할 |
|---|---|
| `POST /webhook/weather` | 날씨·미세먼지 조회 후 응답 |
| `POST /webhook/diary` | 일기 Supabase 저장 |
| `POST /webhook/schedule` | 일정 Supabase 저장 |
| `POST /webhook/meal` | 식사 기록 Supabase 저장 |
| `POST /webhook/weight` | 체중 기록 Supabase 저장 |
| `POST /webhook/email` | 이메일 확인 및 요약 |
| `POST /webhook/food` | 맛집 추천 (외부 검색 또는 DB) |

---

## 4. React → n8n 요청 형식 (공통)

모든 webhook이 동일한 형식의 POST body를 받습니다:

```json
{
  "user_id": "유저 UUID",
  "message": "유저가 입력한 원본 메시지",
  "date": "2026-05-09",
  "is_future": false,
  "location": "장소 또는 빈 문자열",
  "message_past": "과거 내용 요약",
  "message_future": "미래 내용 요약"
}
```

---

## 5. n8n → React 응답 형식

각 webhook 워크플로우의 **Respond to Webhook** 노드에서 아래 형식으로 응답해야 합니다.

### 기본 (모든 webhook 공통)
```json
{
  "message": "처리 결과 한 문장"
}
```
> React의 합성 AI가 이 `message`를 받아서 자연스러운 답변으로 가공합니다.
> 따라서 딱딱한 시스템 메시지여도 괜찮습니다. (예: "일정이 저장되었습니다.")

### 음식추천 webhook 추가 필드
```json
{
  "message": "차이나타운 맛집 찾아봤어!",
  "restaurants": [
    {
      "food_name": "공화춘",
      "location": "인천 중구 차이나타운로",
      "category": "중식",
      "reason": "짜장면 원조 맛집",
      "rating": 4.5,
      "link": "https://map.kakao.com/..."
    }
  ]
}
```

### 날씨 webhook 추가 필드
```json
{
  "message": "오늘 서울 날씨 가져왔어!",
  "weather": {
    "description": "맑음",
    "temp": 22,
    "humidity": 55,
    "wind_speed": 3.2,
    "pm10": 35,
    "condition": "good"
  }
}
```

---

## 6. 응답 처리 흐름 요약

```
n8n /webhook/schedule  → { message: "일정 저장됐어요." }
n8n /webhook/food      → { message: "맛집 찾았어요!", restaurants: [...] }

React 합성 AI:
  → "내일 인천 차이나타운 일정 넣었어! 맛집도 찾아봤어 👇"

React UI:
  → 텍스트 말풍선 (합성 결과)
  → 맛집 카드 (restaurants 배열)
  → [일정] [음식추천] 분류 뱃지
```

---

## 7. 주의사항

- 각 webhook은 **15초 이내**로 응답해야 합니다 (React 타임아웃 설정)
- 응답 실패해도 React는 나머지 webhook 응답으로 정상 처리합니다 (`Promise.allSettled`)
- n8n 워크플로우는 반드시 **Publish(Active)** 상태여야 `/webhook/` 경로로 응답합니다
- 테스트 중에만 `/webhook-test/` 사용 (n8n 에디터에서 Listen 상태일 때만 작동)
