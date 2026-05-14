# 먹구름(mukgoorm) — 팀 기술 개요서

> **버전**: React 웹앱 (웹 마이그레이션 완료)
> **GitHub**: https://github.com/klaod-tech/mukgoorm
> **최종 업데이트**: 2026-05-14
> **브랜치**: `feat/web-migration`

---

## 1. 프로젝트 소개

### 한 줄 요약

> 음식 이상형 월드컵으로 취향을 수집하고, AI가 개인화된 음식을 추천하는 **라이프스타일 관리 웹 앱**.

### 핵심 철학

```
"기록은 습관이고, 습관은 캐릭터에 녹아든다."

유저가 꾸준히 기록할수록 ML 모델이 정교해지고,
붐업/붐다운 피드백이 쌓일수록 추천이 개인화된다.
```

### 핵심 설계 원칙

| # | 원칙 |
|---|------|
| 1 | **hp/hunger/mood 수치 직접 노출 금지** — 이미지+대사로만 간접 표현 |
| 2 | **날씨는 별도 알림 없음** — 이미지 자동 교체로만 전달 |
| 3 | **각 기능은 자신이 소유한 DB 테이블에만 INSERT/UPDATE** |

---

## 2. 기술 스택

| 항목 | 내용 |
|------|------|
| 언어 | TypeScript |
| 프레임워크 | React (Vite) |
| 인증/DB | Supabase (Auth + PostgreSQL) |
| AI | OpenAI GPT-4o-mini |
| 자동화/ML | n8n (워크플로우 + Softmax 학습 파이프라인) |
| HTTP | axios |
| 날씨 | 기상청 공공데이터 API |
| 지도 | 카카오 좌표 API |

---

## 3. 전체 아키텍처

```
브라우저 (React 웹앱)
  │
  ├── Supabase Auth      — 이메일 로그인 · 세션 · RLS (유저별 완전 격리)
  ├── Supabase DB        — 모든 데이터 CRUD
  ├── GPT-4o-mini        — 메시지 의도 분류 · 봇 응답 합성 · 자연어 처리
  │
  └── n8n (로컬 localhost:5678)
        ├── /webhook/weather    날씨 조회 + 저장
        ├── /webhook/meal       식사 기록
        ├── /webhook/diary      일기 저장/수정
        ├── /webhook/schedule   일정 저장/수정
        ├── /webhook/weight     체중 기록
        ├── /webhook/email      이메일 요약
        ├── /webhook/food       음식 추천 (A/B/C + Softmax 정렬)
        ├── /webhook/feedback   붐업/붐다운 → 로짓 업데이트
        └── /webhook/worldcup   월드컵 완료 → 초기 선호도 설정
```

### 메시지 처리 흐름

```
유저 채팅 입력
  → GPT-4o-mini: 의도 분류 (날씨/식사/일기/일정/체중/이메일/음식추천)
  → 음식추천: recommendFood() 별도 호출
  → 나머지: dispatchToWebhooks() 병렬 호출
  → GPT-4o-mini: 봇 응답 합성
  → 채팅창 렌더링 (말풍선 + 식당/날씨 카드)
```

---

## 4. ML 선호도 시스템

### 데이터 수집 경로

1. **음식 이상형 월드컵** — 온보딩 시 16강 토너먼트로 초기 선호도 구축
2. **붐업/붐다운** — 추천 카드에서 실시간 피드백 라벨링
3. **실제 메뉴 선택** — `restaurant_log` 테이블 (약한 신호)

### Softmax 학습 구조

```
카테고리 One-hot 인코딩 (한식/중식/양식/분식/일식/디저트/기타)
  → 로짓 벡터 θ (Supabase user_preference_logits 테이블)
  → 피드백마다 θ += ±α (온라인 SGD)
  → Temperature Softmax(θ / T) → 확률 분포
  → 시간 감쇠 × Dirichlet Floor × 컨텍스트 보너스
  → 추천 점수로 식당 정렬
```

### 편향 방지 3계층

| 계층 | 방법 | 역할 |
|------|------|------|
| Temperature (T=1.5) | Softmax 온도 조절 | 한 카테고리 독점 방지 |
| 시간 감쇠 (γ=0.95/day) | 오래된 피드백 가중치 감소 | 오늘 기분 반영 |
| Dirichlet Floor (ε=0.1) | 최소 확률 보장 | 어떤 카테고리도 0% 방지 |

→ 상세: [ML_PREFERENCE_SYSTEM.md](ML_PREFERENCE_SYSTEM.md)

---

## 5. 페이지 구조

| 경로 | 설명 | 데이터 소스 |
|------|------|------------|
| `/login` | 이메일 로그인/회원가입 | Supabase Auth |
| `/onboarding` | 최초 프로필 설정 → 월드컵 이동 | Supabase |
| `/worldcup` | 16강 음식 이상형 월드컵 | n8n /webhook/worldcup |
| `/` | AI 비서 채팅 메인 | GPT + n8n 복수 webhook |
| `/meal` | 식사 기록 조회 | Supabase meal_log |
| `/weight` | 체중 관리 | Supabase weight_log |
| `/weather` | 날씨 기록 | Supabase weather_log |
| `/schedule` | 일정 (완료 체크 포함) | Supabase schedule |
| `/diary` | 일기 목록 | Supabase diary |
| `/email` | 이메일 요약 목록 | Supabase email_log |
| `/report` | 주간 통계 대시보드 | Supabase 복수 테이블 |
| `/settings` | 프로필 수정 · 월드컵 재도전 | Supabase |

---

## 6. DB 테이블 현황

| 테이블 | 역할 |
|--------|------|
| `users` | 유저 프로필, 설정, 신체정보, 시간 설정 |
| `tamagotchi` | hp / hunger / mood 상태 |
| `meal_log` | 식사 기록 (음식명, 칼로리) |
| `weight_log` | 체중 기록 |
| `schedule` | 일정 (제목, 날짜, 완료 여부) |
| `diary` | 일기 + AI 요약 |
| `weather_log` | 날씨 기록 |
| `email_log` | 이메일 요약 기록 |
| `restaurants` | 음식점 목록 |
| `menu_items` | 음식점 메뉴 |
| `restaurant_log` | 유저 메뉴 선택 이력 (ML 데이터) |
| `food_feedback` | 붐업/붐다운 피드백 |
| `intent_logs` | 음식 추천 A/B/C 분류 로그 |
| `user_preference_logits` | Softmax 학습 파라미터 ← **ML 핵심** |
| `worldcup_sessions` | 월드컵 진행 기록 |

---

## 7. n8n 워크플로우 현황

| webhook | 상태 | 담당 |
|---------|------|------|
| /weather | ✅ 완료 | n8n |
| /meal | ✅ 완료 | n8n |
| /diary | ✅ 완료 | n8n |
| /schedule | ✅ 완료 | n8n |
| /weight | ✅ 완료 | n8n |
| /food (A/B/C 경로) | ✅ 완료 | n8n |
| /email | ⚠️ 미연동 | n8n |
| /feedback (로짓 업데이트) | ⏳ 구현 대기 | n8n ([가이드](guide/n8n_ml_nodes.md)) |
| /worldcup | ⏳ 구현 대기 | n8n ([가이드](guide/n8n_ml_nodes.md)) |
| /food (Softmax 정렬) | ⏳ 구현 대기 | n8n ([가이드](guide/n8n_ml_nodes.md)) |

---

## 8. 캐릭터 이미지 시스템

### 현재 이미지 (11종, `web/public/`)

| 파일 | 상황 |
|------|------|
| `cube.png` | 월드컵 미완료 또는 완료 후 24시간 이내 |
| `normal.png` | 기본 상태 |
| `cheer.png` | 기분 좋음 (mood > 70) |
| `smile.png` | 평온 (mood > 50) |
| `eat.png` | 방금 식사함 (hunger > 80) |
| `tired.png` | 배고픔 / HP 위험 |
| `upset.png` | 매우 배고픔 |
| `rainy.png` | 비 오는 날 |
| `snow.png` | 눈 오는 날 |
| `hot.png` | 무더운 날 |
| `warm.png` | 따뜻한 날 |

### AI 생성 이미지 계획

월드컵 완료 + 24시간 후 → AI 생성 이미지로 교체 예정.  
현재는 발표용 기존 이미지 사용.  
→ 상세: [CHARACTER_IMAGE_PLAN.md](CHARACTER_IMAGE_PLAN.md)

---

## 9. 발표 포인트

### ML 설명 (한 문장)
> "음식 카테고리를 One-hot 인코딩한 특징 벡터에 사용자 피드백 라벨로 학습한 로짓을 Softmax 변환하여, 편향 없이 개인화된 추천 확률 분포를 만드는 온라인 학습 시스템"

### 학술 용어 매핑

| 우리 시스템 | 학술 용어 |
|------------|---------|
| 카테고리 One-hot | 특징 벡터 (Feature vector) |
| 로짓 벡터 θ | 모델 파라미터 |
| 붐업=1 / 붐다운=0 | 이진 레이블 (Binary label) |
| θ 업데이트 | 온라인 SGD |
| Softmax(θ/T) | Temperature-scaled 다항 로지스틱 회귀 |
| 시간 감쇠 | 지수 이동 평균 (EMA) |
| Floor ε/K | Dirichlet 사전 확률 |
| 날씨/시간 보너스 | 맥락적 특징 (Contextual feature) |
| 탐색-활용 균형 | Exploration-Exploitation Tradeoff |
