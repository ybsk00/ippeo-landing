import { type Dict, type Lang } from "@/lib/i18n";
import ChatCTAButton from "@/components/chat/ChatCTAButton";

interface Props {
  t: Dict;
  lang: Lang;
}

export default function HeroSection({ t, lang }: Props) {

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-28 lg:pb-32 mesh-gradient">
      {/* Background blobs */}
      <div className="absolute top-20 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[#C97FAF]/20 to-purple-200/20 rounded-full blur-[100px] opacity-60 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-blue-100/30 to-pink-100/30 rounded-full blur-[80px] opacity-60 pointer-events-none -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          {/* Left: Text */}
          <div className="flex flex-col gap-8 lg:w-1/2 lg:pr-8 z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-[#C97FAF] w-fit border border-[#C97FAF]/20 shadow-sm">
              <span className="material-symbols-outlined text-lg">smart_toy</span>
              {t.hero_badge}
            </div>

            {/* Title */}
            <h1
              className="text-5xl font-black leading-[1.1] tracking-tight text-[#3A2630] sm:text-6xl lg:text-7xl"
              style={{ fontFamily: lang === "ja" ? "'Noto Sans JP', sans-serif" : "'Noto Sans KR', sans-serif" }}
            >
              {t.hero_title_1}
              <br />
              <span className="text-gradient">{t.hero_title_accent}</span>
              {t.hero_title_2}
            </h1>

            {/* Description */}
            <p className="text-lg text-[#7B6670] sm:text-xl leading-relaxed max-w-lg font-medium">
              {t.hero_desc}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <ChatCTAButton
                className="group flex h-14 items-center justify-center rounded-full bg-[#C97FAF] hover:bg-[#B06A99] text-white px-8 text-lg font-bold shadow-lg shadow-[#C97FAF]/25 transition-all hover:scale-105 hover:shadow-[#C97FAF]/35 cursor-pointer"
              >
                <span>{t.hero_cta}</span>
                <span className="material-symbols-outlined ml-2 text-xl group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </ChatCTAButton>
              <a
                href="#process"
                className="flex h-14 items-center justify-center rounded-full bg-white border border-[#E8D0D9] text-[#3A2630] hover:bg-gray-50 px-8 text-lg font-bold transition-all shadow-sm"
              >
                <span className="material-symbols-outlined mr-2 text-xl text-[#C97FAF]">play_circle</span>
                <span>{t.hero_cta2}</span>
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-semibold text-[#7B6670]">
              <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg border border-white/50">
                <span className="material-symbols-outlined text-[#C97FAF] text-lg">verified_user</span>
                <span>{t.hero_trust1}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg border border-white/50">
                <span className="material-symbols-outlined text-[#C97FAF] text-lg">translate</span>
                <span>{t.hero_trust2}</span>
              </div>
            </div>
          </div>

          {/* Right: Video + Floating panels */}
          <div className="relative lg:w-1/2 lg:h-[600px] flex items-center justify-center">
            <div className="relative w-full aspect-[4/5] md:aspect-square lg:aspect-auto lg:h-full">
              {/* Decorative blobs */}
              <div className="absolute top-[10%] right-[5%] w-24 h-24 bg-gradient-to-br from-pink-300 to-purple-300 rounded-full blur-xl opacity-60 floating-delayed z-0" />
              <div className="absolute bottom-[15%] left-[10%] w-32 h-32 bg-gradient-to-tr from-blue-200 to-[#C97FAF]/40 rounded-full blur-2xl opacity-50 floating z-0" />

              {/* Main video frame */}
              <div className="absolute inset-4 md:inset-8 lg:inset-0 lg:top-8 lg:bottom-8 lg:left-8 lg:right-8 rounded-[2.5rem] p-3 bg-white/30 backdrop-blur-sm border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] transform rotate-[-2deg] transition-transform duration-700 hover:rotate-0 z-10">
                <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-inner">
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                    src="/hero-video.mp4"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#C97FAF]/10 via-transparent to-transparent mix-blend-overlay" />
                </div>
              </div>

              {/* Floating panel: Beauty Analysis */}
              <div className="absolute top-[15%] left-0 md:-left-4 lg:-left-4 z-20 glass-panel p-4 rounded-2xl shadow-lg border border-white max-w-[220px] floating">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#C97FAF] to-purple-500 flex items-center justify-center text-white shadow-lg shadow-[#C97FAF]/25">
                    <span className="material-symbols-outlined text-xl">face</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.hero_float_label}</p>
                    <p className="text-sm font-bold text-[#3A2630]">{t.hero_float_text}</p>
                    <p className="text-xs text-[#C97FAF] font-bold mt-1">{t.hero_float_match}</p>
                  </div>
                </div>
              </div>

              {/* Floating panel: Satisfaction */}
              <div className="absolute bottom-[20%] right-0 md:-right-4 lg:-right-8 z-20 glass-panel p-4 rounded-2xl shadow-lg border border-white max-w-[200px] floating-delayed">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    <div className="h-9 w-9 rounded-full border-2 border-white bg-gradient-to-br from-pink-200 to-pink-300" />
                    <div className="h-9 w-9 rounded-full border-2 border-white bg-gradient-to-br from-purple-200 to-purple-300" />
                    <div className="h-9 w-9 rounded-full border-2 border-white bg-[#C97FAF] text-white flex items-center justify-center text-xs font-bold shadow-md">
                      <span className="material-symbols-outlined text-sm">favorite</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#3A2630]">{t.hero_float_rank}</span>
                    <span className="text-[10px] text-[#7B6670]">{t.hero_float_count}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
