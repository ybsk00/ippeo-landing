"use client";

import { useState, useRef, useEffect } from "react";
import type { Language } from "@/lib/chatApi";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  language: Language;
}

export default function ChatInput({
  onSend,
  disabled,
  language,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder =
    language === "ko"
      ? "메시지를 입력하세요..."
      : "メッセージを入力してください...";

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = Math.min(scrollHeight, 120) + "px";
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-[480px] sm:max-w-[640px] mx-auto bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#3A2630] placeholder-gray-400 focus:outline-none focus:border-[#C97FAF] focus:ring-1 focus:ring-[#C97FAF]/30 disabled:bg-gray-50 disabled:text-gray-400 transition-colors font-[Noto_Sans_JP]"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="w-10 h-10 rounded-full bg-[#C97FAF] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#B06A99] active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            aria-label={language === "ko" ? "전송" : "送信"}
          >
            <span className="material-symbols-outlined text-xl">
              send
            </span>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          {language === "ko"
            ? "본 상담은 참고용이며 전문 의료 상담을 대체하지 않습니다"
            : "本相談は参考情報であり、専門医療相談の代わりにはなりません"}
        </p>
      </div>
    </div>
  );
}
