"use client";

import type { HospitalReport } from "@/lib/hospitalApi";

interface ReportTableProps {
  reports: HospitalReport[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: "생성 완료", color: "bg-amber-100 text-amber-800" },
  approved: { label: "승인 완료", color: "bg-blue-100 text-blue-800" },
  sent: { label: "발송 완료", color: "bg-emerald-100 text-emerald-800" },
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  plastic_surgery: "성형외과",
  dermatology: "피부과",
};

const CTA_BADGE: Record<string, { label: string; color: string }> = {
  hot: { label: "Hot", color: "bg-red-100 text-red-700" },
  warm: { label: "Warm", color: "bg-amber-100 text-amber-700" },
  cool: { label: "Cool", color: "bg-slate-100 text-slate-600" },
};

export default function ReportTable({
  reports,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
}: ReportTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
              <div className="h-4 w-16 bg-slate-100 rounded"></div>
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
              <div className="h-4 w-14 bg-slate-100 rounded"></div>
              <div className="h-4 flex-1 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">최근 리포트</h3>
        <span className="text-xs text-slate-400">
          총 {total.toLocaleString()}건
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 border-b">고객</th>
              <th className="px-6 py-3 border-b">분류</th>
              <th className="px-6 py-3 border-b">시술 키워드</th>
              <th className="px-6 py-3 border-b">상태</th>
              <th className="px-6 py-3 border-b">CTA</th>
              <th className="px-6 py-3 border-b">열람</th>
              <th className="px-6 py-3 border-b">생성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {reports.map((report) => {
              const status = STATUS_BADGE[report.status] || {
                label: report.status,
                color: "bg-slate-100 text-slate-600",
              };
              const classification =
                CLASSIFICATION_LABEL[report.classification || ""] || "--";
              const cta = report.cta_level
                ? CTA_BADGE[report.cta_level]
                : null;

              return (
                <tr
                  key={report.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {report.customer_name_masked}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {classification}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {report.procedure_keywords.slice(0, 3).map((kw, i) => (
                        <span
                          key={i}
                          className="inline-flex px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                      {report.procedure_keywords.length > 3 && (
                        <span className="text-xs text-slate-400">
                          +{report.procedure_keywords.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {cta ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cta.color}`}
                      >
                        {cta.label}
                      </span>
                    ) : (
                      <span className="text-slate-400">--</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {report.viewed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <span className="material-symbols-outlined text-base">
                          check_circle
                        </span>
                        <span className="text-xs">
                          {report.viewed_at
                            ? new Date(report.viewed_at).toLocaleDateString(
                                "ko-KR",
                                { month: "short", day: "numeric" }
                              )
                            : "열람"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">미열람</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(report.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  <span className="material-symbols-outlined text-4xl mb-2 block">
                    inbox
                  </span>
                  리포트가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1} -{" "}
            {Math.min(page * pageSize, total)} / {total}건
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                chevron_left
              </span>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                    pageNum === page
                      ? "bg-primary text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
