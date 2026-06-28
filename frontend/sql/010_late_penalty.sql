-- =====================================================================
-- 010: 지각 패널티(late_penalty) 지원
--   win_type='late_penalty' 행:
--     - late_player        : 지각자 이름 (필수)
--     - late_penalty       : 1명당 분배 점수 (양수, 100 단위)
--                            예) 100 → 지각자 -300, 나머지 3명 각 +100
--     - winner_name / deal_in_name : NULL
-- =====================================================================

-- win_type 허용값 확장 (기존 + 'late_penalty')
ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS hand_results_win_type_check;
ALTER TABLE hand_results ADD CONSTRAINT hand_results_win_type_check
  CHECK (win_type IN ('tsumo','ron','draw','abortion','chombo','late_penalty'));

-- 화료자/방총자 제약 갱신 (late_penalty 도 winner/deal_in NULL 허용)
-- 이전 정의도 호환되지만 명시적으로 다시 선언
ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS chk_winner_when_not_draw;
ALTER TABLE hand_results ADD CONSTRAINT chk_winner_when_not_draw
  CHECK (win_type IN ('tsumo','ron') OR winner_name IS NULL);

ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS chk_deal_in_only_for_ron;
ALTER TABLE hand_results ADD CONSTRAINT chk_deal_in_only_for_ron
  CHECK (
    (win_type = 'ron'   AND deal_in_name IS NOT NULL) OR
    (win_type <> 'ron'  AND deal_in_name IS NULL)
  );

-- 새 컬럼 — 지각자 + 1명당 분배 점수
ALTER TABLE hand_results
  ADD COLUMN IF NOT EXISTS late_player  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS late_penalty INT;

-- 무결성: late_penalty 행에는 late_player 필수, 그 외에는 NULL
ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS chk_late_player_only_for_late;
ALTER TABLE hand_results ADD CONSTRAINT chk_late_player_only_for_late
  CHECK (
    (win_type = 'late_penalty' AND late_player IS NOT NULL AND late_penalty IS NOT NULL AND late_penalty > 0) OR
    (win_type <> 'late_penalty' AND late_player IS NULL AND late_penalty IS NULL)
  );
