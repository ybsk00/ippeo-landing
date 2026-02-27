"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { chatAdminAPI, type ChatSessionDetail } from "@/lib/api";

export default function ChatbotSessionDetail() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [data, setData] = useState<ChatSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    chatAdminAPI
      .sessionDetail(sessionId)
      .then((d) => {
        setData(d);
        if (d.consultation?.customer_email) {
          setEmail(d.consultation.customer_email);
        }
        if (d.consultation?.customer_name) {
          setCustomerName(d.consultation.customer_name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleSendEmail() {
    if (!email.trim() || sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await chatAdminAPI.sendEmail(
        sessionId,
        email.trim(),
        customerName.trim() || undefined
      );
      setSendResult({
        type: "success",
        message:
          res.status === "sent"
            ? `이메일이 ${email}로 발송되었습니다.`
            : `리포트 생성 중입니다. 완료 후 ${email}로 자동 발송됩니다.`,
      });
    } catch (err) {
      setSendResult({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "이메일 발송에 실패했습니다.",
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400">
        세션을 찾을 수 없습니다.
      </div>
    );
  }

  const { session, messages, consultation, report } = data;

  return (
    <>
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
        <button
          onClick={() => router.push("/admin/chatbot")}
          className="mr-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-xl font-bold text-slate-800">
          {session.visitor_id} 세션 상세
        </h2>
      </header>

      <div className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Session Info + Email */}
          <div className="space-y-6">
            {/* Session Info */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                세션 정보
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">언어</span>
                  <span className="font-medium text-slate-800">
                    {session.language === "ja" ? "일본어" : "한국어"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">상태</span>
                  <span className="font-medium text-slate-800">
                    {session.status === "active" ? "활성" : "종료"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">메시지</span>
                  <span className="font-medium text-slate-800">
                    {messages.length}건
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">시작</span>
                  <span className="font-medium text-slate-800 text-xs">
                    {new Date(session.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
              </div>
            </div>

            {/* Consultation Info */}
            {consultation && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4">
                  상담 정보
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">고객명</span>
                    <span className="font-medium text-slate-800">
                      {consultation.customer_name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">이메일</span>
                    <span className="font-medium text-slate-800 text-xs">
                      {consultation.customer_email || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">분류</span>
                    <span className="font-medium text-slate-800">
                      {consultation.classification === "plastic_surgery"
                        ? "성형외과"
                        : consultation.classification === "dermatology"
                          ? "피부과"
                          : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">상태</span>
                    <span className="font-medium text-slate-800">
                      {consultation.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Report Info */}
            {report && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4">
                  리포트
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">상태</span>
                    <span className="font-medium text-slate-800">
                      {report.status}
                    </span>
                  </div>
                  {report.access_token && (
                    <Link
                      href={`/report/${report.access_token}`}
                      target="_blank"
                      className="flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">
                        open_in_new
                      </span>
                      리포트 보기
                    </Link>
                  )}
                  <Link
                    href={`/admin/reports/${report.id}`}
                    className="flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                    관리자 리포트 관리
                  </Link>
                </div>
              </div>
            )}

            {/* Email Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                이메일 발송
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    고객명
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="고객명 입력"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    이메일 주소
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소 입력"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={!email.trim() || sending}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-bold py-2.5 rounded-lg hover:bg-primary/90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-lg">
                      mail
                    </span>
                  )}
                  {sending ? "처리 중..." : "리포트 발송"}
                </button>
                {sendResult && (
                  <div
                    className={`mt-2 text-xs p-3 rounded-lg ${
                      sendResult.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {sendResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Conversation */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)]">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">
                  chat
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  대화 내용
                </h3>
                <span className="text-xs text-slate-400 ml-auto">
                  {messages.length}건의 메시지
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] ${
                          isUser
                            ? "bg-[#FFE0F0] text-[#2C3E50] rounded-2xl rounded-tr-sm"
                            : "bg-white text-[#2C3E50] rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm"
                        } px-4 py-3`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-medium text-slate-400">
                            {isUser ? "고객" : "상담사"}
                          </span>
                          <span className="text-[9px] text-slate-300">
                            {new Date(msg.created_at).toLocaleTimeString(
                              "ko-KR",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 block">
                      chat_bubble_outline
                    </span>
                    <p className="text-sm">대화 내용이 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
