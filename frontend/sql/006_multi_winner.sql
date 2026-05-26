-- 006: 같은 hand 에 여러 화료자(더블론/트리플론) 허용
ALTER TABLE hand_results ADD COLUMN IF NOT EXISTS multi_index SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE hand_results DROP CONSTRAINT IF EXISTS uq_round_hand;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_round_hand_multi') THEN
        ALTER TABLE hand_results ADD CONSTRAINT uq_round_hand_multi UNIQUE (match_round, hand_number, multi_index);
    END IF;
END $$;
