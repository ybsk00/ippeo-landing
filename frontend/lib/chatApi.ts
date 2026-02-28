const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// ============================================
// 타입 정의
// ============================================

export type Language = "ja" | "ko";

export interface RAGReference {
  faq_id: string;
  question: string;
  answer: string;
  procedure_name?: string;
  similarity: number;
  youtube_url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  rag_references?: RAGReference[];
  agent_type?: AgentType;
  timestamp: string;
}

export interface StartSessionResponse {
  session_id: string;
  visitor_id: string;
  greeting: string;
}

export type AgentType = "greeting" | "general" | "consultation" | "medical";

export interface SendMessageResponse {
  content: string;
  rag_references?: RAGReference[];
  can_generate_report: boolean;
  agent_type?: AgentType;
  pending_email?: string;
}

export interface EndSessionResponse {
  consultation_id: string;
  status: string;
}

export interface ChatHistoryResponse {
  session: {
    id: string;
    language: Language;
    created_at: string;
  };
  messages: ChatMessage[];
}

export interface ReportStatusResponse {
  status: "not_started" | "generating" | "ready" | "failed";
  access_token?: string;
  report_id?: string;
}

// ============================================
// API 호출 함수
// ============================================

async function fetchChatAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.detail || `API Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

/**
 * 채팅 세션 시작
 * - language: 'ja' (일본어, 기본) 또는 'ko' (한국어)
 * - 서버에서 greeting 메시지와 session_id 반환
 */
export function startSession(
  language: Language = "ja"
): Promise<StartSessionResponse> {
  return fetchChatAPI<StartSessionResponse>("/chat/start", {
    method: "POST",
    body: JSON.stringify({ language }),
  });
}

/**
 * 메시지 전송
 * - content: 사용자 입력 텍스트
 * - AI 응답 + RAG 참조 + 리포트 생성 가능 여부 반환
 */
export function sendMessage(
  sessionId: string,
  content: string
): Promise<SendMessageResponse> {
  return fetchChatAPI<SendMessageResponse>("/chat/message", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, content }),
  });
}

/**
 * 세션 종료 + 상담 등록
 * - 채팅 내용을 consultation으로 변환
 * - customer_name, customer_email 필수
 */
export function endSession(
  sessionId: string,
  opts: {
    customer_name: string;
    customer_email: string;
    customer_line_id?: string;
  }
): Promise<EndSessionResponse> {
  return fetchChatAPI<EndSessionResponse>("/chat/end", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, ...opts }),
  });
}

/**
 * 채팅 이력 조회
 */
export function getHistory(
  sessionId: string
): Promise<ChatHistoryResponse> {
  return fetchChatAPI<ChatHistoryResponse>(
    `/chat/history/${sessionId}`
  );
}

/**
 * 리포트 생성 상태 확인
 */
export function checkReportStatus(
  sessionId: string
): Promise<ReportStatusResponse> {
  return fetchChatAPI<ReportStatusResponse>(
    `/chat/report-status/${sessionId}`
  );
}

/**
 * 리포트 생성 요청
 */
export function requestReport(
  sessionId: string,
  opts: {
    customer_name: string;
    customer_email: string;
  }
): Promise<{ consultation_id: string; status: string }> {
  return fetchChatAPI("/chat/end", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, ...opts }),
  });
}

/**
 * 이메일 수집 동의 확인
 */
export function confirmEmail(
  sessionId: string,
  email: string,
  agreed: boolean
): Promise<{ status: string; message?: string }> {
  return fetchChatAPI("/chat/confirm-email", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, email, agreed }),
  });
}
