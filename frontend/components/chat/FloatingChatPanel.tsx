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
  type RAGReference,
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
    title: "IPPEO 相談室",
    subtitle: "相談員 IPPEOコンサルタントが待機中",
    statusOnline: "オンライン",
    loading: "チャットを準備中...",
    errorInit: "接続エラーが発生しました。再試行してください。",
    errorSend: "メッセージの送信に失敗しました。",
    errorReport: "リポートの作成に失敗しました。",
    retry: "再試行",
    placeholder: "궁금한 내용을 물어보세요...",
    disclaimer:
      "本相談内容は参考用であり、正確な診断と処方は必ず来院して専門医と相談されることをお勧めします。",
    videoTitle: "関連映像おすすめ",
    videoPlaceholder: "相談内容と関連した映像が\nここに表示されます。",
    videoChannel: "YouTube チャンネルへ",
    consultantName: "IPPEOコンサルタント",
  },
  ko: {
    title: "IPPEO 상담실",
    subtitle: "상담원 IPPEO 컨설턴트가 대기중",
    statusOnline: "온라인",
    loading: "채팅 준비 중...",
    errorInit: "연결 오류가 발생했습니다. 재시도해 주세요.",
    errorSend: "메시지 전송에 실패했습니다.",
    errorReport: "리포트 생성에 실패했습니다.",
    retry: "재시도",
    placeholder: "궁금한 내용을 물어보세요...",
    disclaimer:
      "본 상담 내용은 참고용이며, 정확한 진단과 처방은 반드시 내원하여 전문의와 상담하시기 바랍니다.",
    videoTitle: "관련 영상 추천",
    videoPlaceholder: "상담 내용과 관련된 영상이\n이곳에 표시됩니다.",
    videoChannel: "유튜브 채널 바로가기",
    consultantName: "IPPEO 컨설턴트",
  },
};

interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  procedure?: string;
}

function extractYouTubeVideos(messages: ChatMessageType[]): YouTubeVideo[] {
  const seen = new Set<string>();
  const videos: YouTubeVideo[] = [];

  for (const msg of messages) {
    if (!msg.rag_references) continue;
    for (const ref of msg.rag_references) {
      if (!ref.youtube_url || !ref.youtube_url.includes("youtube.com")) continue;
      const match = ref.youtube_url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );
      if (!match) continue;
      const videoId = match[1];
      if (seen.has(videoId)) continue;
      seen.add(videoId);
      videos.push({
        id: videoId,
        url: ref.youtube_url,
        title: ref.procedure_name || ref.question || "関連映像",
        procedure: ref.procedure_name,
      });
    }
  }
  return videos;
}

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
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userTurnCount = useRef(0);

  const youtubeVideos = extractYouTubeVideos(messages);

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

      if (
        res.can_generate_report ||
        userTurnCount.current >= MIN_TURNS_FOR_REPORT
      ) {
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
      await requestReport(sessionId, {
        customer_name: name,
        customer_email: email,
      });

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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Main modal — large centered */}
        <div
          className="w-full max-w-[1100px] h-[min(85vh,720px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ======== Header ======== */}
          <header className="bg-gradient-to-r from-[#FF66CC] to-[#FF88DD] px-5 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                <img
                  src="/ippeo-logo.png"
                  alt="IPPEO"
                  className="w-7 h-7 rounded-sm"
                />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {t.title}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                  <p className="text-xs text-white/80">{t.subtitle}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://ippeo-langding.web.app"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white/80 hover:bg-white/25 transition-colors"
                title="Open in new window"
              >
                <span className="material-symbols-outlined text-lg">
                  open_in_new
                </span>
              </a>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">
                  close
                </span>
              </button>
            </div>
          </header>

          {/* ======== Body: Two-column ======== */}
          <div className="flex-1 flex overflow-hidden">
            {/* ---- Left: Chat ---- */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2 bg-gradient-to-b from-[#FFF5FA] to-[#FAFAFA]">
                {isInitializing ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-[#FF66CC] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-gray-400">{t.loading}</p>
                    </div>
                  </div>
                ) : error && !sessionId ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center px-6">
                      <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">
                        error_outline
                      </span>
                      <p className="text-sm text-gray-500 mb-4">{error}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="bg-[#FF66CC] text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-[#E055B3]"
                      >
                        {t.retry}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Consultant intro card */}
                    <div className="flex items-center gap-2 mb-4 px-1">
                      <span className="text-xs font-bold text-[#FF66CC]">
                        {t.consultantName}
                      </span>
                    </div>

                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        language={language}
                      />
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
              <div className="border-t border-gray-100 bg-white px-5 py-3 flex-shrink-0">
                <div className="flex items-end gap-3">
                  <div className="flex-1 flex items-end bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-[#FF66CC] focus-within:ring-1 focus-within:ring-[#FF66CC]/20 transition-all">
                    <button className="text-gray-400 hover:text-gray-500 mr-2 mb-0.5 flex-shrink-0">
                      <span className="material-symbols-outlined text-xl">
                        add_circle
                      </span>
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t.placeholder}
                      disabled={isTyping || !sessionId}
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm text-[#2C3E50] placeholder-gray-400 focus:outline-none disabled:text-gray-300 leading-relaxed"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isTyping || !sessionId || !inputValue.trim()}
                    className="w-10 h-10 rounded-full bg-[#FF66CC] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#E055B3] active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md shadow-[#FF66CC]/20"
                  >
                    <span className="material-symbols-outlined text-lg">
                      send
                    </span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center leading-relaxed">
                  {t.disclaimer}
                </p>
              </div>
            </div>

            {/* ---- Right: YouTube Recommendations (hidden on mobile) ---- */}
            <div className="hidden md:flex w-[320px] lg:w-[360px] flex-col border-l border-gray-100 bg-[#FAFAFA] flex-shrink-0">
              {/* Video section header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF66CC] text-xl">
                    play_circle
                  </span>
                  <h3 className="text-sm font-bold text-gray-800">
                    {t.videoTitle}
                  </h3>
                </div>
                <a
                  href="https://ippeo-langding.web.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">
                    open_in_new
                  </span>
                </a>
              </div>

              {/* Video embed area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Active video embed */}
                {activeVideoId ? (
                  <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                    <div className="aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${activeVideoId}?rel=0`}
                        title="YouTube video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                ) : youtubeVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-3xl text-gray-300">
                        play_circle
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 whitespace-pre-line leading-relaxed">
                      {t.videoPlaceholder}
                    </p>
                  </div>
                ) : null}

                {/* Video list */}
                {youtubeVideos.length > 0 && (
                  <div className="space-y-3">
                    {youtubeVideos.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => setActiveVideoId(video.id)}
                        className={`w-full flex gap-3 p-3 rounded-xl border transition-all text-left hover:shadow-sm ${
                          activeVideoId === video.id
                            ? "border-[#FF66CC] bg-[#FFF5FA] shadow-sm"
                            : "border-gray-200 bg-white hover:border-[#FF66CC]/40"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                          <img
                            src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                              <span className="material-symbols-outlined text-white text-sm">
                                play_arrow
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-relaxed">
                            {video.title}
                          </p>
                          {video.procedure && (
                            <span className="inline-block mt-1 text-[10px] font-medium text-[#FF66CC] bg-[#FFF0F8] px-2 py-0.5 rounded-full">
                              {video.procedure}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* YouTube channel link */}
              <div className="px-4 py-3 border-t border-gray-100">
                <a
                  href="#"
                  className="flex items-center justify-center gap-2 text-xs font-semibold text-[#FF66CC] hover:text-[#E055B3] transition-colors py-2 px-4 rounded-lg hover:bg-[#FFF5FA]"
                >
                  <span className="material-symbols-outlined text-base">
                    smart_display
                  </span>
                  {t.videoChannel}
                </a>
              </div>
            </div>
          </div>

          {/* ======== Footer bar ======== */}
          <div className="hidden md:flex items-center justify-between px-5 py-2 bg-gray-50 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <img
                src="/ippeo-logo.png"
                alt="IPPEO"
                className="w-4 h-4 rounded-sm opacity-50"
              />
              <span className="text-[10px] text-gray-400">
                IPPEO | Korean Beauty Medical Consulting
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              {lang === "ja" ? "닫기" : "닫기"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
