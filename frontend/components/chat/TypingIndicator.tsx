import type { Language } from "@/lib/chatApi";

interface TypingIndicatorProps {
  language: Language;
}

export default function TypingIndicator({ language }: TypingIndicatorProps) {
  const label = language === "ko" ? "생각 중..." : "考え中...";

  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
        <img
          src="/ippeo-logo.png"
          alt="IPPEO"
          className="w-5 h-5 rounded-sm"
        />
      </div>

      {/* Bubble */}
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "0.6s" }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms", animationDuration: "0.6s" }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms", animationDuration: "0.6s" }}
            />
          </div>
          <span className="text-xs text-gray-400 ml-1">{label}</span>
        </div>
      </div>
    </div>
  );
}
