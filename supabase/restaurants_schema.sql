-- ============================================================
-- 먹구름 — 음식점 관련 테이블 스키마
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 음식점 테이블
CREATE TABLE IF NOT EXISTS restaurants (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  category      text,
  address       text,
  phone         text,
  open_hours    text,
  price_range   text,
  location_tag  text DEFAULT '아산',
  link          text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),

  -- crawl_restaurants.py의 upsert(중복 방지) 기준 컬럼
  UNIQUE (name, address)
);

-- 2. 메뉴 테이블
--    카카오/네이버 지도 API는 메뉴 정보를 제공하지 않습니다.
--    초기 데이터는 NULL이며, 수동 입력 또는 추후 배달앱 연동으로 채워주세요.
CREATE TABLE IF NOT EXISTS menu_items (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_name       text NOT NULL,
  price           int4,
  description     text,
  calories        int4,
  allergens       text[],
  tags            text[],
  is_available    boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- 3. 추천 로그 테이블
--    food_feedback 테이블과 역할이 겹칠 수 있으므로 추후 통합 여부 검토 필요
CREATE TABLE IF NOT EXISTS restaurant_log (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             text REFERENCES users(user_id),
  restaurant_id       uuid REFERENCES restaurants(id),
  menu_items          text[],
  reason              text,
  user_message        text,
  location            text,
  meal_type           text,
  matched_tags        text[],
  excluded_allergens  text[],
  date                date DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);

-- ── 인덱스 (추천·검색 성능 최적화) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_restaurants_location_tag ON restaurants(location_tag);
CREATE INDEX IF NOT EXISTS idx_restaurants_category     ON restaurants(category);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active    ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_log_user_id   ON restaurant_log(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_log_date      ON restaurant_log(date);
