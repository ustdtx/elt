import { DIFFICULT_FEELINGS, STRUGGLE_SUPPORT_THRESHOLD, type Profile } from "./profile-types";
import type { Mode } from "./profile-types";

const NEGATIVE = /\b(sad|angry|scared|tired|cry|crying|mad|upset|bored|hate|don'?t like|hard|too hard|can'?t do|quit|stop)\b/i;
const PLAY = /\b(play|game|story|song|riddle|fun|joke|pretend)\b/i;
const GREETING = /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|howdy)\b/i;
const QUESTION = /\?|^(why|how|what|where|who|when|can|is|are|do|did)\b/i;

/** Distress is read from the child's own words, never from lesson accuracy. */
export function isDistressed(text: string): boolean {
  return NEGATIVE.test(text);
}

export interface DetectResult {
  mode: Mode;
  reason: string;
}

export function detectMode(text: string, profile: Profile): DetectResult {
  // 1. Distress / Negative sentiment -> Support mode (comfort, calm, no pressure)
  if (NEGATIVE.test(text)) {
    return { mode: "support", reason: "negative sentiment or frustration detected" };
  }
  if (profile.lastStruggle >= STRUGGLE_SUPPORT_THRESHOLD) {
    return { mode: "support", reason: "recent difficult feelings in " + profile.lastStruggle + " turns" };
  }
  const lastFeeling = profile.turns.at(-1)?.feeling;
  if (lastFeeling && DIFFICULT_FEELINGS.includes(lastFeeling)) {
    return { mode: "support", reason: "the previous turn showed " + lastFeeling };
  }

  // 2. Play / Game request -> Play mode (engagement, fun games, riddles)
  if (PLAY.test(text)) {
    return { mode: "play", reason: "child asked for play, story, or game" };
  }

  // 3. Greetings still begin the authored lesson; they do not open a free chat.
  if (GREETING.test(text.trim())) {
    return { mode: "learning", reason: "greeting; begin the authored lesson" };
  }

  // A genuine child question may become a short engagement turn before the
  // next authored exercise resumes.
  if (QUESTION.test(text.trim())) {
    return { mode: "chat", reason: "child asked a question" };
  }

  // Short answers, personal comments, and uncertainty are handled as lesson
  // responses so the teacher can model and scaffold instead of drifting into chat.
  return { mode: "learning", reason: "learning lesson turn" };
}
