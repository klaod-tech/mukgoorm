-- ============================================================
-- Migration 002: ML 선호도 학습 시스템 테이블 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ── user_preference_logits (Softmax 학습 파라미터) ────────────
CREATE TABLE IF NOT EXISTS user_preference_logits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('한식','중식','양식','분식','일식','디저트','기타')),
  logit        REAL NOT NULL DEFAULT 0.0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, category)
);

-- ── worldcup_sessions (월드컵 진행 기록) ─────────────────────
CREATE TABLE IF NOT EXISTS worldcup_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  champion   TEXT NOT NULL,
  top4       TEXT[],
  rounds     JSONB NOT NULL DEFAULT '[]',
  completed  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── food_feedback: category 컬럼 추가 ────────────────────────
ALTER TABLE food_feedback ADD COLUMN IF NOT EXISTS category TEXT;

-- ── RPC: 로짓 증분 업데이트 (HTTP Request에서 사용) ──────────
-- n8n의 Supabase 노드는 원자적 증분을 지원하지 않으므로
-- REST API 경유 upsert (resolution=merge-duplicates) 방식으로 대체.
-- 이 함수는 향후 직접 RPC 호출 시 활용 가능.
CREATE OR REPLACE FUNCTION increment_preference_logit(
  p_user_id TEXT, p_category TEXT, p_delta REAL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_preference_logits (user_id, category, logit, sample_count)
  VALUES (p_user_id, p_category, p_delta, 1)
  ON CONFLICT (user_id, category)
  DO UPDATE SET
    logit        = user_preference_logits.logit + p_delta,
    sample_count = user_preference_logits.sample_count + 1,
    updated_at   = now();
END;
$$ LANGUAGE plpgsql;

-- ── 신규 유저 로짓 자동 초기화 ────────────────────────────────
-- users 테이블에 INSERT 발생 시 7개 카테고리 로짓 행 자동 생성
CREATE OR REPLACE FUNCTION initialize_user_logits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preference_logits (user_id, category, logit, sample_count)
  SELECT NEW.user_id, cat, 0.0, 0
  FROM (VALUES
    ('한식'),('중식'),('양식'),('분식'),('일식'),('디저트'),('기타')
  ) AS cats(cat)
  ON CONFLICT (user_id, category) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_init_user_logits
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_logits();

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pref_logits_user
  ON user_preference_logits(user_id);

CREATE INDEX IF NOT EXISTS idx_worldcup_user
  ON worldcup_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_food_feedback_user_category
  ON food_feedback(user_id, category);
