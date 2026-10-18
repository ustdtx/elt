export interface UtteranceOptions {
  rate?: number;
  pitch?: number;
}

const PREFERRED_VOICES = ["Samantha", "Google US English", "Aria", "Jenny", "Zira", "Female"];
export function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (voices.length === 0) return null;
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) return match;
  }
  return voices[0];
}

/**
 * Speaks the tutor's reply sentence by sentence as it streams, using the
 * hosted teaching voice. If the speech service is unavailable for a sentence,
 * that sentence falls back to the device voice so the lesson never goes mute.
 */
export class TutorSpeaker {
  private buffer = "";
  private queue: string[] = [];
  private playing = false;
  private generation = 0;
  private currentAudio: HTMLAudioElement | null = null;
  private inflight = new Set<AbortController>();
  private deviceVoice: SpeechSynthesisVoice | null;

  constructor() {
    this.deviceVoice = pickEnglishVoice();
    if (typeof window !== "undefined" && "speechSynthesis" in window && !this.deviceVoice) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => {
          this.deviceVoice = pickEnglishVoice();
        },
        { once: true }
      );
    }
  }

  reset(): void {
    this.generation++;
    this.buffer = "";
    this.queue = [];
    for (const controller of this.inflight) controller.abort();
    this.inflight.clear();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  push(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const match = this.buffer.match(/[.!?](\s|$)/);
      if (!match || match.index === undefined) break;
      const end = match.index + 1;
      const sentence = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end);
      if (sentence) this.enqueue(sentence);
    }
  }

  flush(): void {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (rest) this.enqueue(rest);
  }

  /** True while anything is still being spoken. */
  get speaking(): boolean {
    return this.playing || this.queue.length > 0;
  }

  private enqueue(sentence: string): void {
    this.queue.push(sentence);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    const generation = this.generation;
    try {
      while (this.queue.length > 0 && generation === this.generation) {
        const sentence = this.queue.shift()!;
        try {
          await this.speakHosted(sentence, generation);
        } catch {
          if (generation !== this.generation) return;
          await this.speakDevice(sentence, generation);
        }
      }
    } finally {
      if (generation === this.generation) this.playing = false;
    }
  }

  private async speakHosted(text: string, generation: number): Promise<void> {
    if (typeof window === "undefined") return;
    const controller = new AbortController();
    this.inflight.add(controller);
    let blob: Blob;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      blob = await res.blob();
    } finally {
      this.inflight.delete(controller);
    }
    if (generation !== this.generation) return;
    if (blob.size < 512) throw new Error("empty audio");

    await new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudio = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("audio playback failed"));
      };
      audio.play().catch((err: Error) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  }

  private speakDevice(text: string, generation: number): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.02;
      utterance.lang = "en-US";
      if (this.deviceVoice) utterance.voice = this.deviceVoice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
      if (generation !== this.generation) resolve();
    });
  }
}

function supportedMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      const base = type.split(";")[0];
      return base === "audio/mp4" ? "audio/mp4" : base;
    }
  }
  return "audio/webm";
}

const SILENCE_RMS = 0.008;
const SILENCE_MS = 1100;
const MIN_SPEECH_MS = 250;
const MAX_RECORD_MS = 12000;
const NO_SPEECH_MS = 8000;

export class MicrophoneError extends Error {}

function describeMicrophoneError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was blocked. Please allow it in the browser.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is in use by another program.";
  }
  return "The microphone could not be started.";
}

export interface RecordingOptions {
  onLevel?: (level: number) => void;
  signal?: AbortSignal;
}

/**
 * Records from the microphone until the child stops speaking, then resolves
 * with the audio blob. Used only when the browser has no on-device speech
 * recognition available.
 */
export async function recordUntilSilence(options: RecordingOptions = {}): Promise<Blob> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError("This browser cannot record from the microphone.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    throw new MicrophoneError(describeMicrophoneError(err));
  }
  const mime = supportedMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  const started = Date.now();
  let speechSeen = false;
  let lastLoudAt = Date.now();

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
      window.clearTimeout(hardStop);
      window.clearInterval(monitor);
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
      void audioContext.close();
    };

    const finish = () => {
      cleanup();
      setTimeout(() => resolve(new Blob(chunks, { type: mime })), 60);
    };

    const fail = (reason: string) => {
      cleanup();
      reject(new Error(reason));
    };

    const onAbort = () => fail("recording cancelled");
    options.signal?.addEventListener("abort", onAbort);

    const hardStop = window.setTimeout(() => finish(), MAX_RECORD_MS);

    const monitor = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = (samples[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / samples.length);
      options.onLevel?.(rms);
      const now = Date.now();
      if (rms > SILENCE_RMS) {
        speechSeen = true;
        lastLoudAt = now;
        return;
      }
      if (speechSeen && now - lastLoudAt >= SILENCE_MS && now - started >= MIN_SPEECH_MS) {
        finish();
        return;
      }
      if (!speechSeen && now - started >= NO_SPEECH_MS) {
        fail("no speech detected");
      }
    }, 100);

    recorder.start();
  });
}

export function hasOnDeviceRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}
