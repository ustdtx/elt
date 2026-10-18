import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { BaseMessage } from "@langchain/core/messages";

// The provider admits a request against its per-minute budget using prompt
// tokens plus the full output cap, so both the model and the queue use one
// number for it.
export const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || 256);

const RATE_LIMIT = /rate limit|429|too many requests/i;
const TRANSIENT = /timeout|timed out|fetch failed|network|socket|temporarily unavailable/i;

// Hidden reasoning tokens are charged and counted against the reply budget,
// which truncates child-facing sentences, so thinking is switched off by
// default. Providers that reject "none" can override via LLM_REASONING_EFFORT.
export const REASONING = (process.env.LLM_REASONING_EFFORT || "none") as
  | "none"
  | "default"
  | "low"
  | "medium"
  | "high";
const ITPM = Number(process.env.LLM_ITPM || 6000);
const WINDOW_MS = 60_000;

type Slot = { at: number; tokens: number };
const slots: Slot[] = [];

function estimateTokens(messages: BaseMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length;
  }
  return Math.ceil(chars / 4) + MAX_TOKENS;
}

/**
 * The hosted model allows a fixed number of input tokens per minute. Turns are
 * spaced out in a real lesson, but a burst (retry, extraction plus a new turn)
 * would otherwise return a hard 429 to the child, so calls wait their turn.
 */
async function acquire(estimate: number): Promise<void> {
  const boundedEstimate = Math.min(estimate, ITPM);
  const startedAt = Date.now();
  for (;;) {
    const now = Date.now();
    while (slots.length && now - slots[0].at > WINDOW_MS) slots.shift();
    const used = slots.reduce((sum, s) => sum + s.tokens, 0);
    if (used + boundedEstimate <= ITPM) {
      slots.push({ at: now, tokens: boundedEstimate });
      return;
    }
    if (now - startedAt > 15_000 || slots.length === 0) return;
    const freeAt = slots[0].at + WINDOW_MS;
    await new Promise((r) => setTimeout(r, Math.min(Math.max(freeAt - now, 150) + 120, 3000)));
  }
}

function retryDelayMs(err: unknown): number {
  const text = err instanceof Error ? err.message : String(err);
  const match = text.match(/try again in ([\d.]+)\s*s/i);
  if (match) return Math.min(6000, Math.ceil(parseFloat(match[1]) * 1000) + 300);
  return 2000;
}

/**
 * Throttled call with a quiet retry. A young child must never see a silent
 * turn just because the provider throttled us briefly.
 */
export async function invokeWithRetry(
  model: BaseLanguageModelInterface,
  messages: BaseMessage[],
  attempts = 2
): Promise<string> {
  const estimate = estimateTokens(messages);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await acquire(estimate);
    try {
      const result = await model.invoke(messages);
      const text = typeof result.content === "string" ? result.content : "";
      const finish = (result as { response_metadata?: { finish_reason?: string } }).response_metadata
        ?.finish_reason;
      if (finish && finish !== "stop") {
        console.warn("[llm] finish_reason:", finish, "chars:", text.length);
      }
      if (text.trim()) return text;
      lastError = new Error("empty generation");
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!RATE_LIMIT.test(message) && !TRANSIENT.test(message)) break;
    }
    if (attempt < attempts) {
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      const wait = RATE_LIMIT.test(message) ? retryDelayMs(lastError) : 500;
      console.warn("[llm] retrying in", wait, "ms:", message.slice(0, 100));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("model call failed");
}
