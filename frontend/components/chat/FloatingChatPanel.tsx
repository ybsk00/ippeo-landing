"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ReportPrompt from "./ReportPrompt";
import {
  startSession,
  sendMessage,
  requestReport,
  checkReportStatus,
  type ChatMessage as ChatMessageType,
  type Language,
} from "@/lib/chatApi";
import type { Lang } from "@/lib/i18n";

interface Props {
  lang: Lang;
  onClose: () => void;
}

const MIN_TURNS_FOR_REPORT = 5;

const LABELS = {
  ja: {
    title: "無料相談",
    subtitle: "韓国美容医療の専門相談",
    loading: "チャットを準備中...",
    errorInit: "接続エラーが発生しました。再試行してください。",
    errorSend: "メッセージの送信に失敗しました。",
    errorReport: "リポートの作成に失敗しました。",
    retry: "再試行",
    placeholder: "メッセージを入力してください...",
    disclaimer: "本相談は参考情報であり、専門医療相談の代わりにはなりません",
  },
  ko: {
    title: "무료 상담",
    subtitle: "한국 미용의료 전문 상담",
    loading: "채팅 준비 중...",
    errorInit: "연결 오류가 발생했습니다. 재시도해 주세요.",
    errorSend: "메시지 전송에 실패했습니다.",
    errorReport: "리포트 생성에 실패했습니다.",
    retry: "재시도",
    placeholder: "메시지를 입력하세요...",
    disclaimer: "본 상담은 참고용이며 전문 의료 상담을 대체하지 않습니다",
  },
};

export default function FloatingChatPanel({ lang, onClose }: Props) {
  const t = LABELS[lang];
  const language: Language = lang;

  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ippeo_chat_session_id");
    }
    return null;
  });
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [canGenerateReport, setCanGenerateReport] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportToken, setReportToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userTurnCount = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Initialize session
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await startSession(language);
        if (cancelled) return;
        setSessionId(res.session_id);
        sessionStorage.setItem("ippeo_chat_session_id", res.session_id);
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: res.greeting,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch {
        if (cancelled) return;
        setError(t.errorInit);
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (reportPollRef.current) clearInterval(reportPollRef.current);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
  }, [inputValue]);

  // Send message
  async function handleSend() {
    const content = inputValue.trim();
    if (!content || !sessionId || isTyping) return;

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    userTurnCount.current += 1;
    setInputValue("");
    setIsTyping(true);
    setError(null);

    try {
      const res = await sendMessage(sessionId, content);
      const aiMsg: ChatMessageType = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: res.content,
        rag_references: res.rag_references,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (res.can_generate_report || userTurnCount.current >= MIN_TURNS_FOR_REPORT) {
        setCanGenerateReport(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: t.errorSend,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  // Report request
  async function handleReportRequest(name: string, email: string) {
    if (!sessionId || isGeneratingReport) return;

    setIsGeneratingReport(true);
    setError(null);

    try {
      await requestReport(sessionId, { customer_name: name, customer_email: email });

      reportPollRef.current = setInterval(async () => {
        try {
          const status = await checkReportStatus(sessionId);
          if (status.status === "ready" && status.access_token) {
            setReportToken(status.access_token);
            setIsGeneratingReport(false);
            if (reportPollRef.current) {
              clearInterval(reportPollRef.current);
              reportPollRef.current = null;
            }
          } else if (status.status === "failed") {
            setIsGeneratingReport(false);
            setError(t.errorReport);
            if (reportPollRef.current) {
              clearInterval(reportPollRef.current);
              reportPollRef.current = null;
            }
          }
        } catch {
          // silently retry
        }
      }, 5000);
    } catch {
      setIsGeneratingReport(false);
      setError(t.errorReport);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-50 bg-black/30 md:bg-transparent md:pointer-events-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Panel */}
        <div
          className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[600px] md:rounded-2xl bg-[#FAFAFA] shadow-2xl flex flex-col z-50 overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="bg-gradient-to-r from-[#FF66CC] to-[#FF99DD] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <img
                  src="/ippeo-logo.png"
                  alt="IPPEO"
                  className="w-6 h-6 rounded-sm"
                />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">{t.title}</h2>
                <p className="text-[10px] text-white/80">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </header>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
            {isInitializing ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-8 h-8 border-3 border-[#FF66CC] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-gray-400">{t.loading}</p>
                </div>
              </div>
            ) : error && !sessionId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center px-6">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
                    error_outline
                  </span>
                  <p className="text-sm text-gray-500 mb-3">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-[#FF66CC] text-white text-xs font-bold px-5 py-2 rounded-full hover:bg-[#E055B3]"
                  >
                    {t.retry}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} language={language} />
                ))}
                {isTyping && <TypingIndicator language={language} />}

                {canGenerateReport && !reportToken && (
                  <ReportPrompt
                    language={language}
                    onRequest={handleReportRequest}
                    isGenerating={isGeneratingReport}
                    reportToken={reportToken}
                  />
                )}
                {reportToken && (
                  <ReportPrompt
                    language={language}
                    onRequest={handleReportRequest}
                    isGenerating={false}
                    reportToken={reportToken}
                  />
                )}

                {error && sessionId && (
                  <div className="mb-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 bg-white px-3 py-2.5 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.placeholder}
                disabled={isTyping || !sessionId}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#2C3E50] placeholder-gray-400 focus:outline-none focus:border-[#FF66CC] focus:ring-1 focus:ring-[#FF66CC]/30 disabled:bg-gray-50 disabled:text-gray-400 transition-colors font-[Noto_Sans_JP]"
              />
              <button
                onClick={handleSend}
                disabled={isTyping || !sessionId || !inputValue.trim()}
                className="w-9 h-9 rounded-full bg-[#FF66CC] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#E055B3] active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
            <p className="text-[9px] text-gray-400 mt-1 text-center">
              {t.disclaimer}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
