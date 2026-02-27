"use client";

import { useState } from "react";
import type { RAGReference, Language } from "@/lib/chatApi";

interface RAGReferenceCardProps {
  references: RAGReference[];
  language: Language;
}

export default function RAGReferenceCard({
  references,
  language,
}: RAGReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!references || references.length === 0) return null;

  const label = language === "ko" ? "참고 정보" : "参考情報";
  const similarityLabel = language === "ko" ? "관련도" : "関連度";

  return (
    <div className="mt-2 ml-11">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 transition-colors font-medium"
      >
        <span className="material-symbols-outlined text-sm">
          {isExpanded ? "expand_less" : "expand_more"}
        </span>
        {label} ({references.length})
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {references.map((ref, i) => (
            <div
              key={ref.faq_id || i}
              className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-blue-800 leading-relaxed flex-1">
                  {ref.question}
                </p>
                <span className="text-[10px] text-blue-400 whitespace-nowrap flex-shrink-0">
                  {similarityLabel}: {Math.round(ref.similarity * 100)}%
                </span>
              </div>
              {ref.procedure_name && (
                <span className="inline-block mt-1.5 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {ref.procedure_name}
                </span>
              )}
              {ref.youtube_url && (
                <a
                  href={ref.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 ml-1 text-[10px] text-blue-400 hover:text-blue-600"
                >
                  <span className="material-symbols-outlined text-xs">
                    open_in_new
                  </span>
                  {language === "ko" ? "출처" : "出典"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
