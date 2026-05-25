# 먹구름 프로젝트 셋업 가이드

> 이 문서를 읽는 사람(또는 Claude Code)이 처음 이 프로젝트를 받았을 때,
> 아무것도 없는 상태에서 전체 시스템을 실행할 수 있도록 작성된 지침서입니다.

---

## 프로젝트 소개

React 웹앱 + n8n 자동화 워크플로우 + Supabase DB로 구성된 AI 챗봇 시스템입니다.

- 사용자가 React 채팅창에 메시지를 입력하면 n8n 웹훅으로 전달
- n8n이 의도를 분류해 날씨 / 식사 / 일기 / 일정 / 체중 / 이메일 / 음식추천을 각각 처리
- 처리 결과를 React로 반환해 화면에 출력
- 음식 취향은 Softmax ML로 학습 (월드컵 → 로짓 누적 → 추천에 반영)
- AI 캐릭터(먹구름)는 OpenAI 이미지 생성으로 유저별 커스터마이징

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19 + TypeScript + Vite |
| 백엔드 자동화 | n8n (로컬 또는 Railway) |
| 데이터베이스 | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4o-mini, gpt-image-1 |
| 배포 | Railway (선택) |

---

## 사전 요구사항

아래 항목이 설치되어 있어야 합니다.

- **Node.js** 18 이상 (`node -v`로 확인)
- **npm** (`npm -v`로 확인)
- **n8n** 로컬 설치 (`npm install -g n8n`)
- **Supabase 계정** (supabase.com)
- **OpenAI API 키** (platform.openai.com)
- **카카오 개발자 계정** (날씨 기능용, developers.kakao.com)
- **공공데이터포털 API 키** (날씨 기능용, data.go.kr)

---

## 1단계 — Supabase 설정

### 1-1. 프로젝트 생성

1. supabase.com → 새 프로젝트 생성
2. 프로젝트 설정 → API에서 아래 두 값 복사해두기
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`

### 1-2. 테이블 생성

Supabase → SQL Editor에서 `supabase/schema_all.sql` 파일 내용 전체를 붙여넣고 실행합니다.

생성되는 테이블:

| 테이블 | 용도 |
|--------|------|
| `users` | 유저 프로필 (이름, 지역, 식사시간, 이메일 정보 등) |
| `diary` | 일기 기록 |
| `schedule` | 일정 기록 |
| `meal_log` | 식사 기록 |
| `weight_log` | 체중 기록 |
| `weather_log` | 날씨 조회 기록 |
| `email_log` | 이메일 요약 기록 |
| `restaurants` | 식당 정보 |
| `menu_items` | 메뉴 항목 |
| `restaurant_log` | 식당 추천 기록 |
| `food_feedback` | 음식 피드백 (like/dislike) |
| `user_preference_logits` | Softmax ML 카테고리별 선호도 |
| `worldcup_sessions` | 음식 월드컵 결과 |
| `character_generations` | AI 캐릭터 생성 상태 |
| `chat_logs` | 채팅 로그 |

> ⚠️ `tamagotchi` 테이블은 현재 미사용입니다. 생성하지 않아도 됩니다.

### 1-3. Storage 버킷 생성

Supabase → Storage → New bucket:

| 항목 | 값 |
|------|-----|
| Name | `character-images` |
| Public | ✅ On |

### 1-4. Auth 설정

Supabase → Authentication → Providers → **Email** 활성화 (기본값으로 켜져 있음)

---

## 2단계 — 환경변수 설정

`web/` 폴더 안에 `.env.local` 파일 생성:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_OPENAI_API_KEY=sk-...
```

> ⚠️ `.env.local`은 `.gitignore`에 포함되어 있어 Git에 올라가지 않습니다.

---

## 3단계 — React 웹앱 실행

```bash
cd web
npm install
npm run dev
```

`http://localhost:5173`에서 확인합니다.

> n8n이 실행되지 않은 상태에서는 채팅 기능이 작동하지 않습니다.
> 로그인 / 온보딩 / 월드컵 화면은 n8n 없이도 확인 가능합니다.

---

## 4단계 — n8n 설치 및 실행

### 4-1. n8n 및 이메일 패키지 설치

```bash
npm install -g n8n imap mailparser
```

### 4-2. 환경변수 설정 후 실행

```bash
NODE_FUNCTION_ALLOW_EXTERNAL=imap,mailparser n8n start
```

`http://localhost:5678`에서 n8n 대시보드 접속.

> `.env` 파일 사용 시 아래 한 줄 추가 후 `n8n start`:
> ```
> NODE_FUNCTION_ALLOW_EXTERNAL=imap,mailparser
> ```

### 4-3. 워크플로우 가져오기

n8n 대시보드 → **Workflows** → **Import from file**

`n8n/n8nV6.json` 파일 선택 후 Import.

---

## 5단계 — n8n Credentials 설정

워크플로우를 가져온 뒤 아래 Credentials를 등록해야 합니다.

### Supabase

n8n → Credentials → Add → `Supabase`:

| 항목 | 값 |
|------|-----|
| Host | `https://xxxxxxxxxxxxxxxx.supabase.co` |
| Service Role Secret | Supabase → 설정 → API → `service_role` 키 |

### OpenAI

n8n → Credentials → Add → `OpenAI`:

| 항목 | 값 |
|------|-----|
| API Key | `sk-...` |

### 기상청 API

n8n → Credentials → Add → `HTTP Query Auth`:

| 항목 | 값 |
|------|-----|
| Name | `기상청 API` |
| Name (Query param) | `serviceKey` |
| Value | 공공데이터포털에서 발급받은 serviceKey |

아래 4개 노드 각각에 적용:
`초단기실황` / `최저최고기온` / `측정소` / `미세먼지`

각 노드에서:
1. Authentication → `Predefined Credential Type`
2. Credential Type → `HTTP Query Auth` → `기상청 API` 선택
3. 기존 `serviceKey` 파라미터 항목 삭제

### 카카오 API

n8n → Credentials → Add → `HTTP Header Auth`:

| 항목 | 값 |
|------|-----|
| Name | `카카오 API` |
| Name (Header) | `Authorization` |
| Value | `KakaoAK {카카오 앱 REST API 키}` |

`카카오 좌표` 노드에 적용:
1. Authentication → `Predefined Credential Type`
2. HTTP Header Auth → `카카오 API` 선택
3. 기존 `Authorization` 헤더 항목 삭제

---

## 6단계 — 네이버 메일 IMAP 활성화 (이메일 기능 사용 시)

이메일 기능을 네이버 메일로 사용하는 경우 IMAP을 활성화해야 합니다.

네이버 메일 → 환경설정 → POP3/IMAP 설정 → **IMAP 사용함** 체크

> Gmail은 기본적으로 IMAP이 활성화되어 있습니다.

---

## 7단계 — 실행 확인

1. n8n 실행 중인지 확인 (`http://localhost:5678`)
2. 워크플로우가 **Active** 상태인지 확인
3. React 앱 실행 (`npm run dev`)
4. 회원가입 → 온보딩 → 월드컵 완료 후 채팅 테스트

---

## Railway 배포 (선택)

로컬에서 작동 확인 후 Railway에 n8n을 배포할 때 아래 작업이 필요합니다.

### Dockerfile 생성

프로젝트 루트에 `Dockerfile` 생성:

```dockerfile
FROM n8nio/n8n:latest
USER root
RUN npm install -g imap mailparser
USER node
```

### Railway 환경변수

Railway 프로젝트 → Variables 탭:

| Key | Value |
|-----|-------|
| `NODE_FUNCTION_ALLOW_EXTERNAL` | `imap,mailparser` |
| `N8N_HOST` | Railway에서 발급된 도메인 |
| `WEBHOOK_URL` | `https://{Railway 도메인}/` |

### Credentials 재등록

Railway 배포 후 5단계의 Credentials를 새로 등록해야 합니다.
Credentials는 인스턴스 DB에 암호화 저장되므로 로컬 설정이 이전되지 않습니다.

---

## 트러블슈팅

| 증상 | 확인 사항 |
|------|-----------|
| 채팅이 응답 없음 | n8n 실행 여부 / 워크플로우 Active 여부 |
| 날씨가 안 나옴 | 기상청·카카오 Credentials 적용 여부 / 유저 프로필에 city·village 값 여부 |
| 이메일 기능 오류 | `NODE_FUNCTION_ALLOW_EXTERNAL` 환경변수 설정 여부 / 네이버 IMAP 활성화 여부 / 앱 비밀번호 확인 (일반 비밀번호 아님) |
| 음식 추천 안 됨 | Supabase `restaurants` / `menu_items` 테이블에 데이터 여부 |
| AI 캐릭터가 큐브 고정 | 월드컵 완료 여부 / `character_generations` 테이블 status 확인 / OpenAI API 잔액 확인 |
| `Cannot find module 'imap'` | `npm install -g imap mailparser` 후 n8n 재시작 |

---

## 파일 구조

```
mukgoorm/
├── web/                    # React 웹앱
│   ├── src/
│   │   ├── pages/          # 각 화면 (Home, Worldcup, Diary 등)
│   │   ├── lib/            # n8n 연동, Supabase, ML 유틸
│   │   └── hooks/          # useUser 등
│   └── public/foods/       # 음식 이미지 (70개+)
├── n8n/
│   ├── n8nV6.json          # 최신 워크플로우 (IMAP 이메일 기능 포함)
│   └── n8nV5.json          # 이전 버전
├── supabase/               # DB 스키마
├── scripts/                # 유틸 스크립트 (이미지 생성 등)
├── docs/                   # 상세 문서
├── SETUP.md                # 이 파일 (셋업 지침서)
└── Notebook.md             # 작업 목록 (개인용)
```
