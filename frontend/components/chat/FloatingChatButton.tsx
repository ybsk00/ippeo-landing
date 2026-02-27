"use client";

import { useState, useEffect } from "react";
import type { Lang } from "@/lib/i18n";
import FloatingChatPanel from "./FloatingChatPanel";

interface Props {
  lang: Lang;
}

const LABELS = {
  ja: "24時間 無料相談",
  ko: "24시간 무료 상담",
};

export default function FloatingChatButton({ lang }: Props) {
  const [open, setOpen] = useState(false);

  // Listen for CTA button clicks across the page
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-floating-chat", handler);
    return () => window.removeEventListener("open-floating-chat", handler);
  }, []);

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#FF66CC] to-[#FF99DD] px-6 py-4 text-white shadow-xl shadow-[#FF66CC]/30 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-[#FF66CC]/40 active:scale-95 animate-pulse-slow"
        >
          <span className="material-symbols-outlined text-2xl">chat</span>
          <span className="text-sm font-bold whitespace-nowrap">
            {LABELS[lang]}
          </span>
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <FloatingChatPanel lang={lang} onClose={() => setOpen(false)} />
      )}

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { box-shadow: 0 10px 25px -5px rgba(255, 102, 204, 0.3); }
          50% { box-shadow: 0 10px 40px -5px rgba(255, 102, 204, 0.5); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
