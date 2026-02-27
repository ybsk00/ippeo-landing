import { getDict } from "@/lib/i18n";
import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import StatsBar from "@/components/landing/StatsBar";
import CategoryCards from "@/components/landing/CategoryCards";
import ServiceIntro from "@/components/landing/ServiceIntro";
import FAQSection from "@/components/landing/FAQSection";
import LandingFooter from "@/components/landing/LandingFooter";
import Link from "next/link";

export const metadata = {
  title: "IPPEO | 한국 미용의료 AI 컨설팅",
  description: "AI가 맞춤 한국 미용의료 플랜을 만들어드립니다. 무료 상담을 시작하세요.",
};

export default function LandingPageKo() {
  const t = getDict("ko");

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#FDF7FA]" style={{ fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}>
      <LandingHeader t={t} lang="ko" />
      <main className="flex-1">
        <HeroSection t={t} lang="ko" />
        <StatsBar t={t} />
        <CategoryCards t={t} />
        <ServiceIntro t={t} />
        <FAQSection t={t} />

        {/* Bottom CTA */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF66CC] to-[#E045A5] text-white shadow-2xl shadow-[#FF66CC]/40 relative">
            <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
            <div className="relative flex flex-col items-center justify-center gap-8 px-6 py-16 text-center md:px-12 lg:py-24">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl drop-shadow-sm">
                {t.cta_title}
              </h2>
              <p className="max-w-2xl text-lg font-medium text-white/90 sm:text-xl">
                {t.cta_desc}
              </p>
              <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row mt-4">
                <Link
                  href="/chat?lang=ko"
                  className="w-full sm:w-auto h-14 rounded-full bg-white text-[#FF66CC] px-10 text-lg font-bold shadow-lg transition-transform hover:scale-105 hover:bg-gray-50 flex items-center justify-center"
                >
                  {t.cta_button1}
                </Link>
                <a
                  href="#"
                  className="w-full sm:w-auto h-14 rounded-full bg-transparent border-2 border-white/40 hover:bg-white/10 text-white px-10 text-lg font-bold transition-colors flex items-center justify-center"
                >
                  {t.cta_button2}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter t={t} />
    </div>
  );
}
