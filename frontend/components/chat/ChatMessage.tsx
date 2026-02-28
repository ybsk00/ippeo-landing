import type { ChatMessage as ChatMessageType, Language, AgentType } from "@/lib/chatApi";
import RAGReferenceCard from "./RAGReferenceCard";

const AGENT_LABELS: Record<AgentType, { ja: string; ko: string }> = {
  greeting: { ja: "アシスタント", ko: "안내" },
  general: { ja: "アシスタント", ko: "안내" },
  consultation: { ja: "カウンセラー", ko: "상담실장" },
  medical: { ja: "専門コンサルタント", ko: "전문상담" },
};

interface ChatMessageProps {
  message: ChatMessageType;
  language: Language;
}

export default function ChatMessage({ message, language }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  // System messages (center-aligned, subtle)
  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-gray-100 text-gray-500 text-xs px-4 py-2 rounded-full max-w-[80%] text-center">
          {message.content}
        </div>
      </div>
    );
  }

  // User messages (right-aligned, warm beige)
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          <div className="bg-[#F3E6DF] text-[#3A2630] rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // AI messages (left-aligned, white with shadow)
  const agentLabel = message.agent_type
    ? AGENT_LABELS[message.agent_type]?.[language] || ""
    : "";

  return (
    <div className="mb-4">
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C97FAF] to-[#DFA3C7] flex items-center justify-center flex-shrink-0 shadow-sm">
          <img
            src="/arumi-logo.png"
            alt="ARUMI"
            className="w-5 h-5 rounded-sm"
          />
        </div>

        {/* Bubble */}
        <div>
          {agentLabel && (
            <p className="text-[10px] text-[#C97FAF] font-medium mb-1 ml-1">
              {agentLabel}
            </p>
          )}
          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-sm text-[#3A2630] leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>

      {/* RAG References */}
      {message.rag_references && message.rag_references.length > 0 && (
        <RAGReferenceCard
          references={message.rag_references}
          language={language}
        />
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
