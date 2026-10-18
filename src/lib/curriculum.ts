import l1 from "./curriculum/l1.json";
import l2 from "./curriculum/l2.json";
import l3 from "./curriculum/l3.json";
import type { LearningRecord, Profile } from "./profile-types";

export interface PatternItem {

  id: string;
  text: string;
  goal: string;
  examples: string[];
}

export interface VocabularySet {
  item: string;
  kind: string;
  words: string[];
}

export interface PhonicsItem {
  id: string;
  focus: string;
  words: string[];
}

export interface ActivityItem {
  id: string;
  title: string;
  how: string;
  patternId: string;
}

export interface AssessmentItem {
  id: string;
  focus: string;
  ask: string;
}

export interface CalmActivity {
  id: string;
  title: string;
  how: string;
}

export interface SelPack {
  goals: string[];
  checkin: string[];
  praise: string[];
  encourage: string[];
  calm: CalmActivity[];
}

export interface CurriculumFile {
  level: number;
  title: string;
  patterns: PatternItem[];
  vocabulary: VocabularySet[];
  phonics: PhonicsItem[];
  exits: string[];
  activities: ActivityItem[];
  assessment: AssessmentItem[];
  sel: SelPack;
}

const FILES: Record<number, CurriculumFile> = {
  1: l1 as CurriculumFile,
  2: l2 as CurriculumFile,
  3: l3 as CurriculumFile,
};

export function loadCurriculum(level: number): CurriculumFile {
  const clamped = Math.min(3, Math.max(1, Math.round(level) || 1));
  return FILES[clamped];
}

export interface TeachingTarget {
  id: string;
  kind: "pattern" | "phonics" | "set";
  label: string;
  goal?: string;
  example?: string;
  instruction: string;
  isNew: boolean;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function recordMatchesPattern(rec: LearningRecord, p: PatternItem): boolean {
  const r = norm(rec.item);
  const t = norm(p.text);
  const id = norm(p.id);
  if (r === t || r === id) return true;
  if (r.length >= 8 && (t.includes(r) || r.includes(t))) return true;
  return false;
}

export function masteredPatternCount(learning: LearningRecord[], patterns: PatternItem[]): number {
  return learning.filter(
    (r) => r.status === "mastered" && patterns.some((p) => recordMatchesPattern(r, p))
  ).length;
}

export interface TargetSelection {
  target: TeachingTarget;
  levelReady: boolean;
}

export function selectActivity(profile: Profile): ActivityItem {
  const cur = loadCurriculum(profile.level);
  const activities = cur.activities;
  if (activities.length === 0) {
    return { id: "free-play", title: "Free play", how: "Follow the child's lead in play without teaching.", patternId: "" };
  }
  return activities[profile.turns.length % activities.length];
}

export function assessmentItems(level: number): AssessmentItem[] {
  return loadCurriculum(level).assessment;
}

export function selPack(level: number): SelPack {
  return loadCurriculum(level).sel;
}

export type TeachingMove = "model" | "guide" | "produce" | "review";

export interface TurnFocus {
  thing: string;
  other: string;
  other2?: string;
  place?: string;
  scene?: string;
  interaction?: string;
  topic: string;
}

const LESSON_TOPICS: Record<number, string[]> = {
  1: ["animals", "toys", "food", "colors", "nature", "movement"],
  2: ["the classroom", "the park", "animals", "the weather", "the kitchen", "a story scene"],
  3: ["a garden", "a rainy day", "space", "a market", "animals", "a story world"],
};

const LOCATION_SCENES = [
  { thing: "book", other: "bag", place: "in", interaction: "make a brief comment, then ask a natural related question" },
  { thing: "ball", other: "chair", place: "under", interaction: "offer two simple choices and let the child choose" },
  { thing: "car", other: "box", place: "next to", interaction: "make a tiny text scene and ask what happens next" },
  { thing: "table", other: "window", place: "behind", interaction: "invite the child to correct one playful mistake" },
  { thing: "book", other: "ball", other2: "box", place: "between", interaction: "ask a fresh question about one detail in the scene" },
];

/**
 * The example object (and, for location patterns, the position) is chosen in
 * code so the tutor never drifts back to the same example every turn.
 */
export function focusFor(profile: Profile, targetId: string): TurnFocus {
  const cur = loadCurriculum(profile.level);
  const pattern = cur.patterns.find((p) => p.id === targetId);
  const label = pattern?.text.toLowerCase() ?? "";
  const wordSet = label.includes("i can") || label.includes("-ing") || label.includes("yesterday")
    ? "actions"
    : label.includes("adjective")
      ? "adjectives"
      : label.includes("i feel")
        ? "feelings-deep"
        : label.includes("first")
          ? "routine"
          : label.includes("this is") || label.includes("i see")
            ? (cur.vocabulary.some((v) => v.item === "animals") ? "animals" : "things-around")
            : label.includes("where is") || label.includes("it is") || label.includes("i have")
              ? "things-around"
              : label.includes("i like")
                ? "colors"
                : "";
  const matchingWords = cur.vocabulary.find((v) => v.item === wordSet)?.words;
  const places = cur.vocabulary.find((v) => v.item === "prepositions")?.words ?? [];
  const index = profile.turns.length;
  const example = pattern?.examples[index % (pattern.examples.length || 1)];
  const exampleWord = example?.match(/\b(?:a|an|the|my|this)\s+([a-z]+)\b/i)?.[1]
    ?? example?.replace(/[.!?].*$/, "").split(/\s+/).at(-1)
    ?? "ball";
  const things = matchingWords?.length ? matchingWords : [exampleWord];
  const thing = things[index % things.length];
  const other = things.length > 1 ? things[(index + 1) % things.length] : exampleWord;
  const needsPlace = pattern ? /where is|it is/i.test(pattern.text) : false;
  let place: string | undefined;
  let scene: string | undefined;
  if (needsPlace && places.length) {
    const location = LOCATION_SCENES[index % LOCATION_SCENES.length];
    place = location.place;
    scene = `The ${location.thing} is ${location.place} the ${location.other}.`;
    return {
      thing: location.thing,
      other: location.other,
      other2: location.other2,
      place,
      scene,
      interaction: location.interaction,
      topic: "a simple text scene",
    };
  }
  const topics = targetId === "l1-can"
    ? ["movement", "animals", "music", "nature"]
    : LESSON_TOPICS[profile.level] ?? LESSON_TOPICS[1];
  const topic = topics[index % topics.length];
  return { thing, other, place, topic };
}

/**
 * The teaching move is chosen in code from the child's record, so every
 * learning turn is an actual instructional step, not conversation drift.
 */
export function teachingMoveFor(profile: Profile, targetId: string): TeachingMove {
  const record = profile.learning.find((r) => r.item === targetId);
  if (!record) return "model";
  if (record.status === "practicing") return "produce";
  if (record.status === "mastered") return "review";
  // Still introduced: only a clear stumble sends us back to modelling, so a
  // child who is part-way there keeps getting supported attempts.
  if (record.lastMood === "struggle") return "model";
  return "guide";
}

export function describeItem(level: number, item: string): string {
  const cur = loadCurriculum(level);
  const normalized = norm(item);
  const pattern = cur.patterns.find((p) => norm(p.id) === normalized || norm(p.text) === normalized);
  if (pattern) return pattern.text;
  const phonics = cur.phonics.find((p) => norm(p.id) === normalized);
  if (phonics) return phonics.focus;
  const vocabulary = cur.vocabulary.find((v) => norm(v.item) === normalized);
  if (vocabulary) return vocabulary.item.replace(/-/g, " ");
  return item;
}

export function pickCheckin(level: number, turnCount: number): string {
  const list = selPack(level).checkin;
  if (list.length === 0) return "";
  return list[turnCount % list.length];
}

export function calmActivity(level: number, turnCount: number): CalmActivity | null {
  const list = selPack(level).calm;
  if (list.length === 0) return null;
  return list[turnCount % list.length];
}

export function rotatedAssessmentItem(
  level: number,
  index: number,
  offset: number
): AssessmentItem | null {
  const items = assessmentItems(level);
  if (items.length === 0 || index >= items.length) return null;
  return items[(index + offset) % items.length];
}

export function selectTarget(profile: Profile): TargetSelection {
  const cur = loadCurriculum(profile.level);
  const learning = profile.learning.filter((r) => r.level === profile.level);
  const ready = masteredPatternCount(learning, cur.patterns) >= cur.patterns.length - 1;

  // 1. Review due: strongest claim is a practicing pattern item at this level.
  const practicingPatternRec = learning.find(
    (r) => r.status === "practicing" && cur.patterns.some((p) => recordMatchesPattern(r, p))
  );
  if (practicingPatternRec) {
    const p = cur.patterns.find((pat) => recordMatchesPattern(practicingPatternRec, pat))!;
    return {
      target: {
        id: p.id,
        kind: "pattern",
        label: p.text,
        goal: p.goal,
        example: p.examples[0],
        instruction: `Review this known pattern in a fresh situation and extend it a little longer than before. Examples: ${p.examples.slice(0, 1).join(" / ")}`,
        isNew: false,
      },
      levelReady: ready,
    };
  }

  // 1b. Finish the teaching cycle of the pattern met most recently
  // (model last turn, guide this turn) before opening a new pattern.
  const recentIntroduced = learning
    .filter((r) => r.status === "introduced" && cur.patterns.some((p) => recordMatchesPattern(r, p)))
    .sort((a, b) => b.seen - a.seen)[0];
  if (recentIntroduced && recentIntroduced.seen < 3) {
    const p = cur.patterns.find((pat) => recordMatchesPattern(recentIntroduced, pat))!;
    return {
      target: {
        id: p.id,
        kind: "pattern",
        label: p.text,
        goal: p.goal,
        example: p.examples[0],
        instruction: `Continue the teaching cycle for this pattern the child met last turn, inside a familiar situation. Examples: ${p.examples.slice(0, 1).join(" / ")}`,
        isNew: false,
      },
      levelReady: ready,
    };
  }

  // 2. New material: first authored pattern with no learning record yet.
  for (const p of cur.patterns) {
    const hasRecord = learning.some((r) => recordMatchesPattern(r, p));
    if (!hasRecord) {
      return {
        target: {
          id: p.id,
          kind: "pattern",
          label: p.text,
          goal: p.goal,
        example: p.examples[0],
          instruction: `Teach this new pattern through the three-step cycle, anchored in the child's interests. Examples: ${p.examples.slice(0, 1).join(" / ")}`,
          isNew: true,
        },
        levelReady: ready,
      };
    }
  }

  // 3. All patterns are at least introduced: refresh the oldest practicing/mastered item.
  const oldest = learning
    .filter((r) => cur.patterns.some((pat) => recordMatchesPattern(r, pat)))
    .sort((a, b) => b.seen - a.seen)[0];
  if (oldest) {
    const p = cur.patterns.find((pat) => recordMatchesPattern(oldest, pat))!;
    return {
      target: {
        id: p.id,
        kind: "pattern",
        label: p.text,
        goal: p.goal,
        example: p.examples[0],
        instruction: `Bring back this pattern after a pause and let the child run it fully on their own. Examples: ${p.examples.slice(0, 1).join(" / ")}`,
        isNew: false,
      },
      levelReady: ready,
    };
  }

  // 4. Fallback: free-drawn items from records (child-driven vocabulary), else first pattern.
  const fallback = learning[0];
  return {
    target: fallback
      ? { id: "record", kind: "pattern", label: fallback.item, instruction: "Build a turn around this known item and extend it one small step.", isNew: false }
      : {
          id: cur.patterns[0].id,
          kind: "pattern",
          label: cur.patterns[0].text,
          goal: cur.patterns[0].goal,
          example: cur.patterns[0].examples[0],
          instruction: `Teach this new pattern through the three-step cycle. Examples: ${cur.patterns[0].examples.slice(0, 1).join(" / ")}`,
          isNew: true,
        },
    levelReady: ready,
  };
}
