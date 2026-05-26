-- =====================================================================
-- 마작-2026 2차 확장: hand_results 에 役/한·부/점수/본장/텐파이 컬럼 추가
-- =====================================================================
-- 재실행 안전: 모든 추가는 IF NOT EXISTS

ALTER TABLE hand_results
  ADD COLUMN IF NOT EXISTS honba                 SMALLINT     NOT NULL DEFAULT 0,  -- 본장 수
  ADD COLUMN IF NOT EXISTS han                   SMALLINT,                          -- 한 수 (만관 이상이면 NULL 가능)
  ADD COLUMN IF NOT EXISTS fu                    SMALLINT,                          -- 부 (30, 40 등)
  ADD COLUMN IF NOT EXISTS score_class           VARCHAR(20),                       -- 'normal'|'mangan'|'haneman'|'baiman'|'sanbaiman'|'yakuman'|'double_yakuman'|'triple_yakuman'|'kazoe_yakuman'
  ADD COLUMN IF NOT EXISTS is_dealer_winner      BOOLEAN      NOT NULL DEFAULT FALSE, -- 친 화료 여부
  ADD COLUMN IF NOT EXISTS is_riichi             BOOLEAN      NOT NULL DEFAULT FALSE, -- 화료자가 리치했는지
  ADD COLUMN IF NOT EXISTS is_ippatsu            BOOLEAN      NOT NULL DEFAULT FALSE, -- 일발 화료
  ADD COLUMN IF NOT EXISTS dora_count            SMALLINT     NOT NULL DEFAULT 0,  -- 도라 매수
  ADD COLUMN IF NOT EXISTS aka_dora_count        SMALLINT     NOT NULL DEFAULT 0,  -- 적도라 매수
  ADD COLUMN IF NOT EXISTS ura_dora_count        SMALLINT     NOT NULL DEFAULT 0,  -- 우라도라 매수
  ADD COLUMN IF NOT EXISTS yaku_list             TEXT[]       NOT NULL DEFAULT '{}', -- 役 리스트 (체크박스 선택)
  ADD COLUMN IF NOT EXISTS yaku_text             TEXT,                              -- 자유텍스트 役 (예: "이상한 특수役")
  ADD COLUMN IF NOT EXISTS point_total           INTEGER,                            -- 자동계산된 총 점수
  ADD COLUMN IF NOT EXISTS point_from_dealer     INTEGER,                            -- 쯔모 시 친에게서 받는 점수 (1명)
  ADD COLUMN IF NOT EXISTS point_from_non_dealer INTEGER,                            -- 쯔모 시 자(子)에게서 받는 점수 (1명 당)
  ADD COLUMN IF NOT EXISTS tenpai_e              BOOLEAN,                            -- 유국 시 동 자리 텐파이 (NULL=비유국)
  ADD COLUMN IF NOT EXISTS tenpai_s              BOOLEAN,                            -- 유국 시 남 자리 텐파이
  ADD COLUMN IF NOT EXISTS tenpai_w              BOOLEAN,                            -- 유국 시 서 자리 텐파이
  ADD COLUMN IF NOT EXISTS tenpai_n              BOOLEAN;                            -- 유국 시 북 자리 텐파이

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_hand_yaku_list    ON hand_results USING GIN (yaku_list);
CREATE INDEX IF NOT EXISTS idx_hand_score_class  ON hand_results (score_class);
CREATE INDEX IF NOT EXISTS idx_hand_is_riichi    ON hand_results (is_riichi) WHERE is_riichi = TRUE;
