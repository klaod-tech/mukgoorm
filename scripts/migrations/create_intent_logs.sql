-- intent_logs: 음식 추천 의도 분류 로그 및 ML 학습 데이터
CREATE TABLE IF NOT EXISTS intent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message       TEXT NOT NULL,
  keyword       TEXT,
  predicted_path TEXT NOT NULL CHECK (predicted_path IN ('A', 'B', 'C')),
  path_description TEXT,
  is_correct    BOOLEAN,
  true_path     TEXT CHECK (true_path IN ('A', 'B', 'C')),
  user_id       TEXT,
  embedding     VECTOR(1536),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS intent_logs_predicted_path_idx ON intent_logs(predicted_path);
CREATE INDEX IF NOT EXISTS intent_logs_user_id_idx       ON intent_logs(user_id);
CREATE INDEX IF NOT EXISTS intent_logs_created_at_idx    ON intent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS intent_logs_is_correct_idx    ON intent_logs(is_correct) WHERE is_correct IS NOT NULL;

-- Phase 2: 임베딩 유사도 검색용 인덱스 (pgvector 필요)
-- CREATE INDEX IF NOT EXISTS intent_logs_embedding_idx
--   ON intent_logs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE  intent_logs                 IS '음식 추천 의도 분류 로그. Phase1=DB매칭, Phase2=임베딩 유사도';
COMMENT ON COLUMN intent_logs.predicted_path  IS 'A=식당명 직접, B=메뉴명 직접, C=일반 추천';
COMMENT ON COLUMN intent_logs.is_correct      IS '사용자 피드백: true=맞음, false=틀림, NULL=피드백 없음';
COMMENT ON COLUMN intent_logs.true_path       IS '사용자가 수정한 실제 경로 (is_correct=false 일 때)';
COMMENT ON COLUMN intent_logs.embedding       IS 'Phase2 활성화 시 메시지 임베딩 벡터';
