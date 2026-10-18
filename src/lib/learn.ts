import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { invokeWithRetry, REASONING } from "./llm";
import { DIFFICULT_FEELINGS } from "./profile-types";
import type { ChildFeeling, LearningRecord, LearningStatus, Mode, Profile, TurnNote } from "./profile-types";

let extractor: ChatGroq | ChatGoogleGenerativeAI | null = null;

function getExtractor(): ChatGroq | ChatGoogleGenerativeAI {
  if (!extractor) {
    const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();
    if (provider === "google" || provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is missing while LLM_PROVIDER is google");
      extractor = new ChatGoogleGenerativeAI({
        model: process.env.EXTRACT_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
        temperature: 0,
        maxOutputTokens: 180,
        maxRetries: 0,
        apiKey,
      });
    } else {
      extractor = new ChatGroq({
        model: process.env.EXTRACT_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        temperature: 0,
        maxTokens: 180,
        apiKey: process.env.GROQ_API_KEY,
        reasoningEffort: REASONING,
      });
    }
  }
  return extractor;
}

export interface TurnOutcome {
  summary: string;
  taught: { item: string; status: string }[];
  mood: "strong" | "partial" | "struggle";
  feeling: ChildFeeling;
  interests: string[];
}

const EXTRACT_PROMPT = [
  "Analyze one child's English tutor turn and return strict JSON only:",
  '{"summary": "one sentence: what was practiced and how the child managed",',
  ' "taught": [{"item": "word, short phrase or sentence pattern taught, lowercase", "status": "introduced|practicing|mastered"}],',
  ' "mood": "strong|partial|struggle",',
  ' "feeling": "happy|interested|uninterested|calm|sad|frustrated|worried|tired|unclear",',
  ' "interests": ["topics or things the child cared about"]}',
  "taught holds at most 2 real authored lesson items: never greetings, thanks, tutor questions, fragments, or text ending in a question mark.",
  "Judge learning mood by effort and response to the target. A relevant answer in the child's own words can be strong even when it differs from the model.",
  "Infer feeling only from the child's complete response, not from tutor wording or English accuracy. Use direct feeling words, tone, willingness, and engagement. Do not infer frustration from a mistake alone. A plain answer such as 'the cat' is usually unclear. Use unclear when there is no reliable emotional signal.",
  "Never invent names, never mention emoji, never record family or address information.",
].join("\n");

const CHILD_FEELINGS: ChildFeeling[] = [
  "happy",
  "interested",
  "uninterested",
  "calm",
  "sad",
  "frustrated",
  "worried",
  "tired",
  "unclear",
];

export function inferFeeling(text: string): ChildFeeling {
  const value = text.toLowerCase();
  if (/\b(don't like|do not like|not interested|boring)\b/.test(value)) return "uninterested";
  if (/\b(worried|scared|afraid|nervous)\b/.test(value)) return "worried";
  if (/\b(tired|sleepy|exhausted)\b/.test(value)) return "tired";
  if (/\b(frustrated|angry|mad|annoyed|can't do|cannot do|give up)\b/.test(value)) return "frustrated";
  if (/\b(sad|upset|cry|crying|lonely)\b/.test(value)) return "sad";
  if (/\b(happy|excited|glad|love|enjoy|fun)\b/.test(value)) return "happy";
  if (/\b(like|interested|curious|want to)\b/.test(value)) return "interested";
  if (/\b(calm|okay|ok|fine|good)\b/.test(value)) return "calm";
  return "unclear";
}

export async function extractOutcome(
  childText: string,
  tutorText: string,
  fallbackMode: Mode,
  targetHint?: { id: string; label: string }
): Promise<TurnOutcome | null> {
  if (process.env.LLM_PROVIDER === "mock" || !tutorText.trim()) return null;
  try {
    const hintBlock = targetHint
      ? `\nAUTHORED CURRICULUM ITEM USED THIS TURN: id "${targetHint.id}", pattern "${targetHint.label}". If the tutor's reply carried this pattern, taught must contain exactly this id "${targetHint.id}" and at most one other single word or two-word phrase. Judge learning mood separately from the child's feeling; infer feeling from the child's complete response, whether or not it used this target.`
      : "";
    const result = await invokeWithRetry(getExtractor(), [
      new SystemMessage(EXTRACT_PROMPT + hintBlock),
      new HumanMessage(`CHILD SAID: ${childText.slice(0, 300)}\n\nTUTOR REPLIED: ${tutorText.slice(0, 400)}`),
    ]);
    const raw = result;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as TurnOutcome;
    if (!parsed || typeof parsed.summary !== "string") return null;
    let mood: TurnOutcome["mood"] = fallbackMode === "support" ? "struggle" : "partial";
    if (parsed.mood === "strong" || parsed.mood === "partial" || parsed.mood === "struggle") {
      mood = parsed.mood;
    }
    const feeling = CHILD_FEELINGS.includes(parsed.feeling) ? parsed.feeling : inferFeeling(childText);
    // A child who barely said anything did not produce the target, whatever
    // the extractor claims. Mastery must never ride on a two-word reply.
    const childWords = childText.trim().split(/\s+/).filter(Boolean).length;
    if (mood === "strong" && childWords < 2) mood = "partial";
    const taught = Array.isArray(parsed.taught)
      ? parsed.taught
          .filter((t) => t && typeof t.item === "string" && ["introduced", "practicing", "mastered", ""].includes(String(t.status)))
          .slice(0, 2)
          .map((t) => ({ item: t.item.toLowerCase().trim().slice(0, 60), status: String(t.status || "introduced") }))
          .filter((t) => t.item.length >= 2 && !t.item.includes("?") && t.item.split(/\s+/).length <= 4)
      : [];
    const interests = Array.isArray(parsed.interests)
      ? parsed.interests.filter((i) => typeof i === "string").map((i) => i.trim()).filter(Boolean).slice(0, 3)
      : [];

    if (targetHint) {
      // The published target is the one thing this turn definitely practiced,
      // so the record keeps it under the authored id even if the extractor
      // garbles the wording.
      const status = taught.find((t) => t.item === targetHint.id)?.status || "introduced";
      // Extra items are vocabulary only: a multi-word extra is the sentence
      // the extractor invented, not a lesson item.
      const other = taught.find(
        (t) => t.item !== targetHint.id && t.item.split(/\s+/).filter(Boolean).length <= 2
      );
      taught.length = 0;
      taught.push({ item: targetHint.id, status });
      if (other) taught.push(other);
    }

    return {
      summary: parsed.summary.slice(0, 240),
      taught,
      mood,
      feeling,
      interests,
    };
  } catch (err) {
    console.warn("[learn] extraction failed:", (err as Error).message);
    return null;
  }
}

export function mergeOutcome(
  profile: Profile,
  outcome: TurnOutcome,
  mode: Mode,
  distress = false
): Profile {
  const learning: LearningRecord[] = profile.learning.map((r) => ({ ...r, seen: r.seen + 1 }));

  // Only a teaching turn may create or move a learning record. Conversation,
  // play, and support turns update feelings and interests but never mastery.
  if (mode === "learning") {
    for (const t of outcome.taught) {
      let rec = learning.find((r) => r.item === t.item);
      if (!rec) {
        // A first appearance can never be mastered: the record starts at
        // introduced and the child's own next turns have to earn progress.
        learning.push({
          item: t.item,
          level: profile.level,
          status: "introduced",
          seen: 0,
          lastMode: mode,
          strongStreak: 0,
        });
        continue;
      }
      if (outcome.mood === "strong") {
        // Three strong turns in a row on this exact item, with no stumble in
        // between, is what we accept as mastery.
        rec.strongStreak = (rec.strongStreak ?? 0) + 1;
        if (rec.status === "introduced" && rec.strongStreak >= 1) {
          rec.status = "practicing";
        } else if (rec.status === "practicing" && rec.strongStreak >= 3) {
          rec.status = "mastered";
        }
      } else {
        rec.strongStreak = 0;
        if (outcome.mood === "struggle" && rec.status === "mastered") {
          rec.status = "practicing";
        }
      }
      rec.seen = 0;
      rec.lastMode = mode;
      rec.lastMood = outcome.mood;
    }
  }
  const note: TurnNote = { mode, mood: outcome.mood, feeling: outcome.feeling, at: Date.now(), distress };
  const turns = [...profile.turns, note].slice(-30);
  const interests = Array.from(new Set([...profile.interests, ...outcome.interests])).slice(-6);
  // Support mode is reached through the child's own difficult feelings, so a
  // few wrong answers can never be mistaken for distress.
  const distressTurns = turns.slice(-3).filter(
    (t) => t.distress || (t.feeling && DIFFICULT_FEELINGS.includes(t.feeling))
  ).length;
  return {
    ...profile,
    learning: learning.slice(-60),
    turns,
    interests,
    lastSummary: outcome.summary,
    lastStruggle: distressTurns,
  };
}
