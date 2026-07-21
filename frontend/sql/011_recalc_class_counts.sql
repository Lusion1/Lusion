-- =====================================================================
-- 011: 옛 저장 데이터의 mangan/haneman/... 카운트 재계산 (백필)
--
-- 배경: calcClassCounts 이 fu 없는 5판+ 화료를 mangan 판정에서 스킵하는 버그가 있어,
--       match_results 의 mangan/haneman/... 컬럼이 실제보다 낮게 저장된 라운드가 있음.
--       이 스크립트는 hand_results 존재하는 모든 라운드에 대해
--       classifyByHanFu 로직을 SQL 로 재현하여 값을 새로 계산해 UPDATE 함.
--
-- 안전성:
--   - hand_results 없는 라운드(결과만 등록)는 건드리지 않음 (join 조건)
--   - 트랜잭션으로 감싸 실패 시 롤백
--   - 실행 전 SELECT 로 미리보기 가능 (아래 주석 참조)
-- =====================================================================

BEGIN;

-- 0. hand_results 자체의 score_class 정정 (NULL/normal 인데 han 기준 만관+ 인 것)
--    hand 기반 통계(만관/하네만 컬럼 등)도 정확해지도록 원본을 먼저 고친다.
UPDATE hand_results
   SET score_class = CASE
        WHEN han >= 13            THEN 'kazoe_yakuman'
        WHEN han >= 11            THEN 'sanbaiman'
        WHEN han >= 8             THEN 'baiman'
        WHEN han >= 6             THEN 'haneman'
        WHEN han >= 5             THEN 'mangan'
        WHEN han = 4 AND fu >= 40 THEN 'mangan'
        WHEN han = 3 AND fu >= 70 THEN 'mangan'
       END
 WHERE win_type IN ('tsumo','ron')
   AND winner_name IS NOT NULL
   AND (score_class IS NULL OR score_class = 'normal')
   AND (
        han >= 5
        OR (han = 4 AND fu >= 40)
        OR (han = 3 AND fu >= 70)
       );

-- 1. hand_results 존재하는 라운드에 대해서만 우선 초기화
--    (재계산 CTE 결과에 없는 사람 = 화료 0회 → mangan 등 0 이 되어야 함)
WITH rounds_with_hands AS (
    SELECT DISTINCT match_round FROM hand_results
)
UPDATE match_results mr
   SET mangan        = 0,
       haneman       = 0,
       baiman        = 0,
       sanbaiman     = 0,
       yakuman       = 0,
       kazoeyakuman  = 0,
       doubleyakuman = 0
  FROM rounds_with_hands rwh
 WHERE mr.round = rwh.match_round;

-- 2. 각 hand 의 실제 등급 결정 → 라운드+화료자별 카운트 집계 → match_results UPDATE
WITH hand_class AS (
    SELECT
        match_round,
        winner_name,
        CASE
            WHEN score_class IN ('mangan','haneman','baiman','sanbaiman',
                                 'yakuman','kazoe_yakuman','double_yakuman','triple_yakuman')
                THEN score_class
            WHEN han >= 13                       THEN 'kazoe_yakuman'
            WHEN han >= 11                       THEN 'sanbaiman'
            WHEN han >= 8                        THEN 'baiman'
            WHEN han >= 6                        THEN 'haneman'
            WHEN han >= 5                        THEN 'mangan'
            WHEN han = 4 AND fu >= 40            THEN 'mangan'
            WHEN han = 3 AND fu >= 70            THEN 'mangan'
            ELSE NULL
        END AS cls
      FROM hand_results
     WHERE win_type IN ('tsumo','ron')
       AND winner_name IS NOT NULL
),
class_counts AS (
    SELECT
        match_round,
        winner_name,
        COUNT(*) FILTER (WHERE cls = 'mangan')                                  AS mangan,
        COUNT(*) FILTER (WHERE cls = 'haneman')                                 AS haneman,
        COUNT(*) FILTER (WHERE cls = 'baiman')                                  AS baiman,
        COUNT(*) FILTER (WHERE cls = 'sanbaiman')                               AS sanbaiman,
        COUNT(*) FILTER (WHERE cls = 'yakuman')                                 AS yakuman,
        COUNT(*) FILTER (WHERE cls = 'kazoe_yakuman')                           AS kazoeyakuman,
        COUNT(*) FILTER (WHERE cls IN ('double_yakuman','triple_yakuman'))      AS doubleyakuman
      FROM hand_class
     WHERE cls IS NOT NULL
     GROUP BY match_round, winner_name
)
UPDATE match_results mr
   SET mangan        = COALESCE(cc.mangan, 0),
       haneman       = COALESCE(cc.haneman, 0),
       baiman        = COALESCE(cc.baiman, 0),
       sanbaiman     = COALESCE(cc.sanbaiman, 0),
       yakuman       = COALESCE(cc.yakuman, 0),
       kazoeyakuman  = COALESCE(cc.kazoeyakuman, 0),
       doubleyakuman = COALESCE(cc.doubleyakuman, 0)
  FROM class_counts cc
 WHERE mr.round = cc.match_round
   AND mr.player_name = cc.winner_name;

COMMIT;

-- =====================================================================
-- 실행 전 미리보기 (선택):
--   위 트랜잭션을 실행하기 전에, 얼마나 바뀔지 확인하고 싶으면
--   아래 SELECT 를 별도로 돌려보세요.
-- =====================================================================
-- WITH hand_class AS (
--     SELECT match_round, winner_name,
--            CASE
--                WHEN score_class IN ('mangan','haneman','baiman','sanbaiman','yakuman','kazoe_yakuman','double_yakuman','triple_yakuman') THEN score_class
--                WHEN han >= 13 THEN 'kazoe_yakuman'
--                WHEN han >= 11 THEN 'sanbaiman'
--                WHEN han >= 8  THEN 'baiman'
--                WHEN han >= 6  THEN 'haneman'
--                WHEN han >= 5  THEN 'mangan'
--                WHEN han = 4 AND fu >= 40 THEN 'mangan'
--                WHEN han = 3 AND fu >= 70 THEN 'mangan'
--                ELSE NULL
--            END AS cls
--       FROM hand_results
--      WHERE win_type IN ('tsumo','ron') AND winner_name IS NOT NULL
-- ),
-- new_counts AS (
--     SELECT match_round, winner_name,
--            COUNT(*) FILTER (WHERE cls = 'mangan')                                 AS mangan,
--            COUNT(*) FILTER (WHERE cls = 'haneman')                                AS haneman,
--            COUNT(*) FILTER (WHERE cls = 'baiman')                                 AS baiman,
--            COUNT(*) FILTER (WHERE cls = 'sanbaiman')                              AS sanbaiman,
--            COUNT(*) FILTER (WHERE cls = 'yakuman')                                AS yakuman,
--            COUNT(*) FILTER (WHERE cls = 'kazoe_yakuman')                          AS kazoeyakuman,
--            COUNT(*) FILTER (WHERE cls IN ('double_yakuman','triple_yakuman'))     AS doubleyakuman
--       FROM hand_class WHERE cls IS NOT NULL
--      GROUP BY match_round, winner_name
-- )
-- SELECT mr.round, mr.player_name,
--        mr.mangan AS old_mangan,   nc.mangan   AS new_mangan,
--        mr.haneman AS old_haneman, nc.haneman  AS new_haneman,
--        mr.baiman AS old_baiman,   nc.baiman   AS new_baiman
--   FROM match_results mr
--   JOIN new_counts nc ON nc.match_round = mr.round AND nc.winner_name = mr.player_name
--  WHERE mr.mangan  <> nc.mangan
--     OR mr.haneman <> nc.haneman
--     OR mr.baiman  <> nc.baiman
--     OR mr.sanbaiman <> nc.sanbaiman
--     OR mr.yakuman   <> nc.yakuman
--     OR mr.kazoeyakuman <> nc.kazoeyakuman
--     OR mr.doubleyakuman <> nc.doubleyakuman
--  ORDER BY mr.round DESC;
