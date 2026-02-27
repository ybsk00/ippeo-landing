import type { ChatMessage as ChatMessageType, Language } from "@/lib/chatApi";
import RAGReferenceCard from "./RAGReferenceCard";

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

  // User messages (right-aligned, coral pink)
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          <div className="bg-[#FFE0F0] text-[#2C3E50] rounded-2xl rounded-tr-sm px-4 py-3">
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
  return (
    <div className="mb-4">
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF66CC] to-[#FF99DD] flex items-center justify-center flex-shrink-0 shadow-sm">
          <img
            src="/ippeo-logo.png"
            alt="IPPEO"
            className="w-5 h-5 rounded-sm"
          />
        </div>

        {/* Bubble */}
        <div>
          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-sm text-[#2C3E50] leading-relaxed whitespace-pre-wrap">
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
