import { type Dict } from "@/lib/i18n";

interface Props {
  t: Dict;
}

const featureIcons = [
  "face_retouching_natural",
  "verified",
  "support_agent",
] as const;

export default function CategoryCards({ t }: Props) {
  const features = [
    { icon: featureIcons[0], title: t.feature1_title, desc: t.feature1_desc },
    { icon: featureIcons[1], title: t.feature2_title, desc: t.feature2_desc },
    { icon: featureIcons[2], title: t.feature3_title, desc: t.feature3_desc },
  ];

  return (
    <section id="features" className="py-20 lg:py-32 bg-[#FDF7FA]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center text-center">
          <span className="text-[#FF66CC] font-bold tracking-wider uppercase text-sm mb-2">
            {t.features_label}
          </span>
          <h2 className="text-3xl font-black tracking-tight text-[#2D1A25] sm:text-4xl lg:text-5xl max-w-3xl">
            {t.features_title}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[#6B4A5C]">
            {t.features_desc}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col rounded-3xl bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-[#FF66CC]/5 hover:-translate-y-2 border border-transparent hover:border-[#FF66CC]/20"
            >
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF66CC]/10 to-purple-100 text-[#FF66CC] group-hover:from-[#FF66CC] group-hover:to-pink-500 group-hover:text-white transition-all duration-300 shadow-sm">
                <span className="material-symbols-outlined text-4xl">{feature.icon}</span>
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#2D1A25]">{feature.title}</h3>
              <p className="text-[#6B4A5C] leading-relaxed text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
