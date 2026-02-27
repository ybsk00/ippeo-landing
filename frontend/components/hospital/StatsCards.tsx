"use client";

interface StatCard {
  label: string;
  value: number;
  rate: number | null;
  rateLabel: string;
  icon: string;
  iconBg: string;
  rateSuffix?: string;
}

interface StatsCardsProps {
  totalReports: number;
  totalViews: number;
  totalClicks: number;
  totalInquiries: number;
  viewRate: number;
  clickRate: number;
  inquiryRate: number;
  loading?: boolean;
}

export default function StatsCards({
  totalReports,
  totalViews,
  totalClicks,
  totalInquiries,
  viewRate,
  clickRate,
  inquiryRate,
  loading,
}: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: "리포트 생성",
      value: totalReports,
      rate: null,
      rateLabel: "전체 발송 건수",
      icon: "description",
      iconBg: "bg-blue-50 text-blue-600",
    },
    {
      label: "리포트 열람",
      value: totalViews,
      rate: viewRate,
      rateLabel: "열람률",
      icon: "visibility",
      iconBg: "bg-emerald-50 text-emerald-600",
      rateSuffix: "%",
    },
    {
      label: "CTA 클릭",
      value: totalClicks,
      rate: clickRate,
      rateLabel: "클릭률",
      icon: "ads_click",
      iconBg: "bg-amber-50 text-amber-600",
      rateSuffix: "%",
    },
    {
      label: "문의 전환",
      value: totalInquiries,
      rate: inquiryRate,
      rateLabel: "문의율",
      icon: "contact_mail",
      iconBg: "bg-purple-50 text-purple-600",
      rateSuffix: "%",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
              <div className="h-10 w-10 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="h-8 w-16 bg-slate-200 rounded mb-2"></div>
            <div className="h-3 w-24 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
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
          <div>
            <p className="text-3xl font-bold text-slate-800">
              {card.value.toLocaleString()}
            </p>
            {card.rate !== null ? (
              <p className="text-xs font-semibold mt-1 text-primary">
                {card.rateLabel} {card.rate}
                {card.rateSuffix}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">{card.rateLabel}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
