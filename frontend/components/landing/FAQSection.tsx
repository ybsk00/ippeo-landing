"use client";

import { useState } from "react";
import { type Dict } from "@/lib/i18n";

interface Props {
  t: Dict;
}

export default function FAQSection({ t }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = [
    { q: t.faq1_q, a: t.faq1_a },
    { q: t.faq2_q, a: t.faq2_a },
    { q: t.faq3_q, a: t.faq3_a },
    { q: t.faq4_q, a: t.faq4_a },
  ];

  return (
    <section id="faq" className="py-20 lg:py-32 bg-[#FDF7FA]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <span className="mb-2 block text-sm font-bold uppercase tracking-wider text-[#C97FAF]">FAQ</span>
          <h2 className="text-3xl font-black text-[#3A2630] sm:text-4xl">{t.faq_title}</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`rounded-2xl overflow-hidden transition-all ${
                openIdx === idx
                  ? "bg-white shadow-lg shadow-[#C97FAF]/5 border border-[#C97FAF]/20"
                  : "bg-white border border-[#E8D0D9] hover:border-[#C97FAF]/30"
              }`}
            >
              <button
                className="w-full px-6 py-5 text-left flex items-center justify-between group"
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              >
                <span className="font-bold text-[#3A2630] pr-4">{faq.q}</span>
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    openIdx === idx
                      ? "bg-[#C97FAF] text-white rotate-180"
                      : "bg-[#C97FAF]/10 text-[#C97FAF]"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </div>
              </button>
              {openIdx === idx && (
                <div className="px-6 pb-5 text-[#7B6670] text-sm leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
