"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  startRecording,
  isRecordingSupported,
  type RecordingHandle,
} from "@/lib/audioUtils";
import {
  sendVoiceMessage,
  type VoiceMessageResponse,
  type Language,
} from "@/lib/chatApi";

type VoiceState = "idle" | "recording" | "processing";

interface VoiceMicButtonProps {
  sessionId: string | null;
  disabled: boolean;
  language: Language;
  onVoiceResult: (result: VoiceMessageResponse) => void;
  onError?: (error: string) => void;
  /** Called when state changes (for parent to disable text input) */
  onStateChange?: (state: VoiceState) => void;
}

const LABELS = {
  ja: {
    micPermissionDenied: "マイクの使用を許可してください",
    processingVoice: "音声を処理中...",
    recordingStart: "録音中... タップで停止",
  },
  ko: {
    micPermissionDenied: "마이크 사용을 허용해 주세요",
    processingVoice: "음성 처리 중...",
    recordingStart: "녹음 중... 탭하여 중지",
  },
};

export default function VoiceMicButton({
  sessionId,
  disabled,
  language,
  onVoiceResult,
  onError,
  onStateChange,
}: VoiceMicButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);
  const recordingRef = useRef<RecordingHandle | null>(null);
  const t = LABELS[language] || LABELS.ja;

  useEffect(() => {
    setSupported(isRecordingSupported());
  }, []);

  const updateState = useCallback(
    (newState: VoiceState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recordingRef.current?.cancel();
    };
  }, []);

  async function handleClick() {
    if (!sessionId || disabled) return;

    if (state === "recording") {
      // Stop recording → send
      if (!recordingRef.current) return;
      updateState("processing");

      try {
        const { base64, mimeType } = await recordingRef.current.stop();
        recordingRef.current = null;

        const result = await sendVoiceMessage(sessionId, base64, mimeType);
        onVoiceResult(result);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Voice message failed";
        onError?.(msg);
      } finally {
        updateState("idle");
      }
      return;
    }

    if (state === "idle") {
      // Start recording
      try {
        const handle = await startRecording(60_000);
        recordingRef.current = handle;
        updateState("recording");
      } catch {
        onError?.(t.micPermissionDenied);
      }
    }
  }

  if (!supported) return null;

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isDisabled = disabled || !sessionId || isProcessing;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        isRecording
          ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
          : isProcessing
          ? "bg-gray-300 text-gray-500 cursor-wait"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-[#C97FAF] active:scale-95"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={
        isRecording
          ? t.recordingStart
          : isProcessing
          ? t.processingVoice
          : language === "ko"
          ? "음성 입력"
          : "音声入力"
      }
      title={
        isRecording
          ? t.recordingStart
          : isProcessing
          ? t.processingVoice
          : language === "ko"
          ? "음성 입력"
          : "音声入力"
      }
    >
      {isProcessing ? (
        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : isRecording ? (
        <span className="material-symbols-outlined text-lg">stop</span>
      ) : (
        <span className="material-symbols-outlined text-lg">mic</span>
      )}
    </button>
  );
}
