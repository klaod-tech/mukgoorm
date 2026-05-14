# 먹구름 (mukgoorm)

> 나만의 AI 미소녀 캐릭터와 함께하는 라이프스타일 관리 웹 애플리케이션

음식·체중·날씨·일정·이메일·일기를 기록하면, 캐릭터가 이미지와 대사로 오늘의 상태를 간접 전달한다.  
음식 이상형 월드컵으로 수집한 선호도를 **Softmax 기반 온라인 학습**으로 음식 추천에 반영한다.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | React (Vite) + TypeScript |
| 인증 / DB | Supabase (Auth + PostgreSQL) |
| AI | OpenAI GPT-4o-mini |
| 자동화 / ML | n8n (워크플로우 + Softmax 학습 파이프라인) |
| 날씨 | 기상청 공공데이터 API |

---

## 주요 기능

| 기능 | 상태 |
|------|------|
| 채팅 기반 AI 비서 (홈) | ✅ 완료 |
| 음식 이상형 월드컵 (온보딩) | ✅ 완료 |
| 큐브 → 캐릭터 진화 시스템 | ✅ 완료 |
| 음식 추천 A/B/C 경로 | ✅ n8n 완료 |
| 붐업/붐다운 → ML 학습 | ✅ React 완료 / n8n 연결 대기 |
| Softmax 선호도 정렬 | ⏳ n8n 팀원 작업 중 |
| 식사 기록 뷰 | ✅ 완료 |
| 체중 관리 뷰 | ✅ 완료 |
| 날씨 뷰 | ✅ 완료 |
| 일정 뷰 | ✅ 완료 |
| 일기 뷰 | ✅ 완료 |
| 이메일 모니터링 뷰 | ✅ 완료 |
| 주간 리포트 | ✅ 완료 |
| 설정 | ✅ 완료 |

---

## 로컬 실행

```bash
cd web
npm install
cp .env.example .env.local  # 환경변수 입력
npm run dev
```

### 필요한 환경변수 (`.env.local`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=
VITE_N8N_BASE_URL=http://localhost:5678
```

### n8n 실행

```bash
# n8n 로컬 실행 (포트 5678)
npx n8n
# 워크플로우: n8n/AI 비서 v3.json 임포트
```

---

## 아키텍처

```
브라우저 (React 웹앱)
  │
  ├── Supabase Auth      — 로그인 · 세션 · 유저별 데이터 격리
  ├── Supabase DB        — 데이터 CRUD
  ├── GPT-4o-mini        — 메시지 분류 · 봇 응답 합성
  │
  └── n8n (로컬 or 클라우드)
        ├── 날씨 / 식사 / 일기 / 일정 / 체중 / 이메일 webhook
        ├── 음식 추천 (A/B/C 경로 + Softmax 정렬)
        └── ML 선호도 학습 (피드백 → 로짓 업데이트)
```

### 메시지 처리 흐름

```
유저 입력
  → GPT-4o-mini 의도 분류 (React)
  → 해당 n8n webhook 병렬 호출
  → GPT-4o-mini 응답 합성 (React)
  → 채팅창 렌더링
```

---

## ML 선호도 시스템

음식 이상형 월드컵 → 붐업/붐다운 피드백 → Softmax 확률 분포로 추천 정렬

- **학습**: 피드백마다 카테고리별 로짓 업데이트 (온라인 SGD)
- **추론**: Temperature Softmax + 시간 감쇠 + Dirichlet Floor + 날씨/시간대 컨텍스트 보너스
- **편향 방지**: 한 카테고리 독점 방지 · 오래된 피드백 감쇠 · 최소 확률 보장

→ 상세: [docs/ML_PREFERENCE_SYSTEM.md](docs/ML_PREFERENCE_SYSTEM.md)

---

## DB 마이그레이션

```bash
# Supabase SQL Editor에서 순서대로 실행
supabase/schemaV1.sql   # 기본 테이블
supabase/schemaV2.sql   # ML 선호도 테이블 (worldcup_sessions, user_preference_logits)
```

---

## 페이지 구조

| 경로 | 설명 |
|------|------|
| `/login` | 로그인 · 회원가입 |
| `/onboarding` | 최초 프로필 설정 |
| `/worldcup` | 음식 이상형 월드컵 |
| `/` | AI 비서 채팅 (메인) |
| `/meal` | 식사 기록 |
| `/weight` | 체중 관리 |
| `/weather` | 날씨 기록 |
| `/schedule` | 일정 |
| `/diary` | 일기 |
| `/email` | 이메일 모니터링 |
| `/report` | 주간 리포트 |
| `/settings` | 설정 · 월드컵 재도전 |

---

## 문서

| 파일 | 설명 |
|------|------|
| [docs/ML_PREFERENCE_SYSTEM.md](docs/ML_PREFERENCE_SYSTEM.md) | Softmax ML 선호도 시스템 설계 |
| [docs/CHARACTER_IMAGE_PLAN.md](docs/CHARACTER_IMAGE_PLAN.md) | AI 캐릭터 이미지 생성 기획 |
| [docs/N8N_WEBHOOK_SPEC.md](docs/N8N_WEBHOOK_SPEC.md) | n8n webhook API 계약서 |
| [docs/guide/n8n_ml_nodes.md](docs/guide/n8n_ml_nodes.md) | n8n ML 노드 구현 가이드 (팀원용) |
| [docs/CRAWLING_AUTOMATION.md](docs/CRAWLING_AUTOMATION.md) | 음식점 데이터 크롤링 |
| [docs/TEAM_OVERVIEW.md](docs/TEAM_OVERVIEW.md) | 팀 기술 개요서 |
| [docs/legacy/](docs/legacy/) | Python Discord 봇 v3.2 문서 (아카이브) |

---

## 브랜치

| 브랜치 | 설명 |
|--------|------|
| `feat/web-migration` | React 웹앱 (현재 개발) |
| `main` | 최신 안정 버전 |
| `develop` | Python Discord 봇 v3.2 (레거시, 아카이브) |
