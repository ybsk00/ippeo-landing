import { type Dict } from "@/lib/i18n";

interface Props {
  t: Dict;
}

export default function StatsBar({ t }: Props) {
  const stats = [
    { value: t.stats_consultations, label: t.stats_consultations_label },
    { value: t.stats_clinics, label: t.stats_clinics_label },
    { value: t.stats_satisfaction, label: t.stats_satisfaction_label },
  ];

  return (
    <section className="relative z-10 -mt-8 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-indigo-100/50 border border-white/50 py-8 px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-[#FADBE9]">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 pt-4 sm:pt-0 first:pt-0">
              <span className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#FF66CC] to-purple-600">
                {stat.value}
              </span>
              <span className="text-sm font-bold text-[#6B4A5C]">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
