"use client";

import { useState } from "react";
import type { Language } from "@/lib/chatApi";

interface ReportPromptProps {
  language: Language;
  onRequest: (name: string, email: string) => void;
  isGenerating: boolean;
  reportToken: string | null;
}

export default function ReportPrompt({
  language,
  onRequest,
  isGenerating,
  reportToken,
}: ReportPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const t = language === "ko" ? LABELS_KO : LABELS_JA;

  // Report is ready -- show link
  if (reportToken) {
    const reportUrl = `${window.location.origin}/report/${reportToken}`;
    return (
      <div className="mx-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-green-600 text-xl">
              check_circle
            </span>
            <p className="text-sm font-bold text-green-800">{t.reportReady}</p>
          </div>
          <p className="text-xs text-green-700 mb-3">{t.reportReadyDesc}</p>
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#C97FAF] text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-[#B06A99] transition-colors w-full justify-center"
          >
            <span className="material-symbols-outlined text-lg">
              description
            </span>
            {t.viewReport}
          </a>
        </div>
      </div>
    );
  }

  // Generating in progress
  if (isGenerating) {
    return (
      <div className="mx-4 mb-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                {t.generating}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {t.generatingDesc}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed state -- show prompt button
  if (!isOpen) {
    return (
      <div className="mx-4 mb-4">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-gradient-to-r from-[#C97FAF] to-[#DFA3C7] text-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">
              auto_awesome
            </span>
            <span className="text-sm font-bold">{t.createReport}</span>
          </div>
          <p className="text-[11px] text-white/80 mt-1">{t.createReportDesc}</p>
        </button>
      </div>
    );
  }

  // Expanded state -- input form
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onRequest(name.trim(), email.trim());
  }

  return (
    <div className="mx-4 mb-4">
      <div className="bg-white border border-[#C97FAF]/30 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C97FAF] text-xl">
              auto_awesome
            </span>
            <p className="text-sm font-bold text-[#3A2630]">
              {t.createReport}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t.formDesc}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 font-medium mb-1 block">
              {t.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#3A2630] placeholder-gray-400 focus:outline-none focus:border-[#C97FAF] focus:ring-1 focus:ring-[#C97FAF]/30 font-[Noto_Sans_JP]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium mb-1 block">
              {t.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#3A2630] placeholder-gray-400 focus:outline-none focus:border-[#C97FAF] focus:ring-1 focus:ring-[#C97FAF]/30"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !email.trim()}
            className="w-full bg-[#C97FAF] text-white text-sm font-bold py-2.5 rounded-full hover:bg-[#B06A99] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Labels
// ============================================

const LABELS_JA = {
  createReport: "リポートを作成する",
  createReportDesc:
    "ご相談内容をもとに、専門的なリポートをお作りします",
  formDesc:
    "リポートの送付先をご入力ください。作成後、メールでお届けします。",
  nameLabel: "お名前",
  namePlaceholder: "例: 田中 花子",
  emailLabel: "メールアドレス",
  emailPlaceholder: "例: hanako@example.com",
  submit: "リポートを作成する",
  generating: "リポートを作成中...",
  generatingDesc: "数分かかる場合があります。そのままお待ちください。",
  reportReady: "リポートが完成しました",
  reportReadyDesc:
    "下のボタンから、あなた専用のリポートをご覧いただけます。",
  viewReport: "リポートを見る",
};

const LABELS_KO = {
  createReport: "리포트 작성하기",
  createReportDesc:
    "상담 내용을 바탕으로 전문 리포트를 작성해 드립니다",
  formDesc:
    "리포트를 받으실 정보를 입력해 주세요. 작성 완료 후 이메일로 발송됩니다.",
  nameLabel: "이름",
  namePlaceholder: "예: 홍길동",
  emailLabel: "이메일 주소",
  emailPlaceholder: "예: hong@example.com",
  submit: "리포트 작성하기",
  generating: "리포트 생성 중...",
  generatingDesc: "몇 분 소요될 수 있습니다. 잠시만 기다려 주세요.",
  reportReady: "리포트가 완성되었습니다",
  reportReadyDesc:
    "아래 버튼으로 전용 리포트를 확인하실 수 있습니다.",
  viewReport: "리포트 보기",
};
