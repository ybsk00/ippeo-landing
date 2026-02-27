"use client";

import { useEffect, useState, useCallback } from "react";
import {
  hospitalAPI,
  type HospitalStats,
  type HospitalReport,
} from "@/lib/hospitalApi";
import { usePeriod } from "@/lib/hospitalPeriodContext";
import StatsCards from "@/components/hospital/StatsCards";
import FunnelChart from "@/components/hospital/FunnelChart";
import ReportTable from "@/components/hospital/ReportTable";

export default function HospitalDashboardPage() {
  const { period, periodLabel } = usePeriod();
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [reports, setReports] = useState<HospitalReport[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(true);

  const PAGE_SIZE = 10;

  // ============================================
  // Fetch stats
  // ============================================
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const data = await hospitalAPI.stats(period);
      setStats(data);
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "통계 데이터를 불러올 수 없습니다."
      );
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [period]);

  // ============================================
  // Fetch reports
  // ============================================
  const fetchReports = useCallback(async (page: number) => {
    setReportsLoading(true);
    try {
      const data = await hospitalAPI.reports(page);
      setReports(data.data);
      setReportTotal(data.total);
    } catch {
      setReports([]);
      setReportTotal(0);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchReports(reportPage);
  }, [reportPage, fetchReports]);

  // Reset report page when period changes
  useEffect(() => {
    setReportPage(1);
  }, [period]);

  const handlePageChange = (newPage: number) => {
    setReportPage(newPage);
  };

  // ============================================
  // Funnel steps (from stats or defaults)
  // ============================================
  const funnelSteps = stats?.funnel?.length
    ? stats.funnel.map((s) => ({
        name: s.name,
        count: s.count,
        rate: s.rate,
      }))
    : stats
      ? [
          {
            name: "리포트 발송",
            count: stats.total_reports,
            rate: 100,
          },
          {
            name: "리포트 열람",
            count: stats.total_views,
            rate: stats.view_rate,
          },
          {
            name: "CTA 클릭",
            count: stats.total_clicks,
            rate: stats.click_rate,
          },
          {
            name: "문의 전환",
            count: stats.total_inquiries,
            rate: stats.inquiry_rate,
          },
          {
            name: "예약 완료",
            count: stats.total_bookings,
            rate: stats.booking_rate,
          },
        ]
      : [];

  return (
    <>
      {/* Sub-header with period info */}
      <div className="px-4 sm:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              전환 분석 대시보드
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              기간: {periodLabel}
            </p>
          </div>
          <button
            onClick={() => {
              fetchStats();
              fetchReports(1);
              setReportPage(1);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            새로고침
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 pt-4 max-w-[1400px] mx-auto w-full space-y-6">
        {/* Error State */}
        {statsError && !stats && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">
              cloud_off
            </span>
            <p className="text-lg font-medium text-slate-600">
              데이터를 불러올 수 없습니다
            </p>
            <p className="text-sm text-slate-400 mt-1">{statsError}</p>
            <button
              onClick={fetchStats}
              className="mt-4 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <StatsCards
          totalReports={stats?.total_reports ?? 0}
          totalViews={stats?.total_views ?? 0}
          totalClicks={stats?.total_clicks ?? 0}
          totalInquiries={stats?.total_inquiries ?? 0}
          viewRate={stats?.view_rate ?? 0}
          clickRate={stats?.click_rate ?? 0}
          inquiryRate={stats?.inquiry_rate ?? 0}
          loading={statsLoading}
        />

        {/* Funnel Chart + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funnel - takes 2 cols */}
          <div className="lg:col-span-2">
            <FunnelChart steps={funnelSteps} loading={statsLoading} />
          </div>

          {/* Quick Insights */}
          <div className="lg:col-span-1 space-y-4">
            {/* Conversion Summary Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                전환 요약
              </h3>
              {statsLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-4 w-20 bg-slate-200 rounded"></div>
                      <div className="h-4 w-12 bg-slate-100 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">열람률</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {stats?.view_rate ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">클릭률</span>
                    <span className="text-sm font-bold text-amber-600">
                      {stats?.click_rate ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">문의율</span>
                    <span className="text-sm font-bold text-purple-600">
                      {stats?.inquiry_rate ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">예약율</span>
                    <span className="text-sm font-bold text-primary">
                      {stats?.booking_rate ?? 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Performance Indicator */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-xl border border-blue-200/50">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-xl">
                  trending_up
                </span>
                <h3 className="text-sm font-bold text-slate-800">성과 지표</h3>
              </div>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 w-20 bg-blue-200/50 rounded mb-1"></div>
                  <div className="h-3 w-32 bg-blue-200/30 rounded"></div>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-primary">
                    {stats?.total_bookings ?? 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {periodLabel} 예약 전환 건수
                  </p>
                  {stats && stats.total_reports > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200/50">
                      <p className="text-xs text-slate-600">
                        리포트 1건당 예약 전환:
                        <span className="font-bold text-primary ml-1">
                          {(
                            (stats.total_bookings / stats.total_reports) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Reports Table */}
        <ReportTable
          reports={reports}
          total={reportTotal}
          page={reportPage}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          loading={reportsLoading}
        />
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 px-8 text-center text-slate-400 text-xs border-t border-slate-200 bg-white">
        &copy; 2026 ARUMI. All rights reserved.
      </footer>
    </>
  );
}
