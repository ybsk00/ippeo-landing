import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IPPEO | AI Beauty Consultation",
  description:
    "韓国美容医療のAIカウンセリングチャット。あなたのお悩みに合わせた専門的なアドバイスをお届けします。",
  openGraph: {
    title: "IPPEO | AI Beauty Consultation",
    description:
      "韓国美容医療のAIカウンセリングチャット",
    siteName: "IPPEO",
    locale: "ja_JP",
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {children}
    </div>
  );
}
