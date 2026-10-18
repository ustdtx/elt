export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4"];
const DEEPGRAM_TIMEOUT_MS = 20000;

interface DeepgramAlternative {
  transcript?: string;
  confidence?: number;
}

interface DeepgramResult {
  results?: {
    channels?: { alternatives?: DeepgramAlternative[] }[];
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "speech service not configured" }, { status: 503 });
  }

  const contentType = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!ALLOWED.includes(contentType)) {
    return Response.json({ error: "unsupported audio type" }, { status: 415 });
  }

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "empty audio" }, { status: 400 });
  }
  if (audio.byteLength > MAX_BYTES) {
    return Response.json({ error: "audio too large" }, { status: 413 });
  }

  const params = new URLSearchParams({
    model: "nova-2",
    language: "en-US",
    smart_format: "true",
    punctuate: "true",
    filler_words: "false",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": contentType,
      },
      body: audio,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[stt] deepgram status", res.status);
      return Response.json({ error: "speech recognition failed" }, { status: 502 });
    }
    const data = (await res.json()) as DeepgramResult;
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const transcript = (alt?.transcript || "").trim();
    return Response.json({ transcript, confidence: alt?.confidence ?? 0 });
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    console.warn("[stt] deepgram error:", (err as Error).message);
    return Response.json(
      { error: aborted ? "speech recognition timed out" : "speech recognition error" },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
