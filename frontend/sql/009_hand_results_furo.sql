-- 009: hand_results 에 후로(副露) 여부 컬럼 추가
-- 신규 데이터부터 후로율 통계 가능. 옛 데이터는 NULL (정보 없음).
ALTER TABLE hand_results
  ADD COLUMN IF NOT EXISTS is_furo BOOLEAN;

-- 후로 통계에 자주 쓰이는 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_hand_results_is_furo
  ON hand_results(is_furo)
  WHERE is_furo IS NOT NULL;
