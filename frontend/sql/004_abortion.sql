-- =====================================================================
-- 004: 도중 유국(abortion) + 촌보(chombo) 지원
-- =====================================================================

-- win_type 허용값 확장
ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS hand_results_win_type_check;
ALTER TABLE hand_results ADD CONSTRAINT hand_results_win_type_check
  CHECK (win_type IN ('tsumo','ron','draw','abortion','chombo'));

-- 화료자/방총자 제약 갱신 (abortion/chombo 도 winner/deal_in NULL)
ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS chk_winner_when_not_draw;
ALTER TABLE hand_results ADD CONSTRAINT chk_winner_when_not_draw
  CHECK (win_type IN ('tsumo','ron') OR winner_name IS NULL);

ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS chk_deal_in_only_for_ron;
ALTER TABLE hand_results ADD CONSTRAINT chk_deal_in_only_for_ron
  CHECK (
    (win_type = 'ron'   AND deal_in_name IS NOT NULL) OR
    (win_type <> 'ron'  AND deal_in_name IS NULL)
  );

-- 새 컬럼
ALTER TABLE hand_results
  ADD COLUMN IF NOT EXISTS abortion_type VARCHAR(20),  -- kyuushu | sufon | suucha_riichi | suukantsu
  ADD COLUMN IF NOT EXISTS chombo_player VARCHAR(50);  -- 촌보 선언자
