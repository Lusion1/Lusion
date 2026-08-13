-- =====================================================================
-- 014: 문의 답글 스레드화 (누구나 답글 가능)
--   suggestion_comments: 글 하나에 여러 답글 (관리자/일반 구분은 author_role)
--   기존 admin_reply 는 댓글로 이관, 원본 컬럼은 백업용으로 유지
--   ※ 2026-08-03 Supabase 에 적용 완료 (재실행 안전 - IF NOT EXISTS/NOT EXISTS 가드)
-- =====================================================================

CREATE TABLE IF NOT EXISTS suggestion_comments (
  id SERIAL PRIMARY KEY,
  suggestion_id INT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  author_name VARCHAR(50) NOT NULL,
  author_role VARCHAR(20) NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_suggestion_comments_sid ON suggestion_comments(suggestion_id);

INSERT INTO suggestion_comments (suggestion_id, author_name, author_role, content, created_at)
SELECT s.id, COALESCE(s.admin_reply_by, 'admin'), 'admin', s.admin_reply, COALESCE(s.admin_reply_at, s.updated_at, CURRENT_TIMESTAMP)
  FROM suggestions s
 WHERE s.admin_reply IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM suggestion_comments c
      WHERE c.suggestion_id = s.id AND c.content = s.admin_reply
   );
