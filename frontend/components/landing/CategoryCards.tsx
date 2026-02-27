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
          <span className="text-[#C97FAF] font-bold tracking-wider uppercase text-sm mb-2">
            {t.features_label}
          </span>
          <h2 className="text-3xl font-black tracking-tight text-[#3A2630] sm:text-4xl lg:text-5xl max-w-3xl">
            {t.features_title}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[#7B6670]">
            {t.features_desc}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col rounded-3xl bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-[#C97FAF]/5 hover:-translate-y-2 border border-transparent hover:border-[#C97FAF]/20"
            >
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C97FAF]/10 to-purple-100 text-[#C97FAF] group-hover:from-[#C97FAF] group-hover:to-pink-500 group-hover:text-white transition-all duration-300 shadow-sm">
                <span className="material-symbols-outlined text-4xl">{feature.icon}</span>
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#3A2630]">{feature.title}</h3>
              <p className="text-[#7B6670] leading-relaxed text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
