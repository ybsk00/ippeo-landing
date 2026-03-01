/**
 * Audio utilities for voice chat: recording (MediaRecorder) + PCM playback (Web Audio API)
 */

export interface RecordingHandle {
  stop: () => Promise<{ blob: Blob; base64: string; mimeType: string }>;
  cancel: () => void;
}

/**
 * Start microphone recording. Returns a handle to stop/cancel.
 * Uses WebM/opus (Chrome/Edge/Firefox) or mp4 (Safari) codec.
 * Auto-stops after maxDurationMs (default 60s).
 */
export function startRecording(
  maxDurationMs = 60_000
): Promise<RecordingHandle> {
  return new Promise(async (resolve, reject) => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      reject(err);
      return;
    }

    // Pick a supported mimeType
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    let mimeType = "";
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        mimeType = c;
        break;
      }
    }
    // Fallback: let browser choose
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    const recorder = new MediaRecorder(stream, options);
    const chunks: Blob[] = [];
    let cancelled = false;
    let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // Auto-stop after max duration
    autoStopTimer = setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, maxDurationMs);

    function cleanup() {
      if (autoStopTimer) clearTimeout(autoStopTimer);
      stream.getTracks().forEach((t) => t.stop());
    }

    const handle: RecordingHandle = {
      stop: () =>
        new Promise((res) => {
          if (recorder.state === "inactive") {
            cleanup();
            const blob = new Blob(chunks, {
              type: recorder.mimeType || "audio/webm",
            });
            blobToBase64(blob).then((base64) =>
              res({
                blob,
                base64,
                mimeType: recorder.mimeType || "audio/webm",
              })
            );
            return;
          }
          recorder.onstop = () => {
            cleanup();
            const blob = new Blob(chunks, {
              type: recorder.mimeType || "audio/webm",
            });
            blobToBase64(blob).then((base64) =>
              res({
                blob,
                base64,
                mimeType: recorder.mimeType || "audio/webm",
              })
            );
          };
          recorder.stop();
        }),
      cancel: () => {
        cancelled = true;
        cleanup();
        if (recorder.state !== "inactive") recorder.stop();
      },
    };

    recorder.start();
    resolve(handle);
  });
}

/**
 * Check if MediaRecorder API is available
 */
export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Play raw PCM audio (24kHz, 16-bit signed, mono) from base64 string.
 * Returns a Promise that resolves when playback finishes.
 */
export function playPcmAudio(base64: string, sampleRate = 24000): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Int16 → Float32
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const ctx = new AudioContext({ sampleRate });
      const buffer = ctx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        ctx.close();
        resolve();
      };
      source.start();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Play MP3 audio from base64 string.
 * Returns a Promise that resolves when playback finishes.
 */
export function playMp3Audio(base64: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        ctx.close();
        resolve();
      };
      source.start();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Play audio from base64 — auto-detects format (mp3 or pcm).
 */
export function playAudio(base64: string, format: string | null): Promise<void> {
  if (format === "mp3") {
    return playMp3Audio(base64);
  }
  // Legacy PCM fallback
  return playPcmAudio(base64);
}

// ---- Helpers ----

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip "data:audio/webm;base64," prefix
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
