-- =====================================================================
-- 003: 자리별 리치 여부 추적 (공탁금 정확한 계산)
-- =====================================================================
ALTER TABLE hand_results
  ADD COLUMN IF NOT EXISTS riichi_e BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS riichi_s BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS riichi_w BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS riichi_n BOOLEAN NOT NULL DEFAULT FALSE;
