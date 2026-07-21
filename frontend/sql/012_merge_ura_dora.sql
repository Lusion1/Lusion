-- =====================================================================
-- 012: 우라도라를 도라로 통합 (클럽 룰 단순화)
--
-- 배경: 화료역 입력 시 도라/우라도라를 구분 입력했으나,
--       도라 하나로 합쳐 기록하기로 룰 변경.
--       기존에 우라도라로 기록된 값도 도라(dora_count)에 합산한다.
--
-- 처리:
--   dora_count = dora_count + ura_dora_count
--   ura_dora_count = 0   (컬럼은 남겨두되 값만 0 으로 — 스키마 호환 유지)
--
-- 참고: 총 판수(han)는 이미 저장 시 도라+우라 합산으로 계산돼 있어 변화 없음.
--       이 스크립트는 개별 카운트 컬럼만 정리한다.
-- =====================================================================

BEGIN;

UPDATE hand_results
   SET dora_count     = COALESCE(dora_count, 0) + COALESCE(ura_dora_count, 0),
       ura_dora_count = 0
 WHERE COALESCE(ura_dora_count, 0) > 0;

COMMIT;

-- 실행 전 미리보기 (선택):
-- SELECT match_round, hand_number, winner_name, dora_count, ura_dora_count
--   FROM hand_results
--  WHERE COALESCE(ura_dora_count, 0) > 0
--  ORDER BY match_round DESC;
