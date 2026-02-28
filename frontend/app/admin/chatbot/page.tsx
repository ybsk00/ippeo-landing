"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { chatAdminAPI, type ChatSession, type ChatAdminStats } from "@/lib/api";

const LANG_MAP: Record<string, string> = {
  ja: "JP",
  ko: "KR",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "활성", color: "bg-green-100 text-green-800" },
  ended: { label: "종료", color: "bg-slate-100 text-slate-600" },
  converted: { label: "변환 완료", color: "bg-blue-100 text-blue-800" },
};

const CTA_MAP: Record<string, { label: string; color: string }> = {
  hot: { label: "Hot", color: "bg-red-100 text-red-700" },
  warm: { label: "Warm", color: "bg-orange-100 text-orange-700" },
  cool: { label: "Cool", color: "bg-blue-100 text-blue-700" },
};

export default function ChatbotAdmin() {
  const [stats, setStats] = useState<ChatAdminStats | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  // 이전 모달 상태
  const [transferModal, setTransferModal] = useState<ChatSession | null>(null);
  const [transferName, setTransferName] = useState("익명");
  const [transferEmail, setTransferEmail] = useState("");
  const [transferring, setTransferring] = useState(false);

  function loadData() {
    setLoading(true);
    Promise.all([
      chatAdminAPI.stats(),
      chatAdminAPI.sessions(page, 20, filter || undefined),
    ])
      .then(([s, r]) => {
        setStats(s);
        setSessions(r.sessions);
        setTotal(r.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [page, filter]);

  async function handleTransfer() {
    if (!transferModal || transferring) return;
    setTransferring(true);
    try {
      await chatAdminAPI.transfer(transferModal.id, transferName.trim(), transferEmail.trim());
      setTransferModal(null);
      loadData();
    } catch {
      alert("이전에 실패했습니다.");
    } finally {
      setTransferring(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  const statCards = stats
    ? [
        {
          label: "총 세션",
          value: `${stats.total_sessions}건`,
          icon: "forum",
          iconBg: "bg-blue-50 text-blue-600",
        },
        {
          label: "리포트 생성",
          value: `${stats.report_generated}건`,
          icon: "description",
          iconBg: "bg-purple-50 text-purple-600",
        },
        {
          label: "변환율",
          value: `${stats.conversion_rate}%`,
          icon: "trending_up",
          iconBg: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "오늘 세션",
          value: `${stats.today_sessions}건`,
          icon: "today",
          iconBg: "bg-amber-50 text-amber-600",
        },
      ]
    : [];

  return (
    <>
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-slate-800">챗봇 관리</h2>
        <div className="flex items-center gap-3">
          {stats && stats.active_sessions > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              활성 세션 {stats.active_sessions}건
            </span>
          )}
        </div>
      </header>

      <div className="p-8 max-w-[1400px] mx-auto w-full space-y-8">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-slate-500 text-sm font-medium">
                      {card.label}
                    </span>
                    <span
                      className={`p-2 rounded-lg material-symbols-outlined ${card.iconBg}`}
                    >
                      {card.icon}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Session List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">
                  채팅 세션 목록
                </h3>
                <div className="flex gap-2">
                  <select
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">전체</option>
                    <option value="active">활성</option>
                    <option value="ended">종료</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 border-b">방문자 ID</th>
                      <th className="px-6 py-3 border-b">언어</th>
                      <th className="px-6 py-3 border-b">메시지</th>
                      <th className="px-6 py-3 border-b">CTA</th>
                      <th className="px-6 py-3 border-b">연락처</th>
                      <th className="px-6 py-3 border-b">상태</th>
                      <th className="px-6 py-3 border-b">시작일시</th>
                      <th className="px-6 py-3 border-b">이전</th>
                      <th className="px-6 py-3 border-b"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {sessions.map((s) => {
                      const st = STATUS_MAP[s.status] || {
                        label: s.status,
                        color: "bg-slate-100 text-slate-600",
                      };
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-mono text-xs text-slate-700">
                            {s.visitor_id}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {LANG_MAP[s.language] || s.language}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {s.message_count}건
                          </td>
                          <td className="px-6 py-4">
                            {s.cta_level && CTA_MAP[s.cta_level] ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CTA_MAP[s.cta_level].color}`}
                              >
                                {CTA_MAP[s.cta_level].label}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {s.customer_email ? (
                              <span className="material-symbols-outlined text-sm text-slate-500" title={s.customer_email}>
                                mail
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {new Date(s.created_at).toLocaleString("ko-KR", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            {s.consultation_id ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                이전완료
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTransferModal(s);
                                  setTransferName(s.customer_name || "");
                                  setTransferEmail(s.customer_email || "");
                                }}
                                className="text-xs text-primary font-semibold hover:underline"
                              >
                                이전
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/admin/chatbot/${s.id}`}
                              className="text-primary text-xs font-semibold hover:underline"
                            >
                              상세
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {sessions.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-12 text-center text-slate-400"
                        >
                          채팅 세션이 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    총 {total}건 중 {(page - 1) * 20 + 1}-
                    {Math.min(page * 20, total)}건
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                    >
                      이전
                    </button>
                    <button
                      onClick={() =>
                        setPage(Math.min(totalPages, page + 1))
                      }
                      disabled={page >= totalPages}
                      className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">상담관리로 이전</h3>
            <p className="text-xs text-slate-500 mb-4">
              방문자 <span className="font-mono font-medium text-slate-700">{transferModal.visitor_id}</span> 세션을 상담관리로 이전합니다.
            </p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">고객명</label>
                <input
                  type="text"
                  value={transferName}
                  onChange={(e) => setTransferName(e.target.value)}
                  placeholder="고객명 입력"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">이메일</label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="이메일 입력"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setTransferModal(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="px-4 py-2 text-sm bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {transferring && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {transferring ? "이전 중..." : "이전하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
