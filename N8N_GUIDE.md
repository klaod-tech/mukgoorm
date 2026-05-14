# n8n 연동 지침서

> 최종 업데이트: 2026-05-13
> 전체 webhook 테스트 완료 (Postman 기준)

---

## 1. 전체 아키텍처

```
유저 메시지
  → [React] GPT-4o-mini 분류 (classifyMessage)
  → [React] 해당 카테고리 webhook 병렬 호출 (dispatchToWebhooks)
  → [n8n]   각 webhook 워크플로우 독립 실행 및 응답
  → [React] GPT-4o-mini로 응답 합성 (synthesizeResponse)
  → 유저에게 자연스러운 단일 답변 + 카드 렌더링
```

**핵심**: n8n은 데이터 처리(저장·조회·외부 API)만 담당. AI 분류·응답 합성은 React 담당.

---

## 2. Webhook 목록 및 상태

| 경로 | 역할 | 상태 |
|---|---|---|
| `POST /webhook/weather` | 날씨·미세먼지 조회 + Supabase 저장 | ✅ 완료 |
| `POST /webhook/meal` | 식사 기록 Supabase 저장 | ✅ 완료 |
| `POST /webhook/diary` | 일기 Supabase 저장 | ✅ 완료 |
| `POST /webhook/schedule` | 일정 Supabase 저장 | ✅ 완료 |
| `POST /webhook/weight` | 체중 기록 Supabase 저장 | ✅ 완료 |
| `POST /webhook/food` | 음식 추천 A/B/C 경로 | ✅ 완료 |
| `POST /webhook/email` | 이메일 확인 및 요약 | 미연동 |
| `POST /webhook/feedback` | 음식 추천 피드백 (like/dislike) | ✅ 완료 |

---

## 3. React → n8n 요청 형식

### 공통 필드
```json
{
  "user_id": "유저 UUID",
  "message": "유저가 입력한 원본 메시지",
  "date": "2026-05-13",
  "is_future": false,
  "location": "장소 또는 빈 문자열",
  "message_past": "과거 내용 요약",
  "message_future": "미래 내용 요약"
}
```

### 음식추천 전용
```json
{
  "user_id": "유저 UUID",
  "message": "짬뽕 먹고 싶어",
  "location": "아산",
  "date": "2026-05-13"
}
```
> `recommendFood()` 함수에서 별도 호출. date 필드 반드시 포함할 것.

---

## 4. n8n → React 응답 형식

### 날씨
```json
{
  "message": "오늘 탕정 날씨 확인했어!",
  "weather": {
    "city": "아산",
    "temperature": 22,
    "low_temperature": 15,
    "high_temperature": 26,
    "sky": "맑음",
    "rain": "없음",
    "humidity": 55,
    "windSpeed": 3.2,
    "pm10": 35,
    "pm25": 18,
    "pm10_grade": "좋음",
    "pm25_grade": "좋음",
    "condition": "좋음",
    "dust_level": "좋음"
  }
}
```

### 음식추천 (A/B/C 공통)
```json
{
  "path": "A | B | C",
  "description": "경로 설명",
  "message": "한 줄 요약",
  "restaurants": [
    {
      "restaurant_id": "uuid",
      "food_name": "가게이름",
      "category": ["한식"],
      "location": "주소",
      "description": "설명",
      "phone": "전화번호",
      "link": "링크",
      "reason": "추천 이유"
    }
  ],
  "keyword": "추출 키워드",
  "user_id": "유저 UUID"
}
```

### 그 외 (식사·일기·일정·체중)
```json
{
  "message": "처리 결과 한 문장"
}
```

---

## 5. 음식추천 A/B/C 경로 상세

### A경로 — 식당 직접 지목
- 트리거: 메시지에 DB 내 식당 이름이 포함된 경우
- 흐름: 식당 조회 → 해당 식당 메뉴 조회 → 응답

### B경로 — 메뉴명으로 식당 검색
- 트리거: 특정 음식명 언급 ("짬뽕 먹고 싶어")
- Decision 노드 프롬프트에 `{{ $('음식 추천 입력').item.json.body.message }}` 명시 필수
- 흐름: 키워드로 메뉴 검색 → 해당 식당 정보 → 응답

### C경로 — 취향 기반 추천
- 트리거: 막연한 추천 요청 ("오늘 뭐 먹지?")
- 흐름:
  1. `식당1` → 전체 식당 조회 (is_active=true)
  2. `5개 출력` Code 노드 → 취향 매칭 2개 + 완전 랜덤 3개 선택
  3. `메뉴1` → 선택된 5개 식당의 메뉴 조회
  4. `Food` AI 에이전트 → 취향/알레르기 기반 5개 추천
  5. `C: 응답 포맷` → 메뉴·알레르기·태그 enrichment
  6. `Split Out` → restaurants 배열을 개별 아이템으로 분리
  7. `Loop Over Items1` → 각 식당 restaurant_log에 저장 (루프 연결 필수)

#### 5개 출력 Code 노드
```javascript
const restaurants = $input.all();
const preferences = $('취향 정리').first().json.food_preferences || [];

const matched = restaurants.filter(r => {
  const cats = r.json.category || [];
  return cats.some(cat => preferences.includes(cat));
});
const unmatched = restaurants.filter(r => {
  const cats = r.json.category || [];
  return !cats.some(cat => preferences.includes(cat));
});

const shuffledMatched = matched.sort(() => Math.random() - 0.5);
const shuffledUnmatched = unmatched.sort(() => Math.random() - 0.5);

return [
  ...shuffledMatched.slice(0, 2).map(r => ({ json: { ...r.json, is_preferred: true } })),
  ...shuffledUnmatched.slice(0, 3).map(r => ({ json: { ...r.json, is_preferred: false } })),
];
```

#### C: 응답 포맷 Code 노드
```javascript
const raw = $input.first().json.output || '';
let parsed;
try {
  parsed = JSON.parse(raw);
} catch(e) {
  const match = raw.match(/```(?:json)?\n([\s\S]*?)\n```/);
  try {
    parsed = match ? JSON.parse(match[1]) : { message: '추천 결과를 봐요!', recommendations: [] };
  } catch(e2) {
    parsed = { message: '추천 결과봐요!', recommendations: [] };
  }
}

const allMenus = $('메뉴1').all();
const d = $('의도 분류').first().json;

const enriched = (parsed.recommendations || []).map(r => {
  const menus = allMenus.filter(m => m.json.restaurant_id === r.restaurant_id);
  return {
    ...r,
    menu_items_text: menus.map(m => m.json.menu_name).join(', ') || '정보 없음',
    allergens: [...new Set(menus.flatMap(m => m.json.allergens || []))].join(', ') || '정보 없음',
    matched_tags_text: [...new Set(menus.flatMap(m => m.json.tags || []))].join(', ') || '정보 없음',
  };
});

return [{ json: {
  path: 'C',
  description: d.description,
  message: parsed.message || '취향에 맞는 식당을 골랐어요!',
  restaurants: enriched,
  keyword: d.keyword,
  user_id: d.user_id,
} }];
```

---

## 6. restaurant_log 테이블 구조

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| user_id | text | 유저 ID |
| restaurant_id | uuid | 추천된 식당 ID |
| food_name | text | 식당 이름 |
| category | text | 식당 카테고리 (join) |
| location | text | 주소 |
| reason | text | 추천 이유 |
| menu_items | text | 해당 식당 메뉴 목록 (join) |
| allergens | text | 해당 식당 알레르기 정보 (join) |
| matched_tags | text | 해당 식당 태그 (join) |
| user_message | text | 유저 원본 메시지 |
| date | text | 추천 날짜 (yyyy-MM-dd, KST) |

> `menu_items`, `allergens`, `matched_tags` 컬럼은 **text 타입** (array 아님)

---

## 7. 날짜 처리 규칙

- n8n에서 날짜 기본값: `{{ $now.setZone('Asia/Seoul').format('yyyy-MM-dd') }}`
- Postman/React 모두 date 미포함 시 위 표현식으로 fallback
- Fallback 표현식: `{{ $('음식 추천 입력').item.json.body.date ?? $now.setZone('Asia/Seoul').format('yyyy-MM-dd') }}`

---

## 8. 주의사항

- 각 webhook은 **15초 이내** 응답 (음식추천 10초)
- Decision 노드 프롬프트에 실제 메시지 변수 명시 필수 (`{{ $('...입력').item.json.body.message }}`)
- Split Out → Loop 구조에서 **Loop 출력을 다시 Loop 입력에 연결**해야 전체 아이템 처리
- 배열 컬럼 insert 시 n8n Supabase 노드가 JSON 문자열로 변환하는 버그 있음 → text 컬럼 + join() 사용
- Publish(Active) 상태여야 `/webhook/` 경로 응답. 테스트 중엔 `/webhook-test/` 사용
