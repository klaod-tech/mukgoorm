# 📋 Claude 시작 프롬프트

---

## 🐣 프로젝트 개요

디스코드에서 동작하는 **1인 1다마고치 봇**.
유저가 음식을 입력하면 다마고치에게 밥을 주는 행위로 연결되고,
**칼로리 관리와 날씨 정보를 수치가 아닌 캐릭터 이미지와 대사로 간접 전달**하는 게 핵심이야.

---

## 🛠️ 기술 스택

- Python 3.11+, discord.py
- OpenAI GPT-4o (칼로리 분석, 자연어 파싱, 대사 생성)
- Supabase (PostgreSQL) — psycopg2로 연결
- APScheduler (날씨 자동 갱신, 오후 10시 칼로리 판정)
- 기상청 공공데이터 API (날씨/기온)
- 에어코리아 API (PM10/PM2.5 미세먼지)

---

## 📁 현재 파일 구조 (v1.6 기준 — 전부 구현 완료)

```
Discord_Damagotchi/
├── bot.py                  # 봇 메인 진입점
├── cogs/
│   ├── onboarding.py       # 온보딩 + 쓰레드 생성
│   ├── summary.py          # 오늘 요약 버튼
│   ├── settings.py         # 설정 변경 버튼
│   ├── scheduler.py        # 오후 10시 칼로리 판정
│   └── weather.py          # 날씨 연동 + 자동 스케줄러
├── utils/
│   ├── gpt.py              # OpenAI API 래퍼
│   ├── db.py               # Supabase DB CRUD
│   ├── embed.py            # Embed UI + 버튼 4개 + 식사 Modal
│   └── image.py            # 상태별 이미지 선택 로직
├── images/                 # 다마고치 이미지 (~25종) ← 미완성
├── .env
└── requirements.txt
```

---

## 🗄️ DB 테이블 구조 (Supabase PostgreSQL)

### Users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | TEXT PK | 디스코드 유저 ID |
| tamagotchi_name | TEXT | 다마고치 이름 |
| city | TEXT | 거주 도시 (날씨 API 기준) |
| wake_time | TEXT HH:MM | 기상 시간 (날씨 알림 기준) |
| init_weight | REAL | 초기 체중 kg (변경 불가) |
| goal_weight | REAL | 목표 체중 kg |
| daily_cal_target | INTEGER | GPT 산출 권장 칼로리 |
| breakfast_time | TEXT HH:MM | 아침 알림 시간 |
| lunch_time | TEXT HH:MM | 점심 알림 시간 |
| dinner_time | TEXT HH:MM | 저녁 알림 시간 |
| thread_id | TEXT | 유저 전용 쓰레드 ID |
| created_at | TIMESTAMP | 생성 시각 |

### Tamagotchi
| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | TEXT PK | FK → Users |
| hp | INTEGER 0~100 | 건강 수치 (내부 전용) |
| hunger | INTEGER 0~100 | 배부름 수치 (내부 전용) |
| mood | INTEGER 0~100 | 기분 수치 (내부 전용) |
| current_image | TEXT | 현재 표시 이미지 파일명 |
| embed_message_id | TEXT | 쓰레드 내 Embed 메시지 ID |
| last_fed_at | TIMESTAMP | 마지막 식사 입력 시각 |
| updated_at | TIMESTAMP | 마지막 수치 업데이트 시각 |

### Meals
| 컬럼 | 타입 | 설명 |
|------|------|------|
| meal_id | SERIAL PK | auto increment |
| user_id | TEXT | FK → Users |
| meal_type | TEXT | 아침/점심/저녁/간식/식사 |
| food_name | TEXT | 음식명 |
| calories | INTEGER | 총 칼로리 kcal |
| protein | REAL | 단백질 g |
| carbs | REAL | 탄수화물 g |
| fat | REAL | 지방 g |
| fiber | REAL | 식이섬유 g |
| input_method | TEXT | text / photo |
| gpt_comment | TEXT | GPT 다마고치 한마디 (캐싱) |
| recorded_at | TIMESTAMP | 입력 시각 (소급 입력 시 해당 날짜로 저장) |

### Weather_Log
| 컬럼 | 타입 | 설명 |
|------|------|------|
| log_id | SERIAL PK | auto increment |
| user_id | TEXT | FK → Users |
| weather | TEXT | 맑음/비/눈/흐림 등 |
| temp | REAL | 기온 °C |
| pm10 | INTEGER | 미세먼지 μg/m³ |
| pm25 | INTEGER | 초미세먼지 μg/m³ |
| selected_image | TEXT | 선택된 이미지 파일명 |
| gpt_comment | TEXT | GPT 날씨 기반 대사 (캐싱) |
| recorded_at | TIMESTAMP | 수집 시각 |

---

## ✅ 구현 완료 기능

### bot.py
- 봇 메인 진입점
- `!setup` — #다마고치 채널에 시작하기 버튼 생성 (관리자)
- `!sync` — 슬래시 커맨드 수동 동기화 (봇 소유자)
- `!소환` — 내 쓰레드에 다마고치 Embed 재생성 (누구나)
- on_ready에서 `init_db()`, `bot.add_view(MainView())`, `bot.add_view(StartView())` 실행

### cogs/onboarding.py
- `OnboardingModal` (1단계 통합)
  - 입력 필드: 다마고치 이름 / 거주 도시 / 현재체중/목표체중(76/70 형태) / 성별/나이/키(남/25/175 형태) / 기상시간/식사알림(09:30 / 08:00,12:00,18:00 형태)
  - GPT-4o로 권장 칼로리 자동 계산
  - DB Users + Tamagotchi 저장
  - 전용 쓰레드 자동 생성 + 메인 Embed 전송
  - 온보딩 완료 시 `weather_cog.register_user_job(wake_time)` 자동 호출

### cogs/weather.py
- 기상청 초단기실황 API + 에어코리아 미세먼지 API 연동
- 도시명 → 격자 좌표(nx, ny) 자동 변환 (50개 도시 매핑)
- 유저 wake_time 기준 CronJob 자동 등록 (APScheduler)
- 매 10분마다 새 유저 스케줄러 자동 체크
- 기상 시간마다 날씨 Embed 쓰레드 전송 + 이미지 자동 교체
- `!weather` — 전체 유저 즉시 날씨 갱신 (관리자)
- `register_user_job(wake_time)` — 외부에서 즉시 Job 등록 가능

### cogs/scheduler.py
- 오후 10시 전체 유저 칼로리 자동 판정
  - 과식: total_cal > daily_cal_target → overfed.png
  - 소식: total_cal < daily_cal_target × 0.67 → underfed.png
  - 적정: 그 외 → 정상 이미지 유지
- 식사 기록 없으면 알림 메시지 전송

### cogs/summary.py
- 📊 오늘 요약 버튼 처리
- 총 칼로리 / 목표 칼로리 + 프로그레스 바
- 탄단지 비율
- 끼니별 내역 (아침/점심/저녁/간식)
- GPT 다마고치 한마디

### cogs/settings.py
- ⚙️ 설정 변경 버튼 처리
- 현재 값이 미리 채워진 `SettingsModal`
- 변경 가능: 다마고치 이름 / 거주 도시 / 기상시간+식사알림 / 목표 체중
- 이름 변경 시 쓰레드 이름 자동 갱신
- wake_time 변경 시 날씨 스케줄러 자동 재등록

### utils/embed.py
- `MealInputModal` — 🍽️ 식사 입력 버튼 처리
  - **자연어 입력** 방식: "어제 저녁에 치킨 먹었어" → GPT가 날짜/끼니/음식 자동 파싱
  - **합산 처리**: 같은 날 같은 끼니 여러 번 입력 시 칼로리 합산
  - **소급 입력**: 오늘/1일 전/2일 전 입력 가능
  - 소급 입력 시 아침+점심+저녁 완료되면 자동 하루 결산 실행
  - 오늘 입력 시 Embed eating.png 교체 → 3분 후 복귀
- `MainView` — 버튼 4개 (식사 입력 / 오늘 요약 / 오늘 일정 / 설정 변경)
  - 📅 오늘 일정: 목표 칼로리 + 현재 섭취량 + 식사 알림 시간 + 현재 날씨
- `create_or_update_embed()` — 기존 Embed 수정 or 새로 생성
- `_send_daily_analysis()` — 하루 결산 Embed 전송 (소급/오후10시 공통)

### utils/gpt.py
- `calculate_daily_calories()` — 성별/나이/키/체중 → GPT-4o로 권장 칼로리 계산
- `parse_meal_input()` — 자연어 → {days_ago, meal_type, food_name} JSON 파싱
- `analyze_meal_text()` — 음식명 → {calories, protein, carbs, fat, fiber} 분석
- `generate_comment()` — 다마고치 대사 생성 (시스템 프롬프트 기반)

### utils/db.py
- Supabase (PostgreSQL) psycopg2 연결
- `get_meals_by_date(user_id, target_date)` — 날짜별 식사 조회
- `get_calories_by_date(user_id, target_date)` — 날짜별 칼로리 합계
- `is_all_meals_done_on_date(user_id, target_date)` — 아침+점심+저녁 완료 여부
- `get_latest_weather(user_id)` — 최근 날씨 조회
- `get_all_users()` — 스케줄러용 전체 유저 조회

### utils/image.py
- 이미지 선택 우선순위 로직
  1. 특별 이벤트 (goal_achieved)
  2. 식사 상태 (eating / overfed / underfed)
  3. 배고픔 (hungry_cry / hungry)
  4. 날씨 (dusty / rainy / snowy / hot / cold / sunny / cloudy)
  5. 기본 감정 (sick / tired / happy / normal)

---

## 🔜 남은 작업 (v1.7)

- [ ] 사진 식사 입력 (GPT-4o Vision) — `cogs/meal.py` 신규 구현
  - 쓰레드에 사진 첨부 시 on_message 감지
  - "📸 음식 사진이에요? [✅ 분석하기]" 버튼 응답
  - GPT-4o Vision으로 음식 인식 + 칼로리 분석
  - [✅ 기록하기] 클릭 시 DB 저장
- [ ] 다마고치 이미지 25종 제작 및 images/ 폴더 배치
- [ ] 호스팅 배포 (Railway / Render / VPS)

---

## ⚙️ 환경변수 (.env)

```
DISCORD_TOKEN=
OPENAI_API_KEY=
WEATHER_API_KEY=       # 기상청 공공데이터 포털
AIR_API_KEY=           # 에어코리아
DATABASE_URL=postgresql://postgres.프로젝트ID:비밀번호@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
TAMAGOTCHI_CHANNEL_ID=
```

---

## 🌿 GitHub 브랜치

- `main` — 초기 설계 버전
- `develop` — 현재 개발 버전 (v1.6)

> GitHub: https://github.com/klaod-tech/Discord_Damagotchi

---

위 내용이 이 프로젝트의 현재 상태야. 이걸 기반으로 개발을 이어서 진행해줘.
새 대화에서 이 파일을 붙여넣으면 맥락 없이도 바로 이어서 개발 가능해.
