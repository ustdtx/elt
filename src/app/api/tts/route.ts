export const runtime = "nodejs";

const MAX_CHARS = 320;
const TIMEOUT_MS = 20000;
const DEFAULT_VOICE = "aura-2-helena-en";

export async function POST(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "speech service not configured" }, { status: 503 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return Response.json({ error: "empty text" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json({ error: "text too long" }, { status: 413 });
  }

  const voice = process.env.DEEPGRAM_TTS_VOICE || DEFAULT_VOICE;
  const params = new URLSearchParams({ model: voice, encoding: "mp3" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.deepgram.com/v1/speak?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      console.warn("[tts] deepgram status", res.status);
      return Response.json({ error: "speech service error" }, { status: 502 });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    console.warn("[tts] deepgram error:", (err as Error).message);
    return Response.json({ error: aborted ? "speech timed out" : "speech error" }, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timer);
  }
}
