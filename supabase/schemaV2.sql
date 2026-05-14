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

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pref_logits_user
  ON user_preference_logits(user_id);

CREATE INDEX IF NOT EXISTS idx_worldcup_user
  ON worldcup_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_food_feedback_user_category
  ON food_feedback(user_id, category);
