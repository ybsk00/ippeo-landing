"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import {
  startSession,
  sendMessage,
  type ChatMessage as ChatMessageType,
  type Language,
} from "@/lib/chatApi";

export default function ChatClient() {
  const searchParams = useSearchParams();
  const lang = (searchParams.get("lang") as Language) || "ja";

  // ---- State ----
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = lang === "ko" ? LABELS_KO : LABELS_JA;

  // ---- Scroll to bottom ----
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // ---- Initialize session ----
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await startSession(lang);
        if (cancelled) return;
        setSessionId(res.session_id);
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: res.greeting,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        if (cancelled) return;
        console.error("Session start failed:", err);
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
  }, [lang]);

  // ---- Send message ----
  async function handleSend(content: string) {
    if (!sessionId || isTyping) return;

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);

    try {
      const res = await sendMessage(sessionId, content);

      const aiMsg: ChatMessageType = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: res.content,
        rag_references: res.rag_references,
        agent_type: res.agent_type,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Send message failed:", err);
      const errorMsg: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: "system",
        content: err instanceof Error ? err.message : t.errorSend,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }

  // ---- Loading state ----
  if (isInitializing) {
    return (
      <div className="max-w-[480px] sm:max-w-[640px] mx-auto min-h-screen flex items-center justify-center font-[Noto_Sans_JP]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#C97FAF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  // ---- Error state (init failure) ----
  if (error && !sessionId) {
    return (
      <div className="max-w-[480px] sm:max-w-[640px] mx-auto min-h-screen flex items-center justify-center font-[Noto_Sans_JP]">
        <div className="text-center px-8">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-4 block">
            error_outline
          </span>
          <p className="text-base font-bold text-[#3A2630] mb-2">
            {t.errorTitle}
          </p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#C97FAF] text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-[#B06A99] transition-colors"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] sm:max-w-[640px] mx-auto min-h-screen flex flex-col font-[Noto_Sans_JP] bg-[#FFFDFB]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C97FAF] to-[#DFA3C7] flex items-center justify-center shadow-sm">
            <img
              src="/arumi-logo.png"
              alt="ARUMI"
              className="w-6 h-6 rounded-sm"
            />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#3A2630]">
              ARUMI {t.headerTitle}
            </h1>
            <p className="text-[10px] text-gray-400">{t.headerSub}</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-36">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} language={lang} />
        ))}

        {isTyping && <TypingIndicator language={lang} />}

        {/* Inline error banner */}
        {error && sessionId && (
          <div className="mb-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-red-500 text-lg flex-shrink-0 mt-0.5">
                warning
              </span>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isTyping || !sessionId}
        language={lang}
      />
    </div>
  );
}

// ============================================
// Labels
// ============================================

const LABELS_JA = {
  loading: "チャットを準備中...",
  errorTitle: "接続エラー",
  errorInit:
    "チャットセッションを開始できませんでした。しばらくしてから再度お試しください。",
  errorSend: "メッセージの送信に失敗しました。もう一度お試しください。",
  retry: "再試行",
  headerTitle: "カウンセリング",
  headerSub: "韓国美容医療の専門相談",
};

const LABELS_KO = {
  loading: "채팅 준비 중...",
  errorTitle: "연결 오류",
  errorInit:
    "채팅 세션을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  errorSend: "메시지 전송에 실패했습니다. 다시 시도해 주세요.",
  retry: "재시도",
  headerTitle: "상담",
  headerSub: "한국 미용의료 전문 상담",
};
