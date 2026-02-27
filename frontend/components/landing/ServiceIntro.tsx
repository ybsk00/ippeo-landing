import { type Dict } from "@/lib/i18n";

interface Props {
  t: Dict;
}

const stepIcons = ["smartphone", "description", "flight_takeoff", "medical_services"] as const;

export default function ServiceIntro({ t }: Props) {
  const steps = [
    { label: t.step1_label, title: t.step1_title, desc: t.step1_desc, icon: stepIcons[0] },
    { label: t.step2_label, title: t.step2_title, desc: t.step2_desc, icon: stepIcons[1] },
    { label: t.step3_label, title: t.step3_title, desc: t.step3_desc, icon: stepIcons[2] },
    { label: t.step4_label, title: t.step4_title, desc: t.step4_desc, icon: stepIcons[3] },
  ];

  return (
    <section id="process" className="py-20 lg:py-32 bg-white border-t border-dashed border-[#FADBE9]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-16 text-center">
          <span className="mb-2 block text-sm font-bold uppercase tracking-wider text-[#FF66CC]">
            {t.process_label}
          </span>
          <h2 className="text-3xl font-black text-[#2D1A25] sm:text-4xl">{t.process_title}</h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-6 h-[calc(100%-48px)] w-0.5 bg-gradient-to-b from-[#FF66CC]/20 via-[#FF66CC]/50 to-[#FF66CC]/20 md:left-1/2 md:-ml-px" />

          <div className="flex flex-col gap-16">
            {steps.map((step, idx) => {
              const isLeft = idx % 2 === 0;
              const isFirst = idx === 0;

              return (
                <div key={step.label} className="group relative flex flex-col gap-6 md:flex-row md:items-center md:gap-0">
                  {/* Left content (even steps) */}
                  {isLeft ? (
                    <>
                      <div className="flex md:w-1/2 md:justify-end md:pr-16">
                        <div className="flex flex-col md:items-end md:text-right bg-white p-6 rounded-2xl shadow-sm border border-[#FADBE9] md:border-transparent md:bg-transparent md:shadow-none md:p-0">
                          <span className={`mb-2 inline-block rounded px-2 py-1 text-xs font-bold ${isFirst ? "bg-[#FF66CC]/10 text-[#FF66CC]" : "bg-gray-100 text-gray-500"}`}>
                            {step.label}
                          </span>
                          <h3 className="text-xl font-bold text-[#2D1A25]">{step.title}</h3>
                          <p className="mt-2 text-[#6B4A5C] text-sm leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                      {/* Circle icon */}
                      <div
                        className={`absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white shadow-md md:left-1/2 md:-ml-6 z-10 transition-colors duration-300 ${
                          isFirst
                            ? "bg-[#FF66CC] text-white shadow-[0_0_20px_rgba(255,102,204,0.3)]"
                            : "bg-white text-[#6B4A5C] group-hover:bg-[#FF66CC] group-hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">{step.icon}</span>
                      </div>
                      <div className="pl-16 md:w-1/2 md:pl-12" />
                    </>
                  ) : (
                    <>
                      <div className="hidden md:block md:w-1/2 md:pr-12" />
                      {/* Circle icon */}
                      <div className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-white text-[#6B4A5C] shadow-md md:left-1/2 md:-ml-6 z-10 group-hover:bg-[#FF66CC] group-hover:text-white transition-colors duration-300">
                        <span className="material-symbols-outlined text-lg">{step.icon}</span>
                      </div>
                      {/* Right content (odd steps) */}
                      <div className="flex pl-16 md:w-1/2 md:pl-16">
                        <div className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-[#FADBE9] md:border-transparent md:bg-transparent md:shadow-none md:p-0">
                          <span className="mb-2 inline-block w-fit rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500">
                            {step.label}
                          </span>
                          <h3 className="text-xl font-bold text-[#2D1A25]">{step.title}</h3>
                          <p className="mt-2 text-[#6B4A5C] text-sm leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
