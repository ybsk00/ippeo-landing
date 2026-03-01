interface ReportFooterProps {
  lang?: "ja" | "ko";
}

export default function ReportFooter({ lang = "ja" }: ReportFooterProps) {
  const isKo = lang === "ko";

  return (
    <footer className="bg-white border-t border-gray-100 p-8 text-center">
      <div className="flex justify-center items-center gap-2 mb-6">
        <img
          src="/arumi-logo.png"
          alt="ARUMI"
          className="w-6 h-6 rounded"
        />
        <span className="text-sm font-bold text-text-dark">
          {isKo ? "ARUMI | 온라인 상담 리포트" : "ARUMI | オンライン相談リポート"}
        </span>
      </div>
      <a
        href="#"
        className="inline-flex items-center justify-center bg-coral text-white font-bold px-8 py-3 rounded-full text-sm mb-8 w-full card-shadow hover:bg-coral/90 transition-colors"
      >
        {isKo ? "상담사에게 문의하기" : "カウンセラーに相談する"}
      </a>
      <div className="space-y-2">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          {isKo
            ? "본 리포트는 상담 시 내용을 바탕으로 작성된 것이며, 확정적인 진단이나 치료를 보장하는 것은 아닙니다."
            : "本リポートはカウンセリング時の内容を元に作成されたものであり、確定的な診断や治療を保証するものではありません。"}
        </p>
        <p className="text-[10px] text-gray-400">
          &copy; 2026 ARUMI Beauty Consultation.
        </p>
      </div>
    </footer>
  );
}
