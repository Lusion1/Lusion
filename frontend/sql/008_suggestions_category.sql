-- 008: 문의사항(suggestions) 게시판에 카테고리 추가
-- 'inquiry' (문의, 기본값) / 'update' (사이트 업데이트 공지, 관리자만 작성 가능)
ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'inquiry';

ALTER TABLE suggestions
  DROP CONSTRAINT IF EXISTS chk_suggestion_category;
ALTER TABLE suggestions
  ADD CONSTRAINT chk_suggestion_category CHECK (category IN ('inquiry','update'));

CREATE INDEX IF NOT EXISTS idx_suggestions_category ON suggestions(category);
