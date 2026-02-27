import { Suspense } from "react";
import ChatClient from "./ChatClient";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[480px] sm:max-w-[640px] mx-auto min-h-screen flex items-center justify-center font-[Noto_Sans_JP]">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#C97FAF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <ChatClient />
    </Suspense>
  );
}
