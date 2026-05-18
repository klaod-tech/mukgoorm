-- ============================================================
-- 실제 Supabase DB 현황 (2026-05-17 기준)
-- information_schema.columns 쿼리로 추출한 실제 스키마
-- ============================================================

CREATE TABLE chat_logs (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    text,
  role       text,
  message    text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE diary (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    text,
  date       date DEFAULT CURRENT_DATE,
  content    text,
  summary    text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE email_log (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    text,
  date       date DEFAULT CURRENT_DATE,
  sender     text,
  subject    text,
  summary    text,
  is_read    boolean DEFAULT false,
  uid        text,
  created_at timestamp with time zone DEFAULT now()
);

-- ⚠️ reaction 컬럼명 주의 — schemaV1에서 feedback으로 rename 시도했으나 실제 DB는 reaction 유지 중
-- n8n 음식 피드백 노드 필드명: reaction (feedback 아님)
CREATE TABLE food_feedback (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    text,
  food_name  text,
  reaction   text,   -- "like" or "dislike"
  location   text,
  category   text,
  date       date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE meal_log (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    text,
  date       date DEFAULT CURRENT_DATE,
  meal_type  text,
  food_name  text,
  calories   integer,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE menu_items (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  menu_name     text NOT NULL,
  price         integer,
  description   text,
  calories      integer,
  allergens     text[],
  tags          text[],
  is_available  boolean DEFAULT true,
  created_at    timestamp with time zone DEFAULT now()
);

CREATE TABLE menu_training_data (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  menu_name  text NOT NULL,
  allergens  text[],
  tags       text[],
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE restaurant_log (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id      text,
  restaurant_id uuid,
  menu_items   text,
  reason       text,
  user_message text,
  location     text,
  category     text,
  matched_tags text,
  allergens    text,
  date         date DEFAULT now(),
  created_at   timestamp with time zone DEFAULT now()
);

CREATE TABLE restaurants (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  category     text[],
  address      text,
  phone        text,
  open_hours   text,
  location_tag text DEFAULT '아산',
  link         text,
  is_active    boolean DEFAULT true,
  created_at   timestamp with time zone DEFAULT now()
);

CREATE TABLE schedule (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id     text,
  title       text,
  description text,
  location    text,
  date        date,
  time        text,
  is_done     boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE users (
  user_id          text NOT NULL,
  tamagotchi_name  text,
  city             text,
  village          text,
  gender           text,
  age              integer,
  height           real,
  init_weight      real,
  goal_weight      real,
  daily_cal_target integer,
  wake_time        text,
  breakfast_time   text,
  lunch_time       text,
  dinner_time      text,
  snack_time       text,
  email_provider   text,
  email_address    text,
  email_app_pw     text,
  email_last_uid   text,
  allergies        text[],
  food_preferences text[],
  created_at       timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone DEFAULT now()
);

CREATE TABLE weather_log (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id          text,
  date             date DEFAULT CURRENT_DATE,
  city             text,
  temperature      real,
  condition        text,
  humidity         integer,
  dust_level       text,
  created_at       timestamp with time zone DEFAULT now(),
  low_temperature  real,
  high_temperature real,
  sky              text,
  rain             text,
  wind_speed       real,
  pm10             integer,
  pm25             integer,
  pm10_grade       text,
  pm25_grade       text
);

CREATE TABLE weight_log (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    text,
  date       date DEFAULT CURRENT_DATE,
  weight     real,
  bmi        real,
  note       text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE user_preference_logits (
  user_id      text NOT NULL,
  category     text NOT NULL,
  logit        real DEFAULT 0,
  sample_count integer DEFAULT 0,
  updated_at   timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE worldcup_sessions (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    text,
  champion   text,
  rounds     jsonb,
  completed  boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- ⚠️ DB에 없는 테이블 (미적용)
-- ============================================================
-- tamagotchi          → schemaV1에 있으나 DB 미존재
-- intent_logs         → schemaV1에 있으나 DB 미존재
