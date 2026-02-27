"use client";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function ChatCTAButton({ children, className }: Props) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("open-floating-chat"))}
      className={className}
    >
      {children}
    </button>
  );
}
