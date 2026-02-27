"use client";

interface FunnelStep {
  name: string;
  count: number;
  rate: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
  loading?: boolean;
}

const STEP_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-50", text: "text-blue-700" },
  { bg: "bg-sky-500", light: "bg-sky-50", text: "text-sky-700" },
  { bg: "bg-teal-500", light: "bg-teal-50", text: "text-teal-700" },
  { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-700" },
  { bg: "bg-green-500", light: "bg-green-50", text: "text-green-700" },
];

const DEFAULT_STEPS: FunnelStep[] = [
  { name: "리포트 발송", count: 0, rate: 100 },
  { name: "리포트 열람", count: 0, rate: 0 },
  { name: "CTA 클릭", count: 0, rate: 0 },
  { name: "문의 전환", count: 0, rate: 0 },
  { name: "예약 완료", count: 0, rate: 0 },
];

export default function FunnelChart({ steps, loading }: FunnelChartProps) {
  const data = steps.length > 0 ? steps : DEFAULT_STEPS;
  const maxCount = Math.max(...data.map((s) => s.count), 1);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="h-5 w-40 bg-slate-200 rounded mb-6 animate-pulse"></div>
        <div className="space-y-4">
          {[100, 80, 55, 40, 30].map((w, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-3 w-16 bg-slate-100 rounded"></div>
              </div>
              <div className="h-10 bg-slate-100 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-slate-200 rounded-lg"
                  style={{ width: `${w}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800">전환 퍼널</h3>
        <span className="text-xs text-slate-400">
          리포트 발송 대비 전환율
        </span>
      </div>

      <div className="space-y-3">
        {data.map((step, idx) => {
          const color = STEP_COLORS[idx % STEP_COLORS.length];
          const barWidth =
            maxCount > 0
              ? Math.max((step.count / maxCount) * 100, 2)
              : 2;

          return (
            <div key={step.name}>
              {/* Label Row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${color.bg}`}></div>
                  <span className="text-sm font-medium text-slate-700">
                    {step.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-800">
                    {step.count.toLocaleString()}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color.light} ${color.text}`}
                  >
                    {step.rate}%
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="w-full h-9 bg-slate-50 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${color.bg} rounded-lg transition-all duration-700 ease-out relative`}
                  style={{ width: `${barWidth}%` }}
                >
                  {barWidth > 15 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-xs font-semibold">
                      {step.rate}%
                    </span>
                  )}
                </div>
              </div>

              {/* Drop-off indicator (between steps) */}
              {idx < data.length - 1 && idx > 0 && (
                <div className="flex justify-end mt-1 mb-1">
                  <span className="text-[10px] text-slate-400">
                    {data[idx].count > 0 && data[idx + 1]
                      ? `${((1 - data[idx + 1].count / data[idx].count) * 100).toFixed(0)}% 이탈`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall conversion */}
      {data.length >= 2 && data[0].count > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              총 전환율 ({data[0].name} &rarr; {data[data.length - 1].name})
            </span>
            <span className="text-lg font-bold text-primary">
              {data[data.length - 1].rate}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
