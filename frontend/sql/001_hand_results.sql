-- =====================================================================
-- 마작-2026: 매 국(hand) 단위 화료/방총 기록 테이블 추가
-- 적용 위치: Supabase SQL Editor
-- 적용 전 백업 권장 (Supabase Dashboard → Database → Backups)
-- =====================================================================

-- 1) hand_results 테이블 생성
--    한 경기(match_results.round)는 여러 hand(국)로 구성됨
--    예) 동남전 = 동1국, 동2국, 동3국, 동4국, 남1국, 남2국, 남3국, 남4국 (+ 연장)
CREATE TABLE IF NOT EXISTS hand_results (
    id              SERIAL PRIMARY KEY,
    match_round     INTEGER     NOT NULL,                 -- match_results.round 와 연결
    match_date      DATE        NOT NULL,                 -- 조회 편의용 중복 저장
    hand_number     INTEGER     NOT NULL,                 -- 경기 내 순번 (1 부터 시작)
    hand_wind       VARCHAR(4)  NOT NULL,                 -- '동' | '남' | '서' | '북'
    hand_round_num  INTEGER     NOT NULL CHECK (hand_round_num BETWEEN 1 AND 4),
    win_type        VARCHAR(10) NOT NULL CHECK (win_type IN ('tsumo','ron','draw')),
    winner_name     VARCHAR(50),                          -- 화료자 (draw 이면 NULL 허용)
    deal_in_name    VARCHAR(50),                          -- 방총자 (tsumo / draw 이면 NULL)
    win_score       INTEGER,                              -- 화료 점수 (선택, 없어도 됨)
    created_at      TIMESTAMP   DEFAULT NOW(),

    -- 데이터 정합성 제약
    CONSTRAINT chk_winner_when_not_draw
        CHECK (win_type = 'draw' OR winner_name IS NOT NULL),
    CONSTRAINT chk_deal_in_only_for_ron
        CHECK (
            (win_type = 'ron'   AND deal_in_name IS NOT NULL) OR
            (win_type IN ('tsumo','draw') AND deal_in_name IS NULL)
        ),
    CONSTRAINT chk_winner_not_deal_in
        CHECK (winner_name IS NULL OR deal_in_name IS NULL OR winner_name <> deal_in_name),
    CONSTRAINT uq_round_hand UNIQUE (match_round, hand_number)
);

-- 2) 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_hand_match_round  ON hand_results(match_round);
CREATE INDEX IF NOT EXISTS idx_hand_winner_name  ON hand_results(winner_name);
CREATE INDEX IF NOT EXISTS idx_hand_deal_in_name ON hand_results(deal_in_name);
CREATE INDEX IF NOT EXISTS idx_hand_match_date   ON hand_results(match_date);

-- =====================================================================
-- 참고: 화료율/쯔모율/방총율 계산 쿼리 (백엔드에서 사용)
-- =====================================================================
-- 어떤 플레이어 P 의 화료율 = P 가 winner_name 인 hand 수 / P 가 참여한 hand 수
-- P 가 참여한 hand 수 = P 가 해당 match_round 에 등록되어 있는 모든 hand
-- match_results 의 player_name 으로 참여 여부 판단
-- =====================================================================
