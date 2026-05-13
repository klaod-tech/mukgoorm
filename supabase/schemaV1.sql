-- ============================================================
-- Migration 001: 누락 테이블 + 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ── users: n8n v3 음식추천에 필요한 컬럼 추가 ────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS allergies        text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS food_preferences text[];

-- ── tamagotchi ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tamagotchi (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text REFERENCES users(user_id) ON DELETE CASCADE,
  hunger      integer DEFAULT 50,
  mood        integer DEFAULT 50,
  hp          integer DEFAULT 100,
  last_fed_at timestamptz,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- ── weight_log ───────────────────────────────────────────────
-- 실제 DB: id, user_id, date, weight, bmi, note, created_at
CREATE TABLE IF NOT EXISTS weight_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text,
  date       date DEFAULT CURRENT_DATE,
  weight     real NOT NULL,
  bmi        real,
  note       text,
  created_at timestamptz DEFAULT now()
);

-- ── weather_log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text,
  date            date DEFAULT CURRENT_DATE,
  city            text,
  temperature     real,
  low_temperature real,
  high_temperature real,
  sky             text,
  rain            text,
  wind_speed      real,
  pm10            integer,
  pm25            integer,
  pm10_grade      text,
  pm25_grade      text,
  condition       text,
  humidity        integer,
  dust_level      text,
  created_at      timestamptz DEFAULT now()
);

-- ── intent_logs (n8n v3 A/B/C 분류 로그) ────────────────────
CREATE TABLE IF NOT EXISTS intent_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message          text NOT NULL,
  keyword          text,
  predicted_path   text NOT NULL CHECK (predicted_path IN ('A', 'B', 'C')),
  path_description text,
  is_correct       boolean,
  true_path        text CHECK (true_path IN ('A', 'B', 'C')),
  user_id          text,
  created_at       timestamptz DEFAULT now()
);

-- ── food_feedback: 컬럼명 정정 + restaurant_id 추가 ──────────
-- DB의 reaction → 코드 기준 feedback으로 통일
ALTER TABLE food_feedback RENAME COLUMN reaction TO feedback;
ALTER TABLE food_feedback ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES restaurants(id);

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tamagotchi_user_id    ON tamagotchi(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_log_user       ON weight_log(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_log_recorded   ON weight_log(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_log_user_date ON weather_log(user_id, date);
CREATE INDEX IF NOT EXISTS idx_intent_logs_user      ON intent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_intent_logs_path      ON intent_logs(predicted_path);
