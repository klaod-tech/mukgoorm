# AI_DAMAGOTCHI_PROJECT_CONTEXT
version: 1.7
last_updated: 2026-03-31
language: ko
github: https://github.com/klaod-tech/Discord_Damagotchi
branch_main: main
branch_dev: develop

---

## PROJECT_SUMMARY

디스코드 봇 기반 1인 1다마고치 프로젝트.
사용자가 음식을 입력하면 다마고치에게 밥을 주는 행위로 연결되며,
칼로리 관리와 날씨 정보를 캐릭터 이미지와 대사로 **간접** 전달한다.

---

## ABSOLUTE_RULES
# 이 규칙은 어떤 상황에서도 변경 불가

- rule_1: hp/hunger/mood 수치는 사용자에게 절대 직접 노출 금지. 이미지+대사로만 간접 표현.
- rule_2: 날씨는 별도 버튼/알림 없음. 기상 시간에 이미지 자동 교체로만 전달.
- rule_3: 대화 버튼 없음. 제거 확정.
- rule_4: 칼로리/영양소 수치는 오늘 요약 버튼 클릭 시 Ephemeral(본인에게만 보임)로만 확인 가능.
- rule_5: 파일명 소문자+언더스코어 고정 (hungry_cry.png O, HungryCry.PNG X)

---

## TECH_STACK

```
language: Python 3.11+
discord: discord.py 2.x
ai_api: OpenAI GPT-4o  # 칼로리분석, Vision, 대사생성
weather_api_1: 기상청 공공데이터 포털 (초단기실황조회)  # 도시명→격자좌표(nx,ny) 자동변환, 50개 도시 매핑
weather_api_2: 에어코리아 API  # PM10, PM2.5 미세먼지 등급
image_tool: NovelAI  # NAI Diffusion Anime V3, 512x512, Steps28, CFG7, Euler Ancestral
db: Supabase (PostgreSQL)  # psycopg2 기반, Session pooler 방식
scheduler: APScheduler (AsyncIOScheduler)
cal_formula: Mifflin-St Jeor  # 권장 칼로리 계산
```

---

## DISCORD_STRUCTURE

```
#다마고치 채널 (일반 채팅 불가, 봇만 허용)
├── [고정 메시지 1개] 시작하기 Embed → 버튼: [🐣 다마고치 시작하기]
└── 쓰레드 목록 (유저별 전용)
    ├── {tamagotchi_name}의 다마고치 → 유저A 전용
    └── ...
```

### EMBED_UI

```
[다마고치 이미지]
{tamagotchi_name} · "{대사}"
[ 🍚 밥 주기 ] [ 📊 오늘 요약 ] [ 📅 오늘 일정 ] [ ⚙️ 설정 변경 ]
```

### BUTTON_ACTIONS

| button | action | output |
|--------|--------|--------|
| 🍚 밥 주기 | Modal 팝업 | 텍스트 or 사진 입력 → GPT-4o 분석 → DB저장 → Embed갱신 |
| 📊 오늘 요약 | Ephemeral | 총칼로리/탄단지비율/끼니별내역/날씨/다마고치코멘트 |
| 📅 오늘 일정 | Ephemeral | 목표칼로리/체중현황/식사알림시간/현재날씨 |
| ⚙️ 설정 변경 | Modal (1단계) | 이름/도시/기상시간/식사알림/목표체중 변경 |

---

## DATABASE_SCHEMA

### TABLE: Users
```sql
user_id          TEXT PRIMARY KEY  -- 디스코드 유저 ID
tamagotchi_name  TEXT NOT NULL     -- 다마고치 이름 (온보딩 Modal 입력)
city             TEXT NOT NULL     -- 거주 도시 (날씨 API용, GPT가 정제 후 저장)
wake_time        TEXT NOT NULL     -- 기상 시간 HH:MM (날씨 이미지 교체 기준)
breakfast_time   TEXT NOT NULL     -- 아침 알림 HH:MM
lunch_time       TEXT NOT NULL     -- 점심 알림 HH:MM
dinner_time      TEXT NOT NULL     -- 저녁 알림 HH:MM
init_weight      REAL NOT NULL     -- 초기 체중 kg
goal_weight      REAL NOT NULL     -- 목표 체중 kg
daily_cal_target INTEGER NOT NULL  -- Mifflin-St Jeor 공식으로 GPT 계산
thread_id        TEXT NOT NULL     -- 유저 전용 쓰레드 ID (embed_message_id 찾기용)
created_at       TIMESTAMP DEFAULT NOW()
```

### TABLE: Tamagotchi
```sql
user_id          TEXT PRIMARY KEY REFERENCES Users(user_id)
hp               INTEGER DEFAULT 100  -- 체력 0~100 [내부전용, 미노출]
hunger           INTEGER DEFAULT 100  -- 배부름 0~100 [내부전용, 미노출]
mood             INTEGER DEFAULT 100  -- 기분 0~100 [내부전용, 미노출]
current_image    TEXT                 -- 현재 표시 이미지 파일명
embed_message_id TEXT                 -- Embed 수정용 메시지 ID
last_fed_at      TIMESTAMP            -- 마지막 식사 입력 시각
updated_at       TIMESTAMP            -- 마지막 수치 갱신 시각
```

### TABLE: Meals
```sql
meal_id       SERIAL PRIMARY KEY
user_id       TEXT REFERENCES Users(user_id)
meal_type     TEXT  -- breakfast | lunch | dinner | snack
food_name     TEXT  -- 입력/인식된 음식명 (콤마 구분)
calories      INTEGER
protein       REAL   -- g
carbs         REAL   -- g
fat           REAL   -- g
fiber         REAL   -- g
input_method  TEXT   -- text | photo
gpt_comment   TEXT   -- GPT 대사 캐싱 (nullable, 오늘 요약 재사용)
recorded_at   TIMESTAMP DEFAULT NOW()
recorded_date DATE   -- 소급 입력용 날짜 (어제/그저께 지원)
```

### TABLE: Weather_Log
```sql
log_id         SERIAL PRIMARY KEY
user_id        TEXT REFERENCES Users(user_id)
weather        TEXT     -- 맑음|비|눈|흐림 등
temp           REAL     -- 기온 °C
pm10           INTEGER  -- 미세먼지 μg/m³
pm25           INTEGER  -- 초미세먼지 μg/m³
selected_image TEXT     -- 선택된 이미지 파일명 (오늘 요약 재사용)
gpt_comment    TEXT     -- 날씨 기반 대사 캐싱 (nullable)
recorded_at    TIMESTAMP DEFAULT NOW()
```

### TABLE: weight_log  [v1.7 신규]
```sql
log_id      SERIAL PRIMARY KEY
user_id     TEXT REFERENCES Users(user_id)
weight      REAL       -- 체중 kg
recorded_at TIMESTAMP DEFAULT NOW()
```

---

## STAT_CHANGE_RULES

### hunger (배부름, 높을수록 배부름)
```
식사입력(적정) → +35
식사입력(과식) → +50
식사입력(소식) → +15
시간경과       → -5/시간
hunger=0       → 유지 (사망 없음, hungry_cry 이미지 유지)
```

### hp (건강)
```
적정식사 입력           → +5
과식 3일 연속           → -10
소식 3일 연속           → -10
[확장예정] 운동 입력     → +15
[확장예정] 수면 입력     → +10
```

### mood (기분)
```
식사입력         → +5
오늘요약 클릭    → +3
hunger < 30      → -10
[확장예정]       → 가변
```

### EVENT_EFFECTS (코드 참고용)
```python
EVENT_EFFECTS = {
    "meal_input":  {"hunger": +35, "mood": +5, "hp": +5},
    "overmeal":    {"hunger": +50},
    "undermeal":   {"hunger": +15},
    # 추후 추가 예정
    # "exercise":  {"hp": +15, "mood": +10},
    # "sleep":     {"hp": +10, "mood": +8},
}
```

---

## IMAGE_SYSTEM

### NovelAI 공통 설정
```
model: NAI Diffusion Anime V3
size: 512x512
steps: 28
cfg_scale: 7
sampler: k_euler_ancestral
seed: 고정 (normal.png 먼저 생성 후 seed 기록, 전 이미지에 동일 적용)
```

### BASE_PROMPT_POSITIVE
```
chibi, cute, small round yellow creature, big round eyes, simple body,
white background, flat 2D illustration, clean line art, soft pastel colors,
minimalist style, no background details, best quality, masterpiece
```

### BASE_PROMPT_NEGATIVE
```
realistic, 3D render, human, armor, weapon, detailed background,
complex shading, dark colors, scary, grotesque, multiple characters,
text, watermark, blurry, low quality, bad anatomy
```

### IMAGE_PRIORITY_LOGIC
```python
# 우선순위 (높을수록 먼저 표시)
1: 특별이벤트 (goal_achieved, birthday)
2: 식사상태 (eating, overfed, underfed)
3: 배고픔상태 (hungry_cry, hungry)
4: 날씨조건 (dusty > rainy/snowy > hot/cold/sunny/cloudy)
5: 기본기분 (sick < tired < normal < happy)
```

### IMAGE_TRIGGER_TABLE
```
# 파일명 | 트리거조건 | 추가 프롬프트 키워드
normal.png       | 수치 모두 40~69 | neutral expression, calm, small smile
happy.png        | hp≥70 hunger≥70 mood≥70 | big smile, sparkling eyes, arms raised, cheering
tired.png        | mood<40 | drooping eyes, slouching, dark circles, yawning
sick.png         | hp<40 | thermometer in mouth, dizzy lines, pale, lying down
eating.png       | 밥주기 입력 직후 3분 | holding chopsticks, cheeks puffed, happy closed eyes
hungry.png       | 식사알림 정각 이후 미입력 | hands on stomach, teary eyes, pleading
hungry_cry.png   | 식사알림 1시간 후 미입력 | crying, tears streaming, wailing, dramatic
overfed.png      | 오후10시 칼로리 > daily_cal_target | bloated belly, lying on back, swirly eyes
underfed.png     | 오후10시 칼로리 < daily_cal_target*0.67 | thin body, weak posture, empty bowl
sunny.png        | 맑음 15~25°C | sunglasses, bright expression, arms spread
hot.png          | 맑음 26°C+ | sunglasses, melting, sweat drops, tongue out
cold.png         | 맑음 5°C이하 | scarf, shivering, teeth chattering, breath cloud
rainy.png        | 비/소나기 | holding umbrella, rain drops, pouty expression
snowy.png        | 눈 | scarf+umbrella, snowflakes, curious expression
cloudy.png       | 흐림 | half-closed eyes, yawning, bored
dusty.png        | PM10>80 or PM2.5>35 | face mask, squinting, uncomfortable, worried
goal_achieved.png| 목표체중 달성 (24시간 후 해제) | trophy, confetti, big smile, jumping
birthday.png     | 생성일 기준 1년마다 | birthday cake, party hat, confetti
```

---

## ONBOARDING_FLOW

```
신규유저 [🐣 다마고치 시작하기] 클릭
  → Modal 팝업 (1단계, discord.py 제약으로 2단계→1단계 통합)
    fields: tamagotchi_name, city, init_weight, goal_weight,
            wake_time, breakfast_time, lunch_time, dinner_time
  → DB Users 저장
  → DB Tamagotchi 초기값 생성 (hp=100, hunger=100, mood=100)
  → GPT-4o로 daily_cal_target 계산 (Mifflin-St Jeor)
  → #다마고치 채널에 유저 전용 쓰레드 생성 (이름: "{tamagotchi_name}의 다마고치")
  → 쓰레드에 메인 Embed 전송
  → embed_message_id DB 저장
  → APScheduler에 유저별 Job 등록 (날씨, 식사알림x3, 오후10시판정)
  → Ephemeral: "환영해요! {tamagotchi_name}(이)가 태어났어요 🎉"

기존유저가 버튼 클릭 시:
  → Ephemeral: "이미 다마고치가 있어요! 쓰레드를 확인해보세요 🐣"
```

---

## MEAL_INPUT_FLOW

### 텍스트 입력
```
[🍚 밥 주기] 클릭
  → Modal: "오늘 뭐 먹었어요?"
  → GPT 자연어 파싱
    - "어제 저녁에 치킨 먹었어" → days_ago=1, meal_type=dinner, food_name=치킨
    - 소급입력 지원 (1일전/2일전)
    - 같은 끼니 재입력 시 칼로리 합산
  → GPT-4o 칼로리+영양소 분석 (JSON 반환)
  → DB Meals 저장 (input_method='text')
  → hunger/mood/hp 내부 갱신
  → Ephemeral: 분석결과 표시
  → Embed: eating.png로 교체 → 3분 후 정상 이미지 복구
```

### 사진 입력 (GPT-4o Vision)
```
쓰레드에 이미지 첨부
  → on_message 이벤트로 감지
  → Ephemeral: "📸 음식 사진이에요? [✅ 분석하기]"
  → [✅ 분석하기] 클릭
  → GPT-4o Vision API 호출 (image_url 전달)
  → JSON 반환: {foods, total_calories, protein, carbs, fat, fiber, comment}
  → Ephemeral: 분석결과 + [✅ 기록하기] [❌ 취소]
  → [✅ 기록하기] 클릭 → DB Meals 저장 (input_method='photo')
  → hunger/mood/hp 내부 갱신 → Embed 갱신
```

### 칼로리 판정 (오후 10시 자동)
```python
if total_cal > daily_cal_target:
    image = "overfed.png"
elif total_cal < daily_cal_target * 0.67:
    image = "underfed.png"
else:
    image = "정상 유지"
# 다음날 0시에 자동 해제
```

---

## WEATHER_FLOW

```
APScheduler → 유저별 wake_time 도달
  → 기상청 API 호출 (city → nx,ny 격자좌표 변환)
  → 에어코리아 API 호출 (PM10, PM2.5)
  → DB Weather_Log 저장
  → IMAGE_PRIORITY_LOGIC 실행 → 이미지 선택
  → GPT-4o: 날씨 기반 대사 생성 (수치 직접 언급 금지)
  → embed_message_id 기반 Embed 이미지+대사 교체
  ※ 별도 알림 메시지 없음. 이미지 교체로만 전달.
```

### 날씨 이미지 매핑
```
dusty    : PM10>80 or PM2.5>35 (최우선)
rainy    : 비/소나기
snowy    : 눈
hot      : 맑음 + 26°C이상
cold     : 맑음 + 5°C이하
sunny    : 맑음 + 15~25°C
cloudy   : 흐림
```

---

## MEAL_ALERT_FLOW

```
# 아침/점심/저녁 각각 독립 실행
[식사시간 -30분]
  → 쓰레드에 알림 메시지: "{tamagotchi_name}이(가) 슬슬 배가 고파지고 있어요!"

[식사시간 정각]
  → Embed 이미지: hungry.png
  → 대사: "배고파! 빨리 밥 줘!"

[식사시간 +1시간, 미입력 시]
  → Embed 이미지: hungry_cry.png
  → 대사: "엉엉... 밥을 안 주다니..."

[밥 주기 입력 감지]
  → 해당 식사 관련 미실행 Job 취소
  → eating.png 3분 표시 → 정상 이미지 복구
  ※ 패널티 없음. hungry_cry 상태에서도 밥 주면 즉시 정상 복구.
```

---

## SCHEDULER_JOBS

```python
# 유저별 독립 Job ID
f"{user_id}_weather"        # wake_time마다 날씨 이미지 교체
f"{user_id}_breakfast_pre"  # breakfast_time - 30분
f"{user_id}_breakfast"      # breakfast_time 정각
f"{user_id}_breakfast_late" # breakfast_time + 1시간
f"{user_id}_lunch_pre"
f"{user_id}_lunch"
f"{user_id}_lunch_late"
f"{user_id}_dinner_pre"
f"{user_id}_dinner"
f"{user_id}_dinner_late"
f"{user_id}_calorie_check"  # 매일 22:00 칼로리 판정
f"{user_id}_ml_retrain"     # 매주 일요일 03:00 ML 재학습

# 설정 변경 시: 기존 Job 삭제 후 재등록
# 봇 재시작 시: DB에서 전체 유저 설정 로드 후 재등록
# timezone: KST (UTC+9) 고정
```

---

## GPT_PROMPT_TEMPLATES

### 권장 칼로리 계산
```
사용자 정보: 현재 체중 {init_weight}kg, 목표 체중 {goal_weight}kg
Mifflin-St Jeor 공식 기반으로 하루 권장 칼로리를 계산해줘.
체중 감량이 목표라면 약간 낮게, 증량이 목표라면 약간 높게.
숫자만 정수로 응답해. 예: 1850
```

### 다마고치 대사 생성 (범용)
```
너는 '{tamagotchi_name}'이라는 이름의 AI 다마고치야.
성격은 밝고 긍정적. 짧고 친근하게 말해줘.

[사용자 정보]
- 시작 체중: {init_weight}kg, 목표 체중: {goal_weight}kg
- 권장 칼로리: {daily_cal_target} kcal
- 오늘 섭취 칼로리: {today_calories} kcal
- 오늘 날씨: {weather}, {temp}°C
- 최근 식사: {recent_meals}
- [ML 패턴 컨텍스트]: {ml_pattern_context}  # pattern.py 결과 주입

건강 조언은 부드럽게. 수치를 직접 언급하지 말고 느낌으로 표현해줘.
```

### 오늘 요약 코멘트
```
오늘 식사 데이터:
- 총 칼로리: {today_cal} / {target_cal} kcal
- 탄수화물: {carbs}g, 단백질: {protein}g, 지방: {fat}g
- 끼니 기록: {meal_summary}

너는 {tamagotchi_name}이라는 이름의 밝고 긍정적인 다마고치야.
오늘 하루 식사를 보고 따뜻하고 짧게 한마디 해줘. (2문장 이내)
칭찬할 건 칭찬하고, 아쉬운 건 부드럽게 말해줘.
```

---

## ML_MODULES

### pattern.py (ML 1순위, 구현 완료)
```
역할: DB Meals에서 최근 14일 데이터 분석 → 패턴 탐지 → GPT System Prompt 주입
탐지 패턴 5가지:
  - 요일별 과식: 특정 요일에 목표 110% 초과 50% 이상
  - 아침 결식: 14일 중 7일 이상 아침 기록 없음
  - 저녁 집중 섭취: 저녁 칼로리가 하루 평균 50% 이상
  - 주간 추이: 이번주 평균 vs 지난주 평균 100kcal 이상 차이
  - 연속 소식: 3일 연속 목표 67% 미만
파일: utils/pattern.py
활성화 조건: 7일 이상 데이터 누적
```

### ml.py (ML 3순위 뼈대, 구현 완료)
```
역할: GPT-4o 추정 칼로리를 양 표현 패턴 기반으로 보정
즉시 보정 (모델 없이 동작):
  "조금" → ×0.7
  "많이" → ×1.4
  "두 그릇" → ×2.0
개인화 모델: Ridge Regression vs Random Forest (30건+ 시 자동 선택)
저장: models/calorie_model_{user_id}.pkl
재학습: 매주 일요일 03:00 APScheduler
파일: utils/ml.py
활성화 조건: 30개 이상 식사 기록
```

### gpt_ml_bridge.py (구현 완료)
```
역할: ML 결과 → GPT System Prompt 주입
흐름: pattern.py 결과 → 자연어 문장 → GPT extra_context 파라미터로 전달
파일: utils/gpt_ml_bridge.py
```

---

## FILE_STRUCTURE

```
Discord_Damagotchi/
├── bot.py                    # 봇 메인 진입점
├── cogs/
│   ├── onboarding.py         # 온보딩 + 쓰레드 생성 [완료]
│   ├── meal.py               # 식사입력 텍스트+사진 [완료]
│   ├── summary.py            # 오늘요약 + 오늘일정 [완료]
│   ├── settings.py           # 설정변경 [완료]
│   ├── scheduler.py          # APScheduler (오후10시판정 + ML재학습) [완료]
│   ├── weather.py            # 날씨연동 [완료, 버그수정]
│   └── weight.py             # 체중기록 [완료, v1.7 신규]
├── utils/
│   ├── db.py                 # Supabase CRUD [완료]
│   ├── embed.py              # Embed 생성+수정 [완료]
│   ├── gpt.py                # OpenAI API 래퍼 [완료]
│   ├── image.py              # 이미지 선택 로직 [완료]
│   ├── pattern.py            # ML 패턴 분석 [완료]
│   ├── ml.py                 # 칼로리 보정 회귀 [완료]
│   └── gpt_ml_bridge.py      # ML→GPT 브릿지 [완료]
├── images/                   # [미완료] 25종 이미지 배치 필요
├── models/                   # ML 모델 저장 (.pkl)
├── .env                      # 환경변수
└── requirements.txt
```

---

## ENV_VARS

```
DISCORD_TOKEN          # 디스코드 봇 토큰
OPENAI_API_KEY         # OpenAI API 키
WEATHER_API_KEY        # 기상청 공공데이터 포털 인증키
AIRKOREA_API_KEY       # 에어코리아 API 키
DATABASE_URL           # Supabase Session pooler URL
                       # 형식: postgresql://postgres.{project_id}:{password}@...
TAMAGOTCHI_CHANNEL_ID  # #다마고치 채널 ID
```

---

## DEVELOPMENT_HISTORY

```
v1.0  2026-03-25  전체 설계, DB 구조, 기술스택 확정, GitHub 생성
v1.1  2026-03-28  온보딩 Modal, 쓰레드 생성, 메인 Embed UI
                  이슈: Modal 연속 호출 불가 → 1단계 통합으로 해결
                  이슈: bot.add_view() 중복 → on_ready에서만 등록
v1.2  2026-03-28  SQLite → Supabase(PostgreSQL) 전환, psycopg2 기반
                  이슈: URL 오타 (postgresql://postgresql: → postgresql://postgres:)
                  이슈: Session pooler URL 유저명 형식 (postgres.{project_id})
v1.3  2026-03-28  식사입력 Modal, GPT 자연어파싱, 소급입력, 합산처리
                  이슈: 중복입력 차단 → 합산 방식으로 변경
v1.4  2026-03-28  오늘요약/오늘일정/설정변경 버튼 (버튼 4개 확정)
v1.5  2026-03-28  기상청+에어코리아 API 연동, 날씨 Embed 이미지 교체
                  이슈: 50개 도시 격자좌표 매핑 구현
v1.6  2026-03-29  오후10시 칼로리판정 스케줄러, 날씨 자동등록 개선
                  이슈: misfire_grace_time 추가
v1.7  2026-03-31  ML(pattern.py/ml.py/gpt_ml_bridge.py), Vision 사진입력, 체중기록
                  이슈: 아산/안산 오매칭 버그 수정
                  이슈: 에어코리아 '-' 값 오류 수정
                  DB: weight_log 테이블 신규 생성
                  더미데이터: Meals 38개(14일치), weight_log 29개(4주치)
```

---

## NEXT_TASKS

```
# 우선순위 순서

[P1] 다마고치 이미지 25종 배치
  - images/ 폴더에 파일명 정확히 맞춰 배치
  - IMAGE_TRIGGER_TABLE 참고
  - utils/image.py 실제 파일로 테스트

[P2] 식사 알림 스케줄러 구현 (cogs/scheduler.py)
  - 유저별 breakfast/lunch/dinner 3단계 알림 Job
  - MEAL_ALERT_FLOW 참고

[P3] 호스팅 배포
  - Railway / Render / VPS 중 선택
  - .env → 플랫폼 시크릿 이전
  - develop → main 머지 후 배포

[P4] 기획 문서 ↔ 실제 구현 불일치 업데이트
  - 버튼 4개 (기획: 3개)
  - Modal 1단계 통합
  - DB Supabase 전환

[ML-중기, 4주+ 데이터 후]
  - ML 2순위: 권장 칼로리 동적 조정 (Q-Learning / Contextual Bandit)

[ML-장기, 사진 데이터 충분 후]
  - ML 4순위: 한식 CNN (MobileNetV3 / EfficientNet-B0, AI Hub 데이터셋)

[미결]
  - daily_cal_target 현재 Supabase에서 직접 수정 필요 (현재 2400 → 약 1900)
```

---

## CLAUDE_CONTEXT_TEMPLATE
# 새 Claude 대화 시작 시 이 블록을 첫 메시지에 붙여넣으세요

```
[AI 다마고치 프로젝트 컨텍스트]
- 언어: Python 3.11+ / discord.py 2.x
- AI: OpenAI GPT-4o (칼로리분석, Vision, 대사생성)
- DB: Supabase (PostgreSQL), psycopg2
- 스케줄러: APScheduler
- GitHub: https://github.com/klaod-tech/Discord_Damagotchi (develop 브랜치)
- 현재 버전: v1.7
- 핵심 원칙: hp/hunger/mood 수치는 사용자에게 절대 직접 노출 금지
             이미지 변화 + 대사 한 줄로만 간접 표현
- 디스코드: #다마고치 채널 → 유저별 전용 쓰레드
- 버튼 4개: [🍚 밥 주기] [📊 오늘 요약] [📅 오늘 일정] [⚙️ 설정 변경]
- 컨텍스트 문서: ai_damagotchi_context.md 첨부

현재 작업: (작업 내용 입력)
```
