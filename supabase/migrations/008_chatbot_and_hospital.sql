-- ============================================
-- 008: 챗봇 세션 + 병원 전환 시스템 테이블
-- ============================================

-- ============================================
-- 8. 챗봇 세션 테이블
-- ============================================
CREATE TABLE chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- 소비자 정보
    visitor_id TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    language TEXT DEFAULT 'ja' CHECK (language IN ('ja', 'ko')),

    -- 세션 상태
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active',
        'completed',
        'report_generated',
        'abandoned'
    )),

    -- AI 분석 결과 (대화 종료 시 생성)
    classification TEXT CHECK (classification IN ('dermatology', 'plastic_surgery', 'unclassified')),
    intent_extraction JSONB,
    cta_level TEXT CHECK (cta_level IN ('hot', 'warm', 'cool')),

    -- 연결
    consultation_id UUID REFERENCES consultations(id),
    report_id UUID REFERENCES reports(id),

    -- 메타
    message_count INT DEFAULT 0,
    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_visitor ON chat_sessions(visitor_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);

CREATE TRIGGER trigger_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. 챗봇 메시지 테이블
-- ============================================
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,

    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- RAG 참조 (assistant 메시지에서 어떤 FAQ를 참조했는지)
    rag_references JSONB,

    -- 메타
    token_count INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ============================================
-- 10. 병원 테이블
-- ============================================
CREATE TABLE hospitals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_ja TEXT,
    name_ko TEXT,
    category TEXT CHECK (category IN ('dermatology', 'plastic_surgery', 'both')),

    -- 병원 정보
    description TEXT,
    website_url TEXT,
    location TEXT,

    -- API 연동
    api_key TEXT UNIQUE,

    -- 상태
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trigger_hospitals_updated_at
    BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. 전환 이벤트 테이블
-- ============================================
CREATE TABLE conversion_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES hospitals(id),
    chat_session_id UUID REFERENCES chat_sessions(id),
    report_id UUID REFERENCES reports(id),

    -- 전환 단계
    event_type TEXT NOT NULL CHECK (event_type IN (
        'report_generated',
        'report_viewed',
        'hospital_clicked',
        'inquiry_submitted',
        'appointment_booked'
    )),

    -- 메타
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversion_hospital ON conversion_events(hospital_id, created_at);
CREATE INDEX idx_conversion_type ON conversion_events(event_type, created_at);

-- ============================================
-- 12. 병원별 월간 집계
-- ============================================
CREATE TABLE hospital_monthly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES hospitals(id),
    year_month TEXT NOT NULL,

    -- 집계 수치
    total_sessions INT DEFAULT 0,
    total_reports INT DEFAULT 0,
    total_views INT DEFAULT 0,
    total_clicks INT DEFAULT 0,
    total_inquiries INT DEFAULT 0,
    total_bookings INT DEFAULT 0,

    -- 전환율
    view_rate FLOAT,
    click_rate FLOAT,
    inquiry_rate FLOAT,
    booking_rate FLOAT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (hospital_id, year_month)
);

CREATE TRIGGER trigger_hospital_monthly_stats_updated_at
    BEFORE UPDATE ON hospital_monthly_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
