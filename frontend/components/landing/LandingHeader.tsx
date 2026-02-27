"use client";

import { useState } from "react";
import Link from "next/link";
import { type Dict, type Lang } from "@/lib/i18n";

interface Props {
  t: Dict;
  lang: Lang;
}

export default function LandingHeader({ t, lang }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const langSwitchHref = lang === "ja" ? "/ko" : "/";

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-white/50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={lang === "ja" ? "/" : "/ko"} className="flex items-center gap-2">
          <div className="size-9 rounded-lg flex items-center justify-center overflow-hidden">
            <img src="/arumi-logo.png" alt="ARUMI" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-[#3A2630]">ARUMI</h2>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex flex-1 justify-end gap-8 items-center">
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-bold text-[#7B6670] hover:text-[#C97FAF] transition-colors">
              {t.nav_service}
            </a>
            <a href="#process" className="text-sm font-bold text-[#7B6670] hover:text-[#C97FAF] transition-colors">
              {t.nav_clinic}
            </a>
            <a href="#faq" className="text-sm font-bold text-[#7B6670] hover:text-[#C97FAF] transition-colors">
              {t.nav_about}
            </a>
          </div>
          <div className="flex gap-3 items-center pl-6 border-l border-[#E8D0D9]">
            <Link
              href={langSwitchHref}
              aria-label="Language Selector"
              className="flex items-center justify-center rounded-full bg-white hover:bg-gray-50 text-[#3A2630] h-10 w-10 border border-[#E8D0D9] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-xl">language</span>
            </Link>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-3">
          <Link
            href={langSwitchHref}
            className="flex items-center justify-center rounded-full bg-white text-[#3A2630] h-9 w-9 border border-[#E8D0D9] shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">language</span>
          </Link>
          <button
            className="text-[#3A2630] p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="material-symbols-outlined">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#E8D0D9] px-4 py-4 space-y-3">
          <a href="#features" className="block text-sm font-bold text-[#7B6670] py-2">{t.nav_service}</a>
          <a href="#process" className="block text-sm font-bold text-[#7B6670] py-2">{t.nav_clinic}</a>
          <a href="#faq" className="block text-sm font-bold text-[#7B6670] py-2">{t.nav_about}</a>
        </div>
      )}
    </header>
  );
}
