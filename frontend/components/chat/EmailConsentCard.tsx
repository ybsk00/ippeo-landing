"use client";

import { useState } from "react";
import type { Language } from "@/lib/chatApi";

interface Props {
  email: string;
  language: Language;
  onConsent: (agreed: boolean) => Promise<void>;
}

const LABELS = {
  ja: {
    title: "個人情報の収集・利用への同意",
    desc: "リポート送付のため、以下のメールアドレスを収集・利用いたします。",
    privacy: "収集されたメールアドレスはリポート送付の目的にのみ使用され、第三者に提供されることはありません。",
    agree: "同意する",
    decline: "同意しない",
    declined: "同意いただけませんでした。引き続きご相談をお楽しみください。",
  },
  ko: {
    title: "개인정보 수집 및 이용 동의",
    desc: "리포트 발송을 위해 아래 이메일 주소를 수집 및 이용합니다.",
    privacy: "수집된 이메일 주소는 리포트 발송 목적으로만 사용되며, 제3자에게 제공되지 않습니다.",
    agree: "동의",
    decline: "동의하지 않음",
    declined: "동의하지 않으셨습니다. 계속 상담을 이어가실 수 있습니다.",
  },
};

export default function EmailConsentCard({ email, language, onConsent }: Props) {
  const [status, setStatus] = useState<"pending" | "loading" | "done">("pending");
  const [declined, setDeclined] = useState(false);
  const t = LABELS[language] || LABELS.ja;

  async function handleClick(agreed: boolean) {
    setStatus("loading");
    try {
      await onConsent(agreed);
      if (!agreed) setDeclined(true);
      setStatus("done");
    } catch {
      setStatus("pending");
    }
  }

  if (status === "done" && declined) {
    return (
      <div className="ml-11 mb-4 max-w-[85%]">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-gray-500">{t.declined}</p>
        </div>
      </div>
    );
  }

  if (status === "done") return null;

  return (
    <div className="ml-11 mb-4 max-w-[85%]">
      <div className="bg-white border border-[#C97FAF]/30 rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[#C97FAF] text-lg">shield</span>
          <p className="text-xs font-bold text-[#3A2630]">{t.title}</p>
        </div>
        <p className="text-xs text-gray-600 mb-2">{t.desc}</p>
        <p className="text-xs font-medium text-[#C97FAF] bg-[#C97FAF]/5 rounded-lg px-3 py-1.5 mb-2">
          {email}
        </p>
        <p className="text-[10px] text-gray-400 mb-3">{t.privacy}</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleClick(true)}
            disabled={status === "loading"}
            className="flex-1 flex items-center justify-center gap-1 bg-[#C97FAF] text-white text-xs font-bold py-2 rounded-lg hover:bg-[#B06A99] disabled:bg-gray-300 transition-colors"
          >
            {status === "loading" ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-sm">check</span>
            )}
            {t.agree}
          </button>
          <button
            onClick={() => handleClick(false)}
            disabled={status === "loading"}
            className="flex-1 text-xs text-gray-500 border border-gray-200 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {t.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
