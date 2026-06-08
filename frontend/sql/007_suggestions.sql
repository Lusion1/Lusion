-- 007: 건의 게시판 (suggestions)
-- 관리자에게 건의/제안을 남기는 게시판. 관리자가 응답 + 상태 변경 가능.

CREATE TABLE IF NOT EXISTS suggestions (
    id              SERIAL PRIMARY KEY,
    nickname        VARCHAR(50)  NOT NULL,        -- 작성자 닉네임 (필수, 매번 입력)
    title           VARCHAR(200) NOT NULL,        -- 제목
    content         TEXT         NOT NULL,        -- 본문
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    admin_reply     TEXT,                          -- 관리자 답글 (1개)
    admin_reply_by  VARCHAR(50),                   -- 답변한 관리자 ID
    admin_reply_at  TIMESTAMPTZ,                   -- 답변 시각
    created_by      VARCHAR(50),                   -- 작성 당시 로그인 ID (없으면 NULL)
    CONSTRAINT chk_suggestion_status
      CHECK (status IN ('pending','received','done','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_status     ON suggestions(status);
