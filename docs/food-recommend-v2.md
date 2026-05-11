# 음식 추천 v2 — 구조 및 ML 의도 분류

## 개요

기존 단일 웹훅 구조를 **3단계 인터랙션 흐름**으로 분리하고,  
GPT 대신 **DB 기반 의도 분류기**를 도입한 버전.

---

## 변경 전 vs 변경 후

| 항목 | v1 (기존) | v2 (변경) |
|---|---|---|
| 첫 응답까지 대기 | 10~17초 | 3~5초 |
| GPT 입력 토큰 | 10,000+ (메뉴 전체) | ~1,500 (식당 기본정보만) |
| 메뉴 조회 시점 | 추천과 동시에 전부 | 사용자가 식당 선택 후 1개만 |
| 의도 분류 주체 | 없음 (전부 GPT) | DB 매칭 (Phase 1) |
| 웹훅 수 | 1개 | 4개 |
| 학습 데이터 수집 | 없음 | intent_logs 테이블 |

---

## 전체 흐름

```
사용자 메시지
      │
      ▼
[1단계] POST /webhook/food
  키워드 추출 → 식당명 검색 → 메뉴명 검색 → 의도 분류(A/B/C)
      │
      ├─ A: 식당명 직접 언급 → 식당 1개 즉시 반환     (~0.5초)
      ├─ B: 메뉴명 직접 언급 → 해당 메뉴 가진 식당들  (~0.8초)
      └─ C: 일반 추천 요청  → GPT로 4개 추천         (~3~5초)
      │
  식당 카드 표시 + 경로 안내 문구 + intent_log_id 반환
      │
  (사용자가 식당 선택)
      │
      ▼
[2단계] POST /webhook/food/menu
  Input: { restaurant_id }
  → menu_items DB 조회 (해당 식당만, GPT 없음)
  → 메뉴 카드 반환                               (~0.3초)
      │
  (사용자가 메뉴 선택)
      │
      ▼
[3단계] POST /webhook/food/select
  Input: { user_id, restaurant_id, menu_name }
  → restaurant_log INSERT
  → 완료 응답                                    (~0.3초)

[피드백] POST /webhook/food/feedback
  Input: { intent_log_id, is_correct, true_path? }
  → intent_logs PATCH (ML 학습 데이터 누적)
```

---

## 의도 분류 경로 (A / B / C)

| 경로 | 조건 | 예시 입력 |
|---|---|---|
| **A** | 메시지에 DB 식당명 포함 | "온천식당 어때?" |
| **B** | 메시지에 DB 메뉴명 포함 | "탕수육 먹고싶어" |
| **C** | A, B 둘 다 해당 없음 | "뭐 먹을까?" / "매운거 추천해줘" |

판단 순서: A → B → C (순서대로 체크, 먼저 매칭되면 종료)

---

## ML 학습 구조 (3단계 진화)

### Phase 1 (현재 구현) — DB 매칭 + 피드백 수집
- Supabase `restaurants.name` ILIKE 검색 → A
- Supabase `menu_items.menu_name` ILIKE 검색 → B
- 분류 결과를 `intent_logs` 테이블에 저장
- 사용자 피드백(맞아/아니야)으로 `is_correct`, `true_path` 업데이트

### Phase 2 (데이터 50~100건 누적 후) — 임베딩 유사도
- 사용자 메시지를 OpenAI 임베딩으로 벡터화
- Supabase `pgvector`로 과거 정답 케이스와 코사인 유사도 비교
- 오타/줄임말("탕슉", "탕수욕") 대응 가능
- `intent_logs.embedding` 컬럼 활성화

### Phase 3 (데이터 500건+ 이후) — 경량 분류 모델
- 누적된 `intent_logs` 데이터로 scikit-learn 분류기 학습
- 한국어 형태소 분석 (konlpy 등) 포함
- 주기적 재학습 스크립트 → n8n HTTP 노드로 호출

---

## 파일 구조

```
n8n/
  food_recommend_v2.json   ← n8n 임포트 파일 (이 버전)
  food_recommend_v1.json   ← 구버전 (보관)
  ai_agent.json            ← 메인 멀티봇 워크플로우

scripts/
  migrations/
    create_intent_logs.sql ← intent_logs 테이블 생성 SQL

web/src/lib/
  n8n.ts                   ← 프론트엔드 API 함수
```

---

## n8n 워크플로우 노드 목록 (food_recommend_v2.json)

### /webhook/food (메인 추천 흐름)
| 순서 | 노드명 | 역할 |
|---|---|---|
| 1 | 음식 추천 입력 | Webhook 진입점 |
| 2 | 키워드 추출 | 불용어 제거 후 핵심 키워드 추출 |
| 3 | 유저 정보 | Supabase users 조회 |
| 4 | 취향 정리 | food_preferences, allergies 추출 |
| 5 | 식당명 검색 | restaurants ILIKE 검색 |
| 6 | 메뉴명 검색 | menu_items ILIKE 검색 |
| 7 | 의도 분류 | A/B/C 결정, 경로 설명 생성 |
| 8 | 경로 분기 | Switch 노드 |
| A-1 | A: 응답 포맷 | 식당 1개 포맷팅 |
| A-2 | A: 의도 로그 저장 | intent_logs INSERT |
| A-3 | A: 음식 추천 출력 | Webhook 응답 |
| B-1 | B: 식당 상세 조회 | 메뉴 보유 식당 상세 조회 |
| B-2 | B: 응답 포맷 | 식당 목록 포맷팅 |
| B-3 | B: 의도 로그 저장 | intent_logs INSERT |
| B-4 | B: 음식 추천 출력 | Webhook 응답 |
| C-1 | C: 식당 목록 조회 | 전체 식당 조회 (메뉴 제외) |
| C-2 | C: 식당 데이터 정리 | GPT용 슬림 데이터 |
| C-3 | C: GPT 추천 | AI Agent (소용량 프롬프트) |
| C-4 | C: OpenAI 모델 | gpt-4o-mini |
| C-5 | C: 응답 파싱 | GPT 출력 파싱 |
| C-6 | C: 의도 로그 저장 | intent_logs INSERT (id 반환) |
| C-7 | C: 로그ID 병합 | intent_log_id 응답에 포함 |
| C-8 | C: 음식 추천 출력 | Webhook 응답 |

### /webhook/food/menu
| 노드명 | 역할 |
|---|---|
| 메뉴 조회 입력 | restaurant_id 수신 |
| 메뉴 목록 조회 | menu_items 조회 |
| 메뉴 응답 포맷 | 응답 정리 |
| 메뉴 출력 | Webhook 응답 |

### /webhook/food/select
| 노드명 | 역할 |
|---|---|
| 메뉴 선택 입력 | 선택 정보 수신 |
| 방문 기록 저장 | restaurant_log INSERT |
| 선택 완료 출력 | Webhook 응답 |

### /webhook/food/feedback
| 노드명 | 역할 |
|---|---|
| 피드백 입력 | 피드백 수신 |
| 피드백 저장 | intent_logs PATCH |
| 피드백 완료 출력 | Webhook 응답 |

---

## 프론트엔드 API (web/src/lib/n8n.ts)

```ts
// 1단계: 음식 추천
const result = await recommendFood({ user_id, message, location })
// result.path: 'A' | 'B' | 'C'
// result.description: "온천식당을 바로 찾았어요!"
// result.restaurants: Restaurant[]
// result.intent_log_id: 피드백용 ID (C경로만)

// 2단계: 메뉴 조회
const menus = await fetchRestaurantMenu({ restaurant_id })

// 3단계: 선택 기록
await selectFood({ user_id, restaurant_id, menu_name })

// ML 피드백
await submitIntentFeedback({ intent_log_id, is_correct: false, true_path: 'B' })
```

---

## DB 테이블: intent_logs

```sql
id            UUID PRIMARY KEY
message       TEXT              -- 원본 사용자 메시지
keyword       TEXT              -- 추출된 핵심 키워드
predicted_path TEXT             -- A / B / C
path_description TEXT           -- 경로 설명 문구
is_correct    BOOLEAN           -- 사용자 피드백 (NULL = 피드백 없음)
true_path     TEXT              -- 실제 의도 경로 (틀렸을 때)
user_id       TEXT
embedding     VECTOR(1536)      -- Phase 2 활성화 시 사용
created_at    TIMESTAMPTZ
```

---

## n8n 임포트 방법

1. n8n 대시보드 → Workflows → Import
2. `n8n/food_recommend_v2.json` 선택
3. OpenAI 크레덴셜 연결 (`C: OpenAI 모델` 노드)
4. 워크플로우 활성화 (Active ON)
5. Supabase에서 `create_intent_logs.sql` 실행
