-- ============================================
-- 009: 챗봇 대화형 이메일 동의 컬럼 추가
-- ============================================

-- 이메일 동의 대기 중인 이메일 주소
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS pending_email TEXT;

-- 이메일 수집 동의 상태
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS email_consent_status TEXT
    CHECK (email_consent_status IN ('pending', 'agreed', 'declined'));
