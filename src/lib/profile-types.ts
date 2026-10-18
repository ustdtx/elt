export type Mode = "learning" | "chat" | "play" | "support";

export type LearningStatus = "introduced" | "practicing" | "mastered";
export type ChildFeeling =
  | "happy"
  | "interested"
  | "uninterested"
  | "calm"
  | "sad"
  | "frustrated"
  | "worried"
  | "tired"
  | "unclear";

export interface LearningRecord {
  item: string;          // word, pattern, or concept, authored vocabulary only
  level: number;
  status: LearningStatus;
  seen: number;          // number of turns since last seen
  lastMode: Mode;
  strongStreak?: number; // consecutive strong learning turns on this item
  lastMood?: "strong" | "partial" | "struggle";
}

export interface TurnNote {
  mode: Mode;
  mood: "strong" | "partial" | "struggle";
  feeling?: ChildFeeling;
  at: number;            // Date.now()
  distress?: boolean;    // the child's own words showed a difficult feeling
}

export interface AssessmentState {
  active: boolean;
  index: number;
  score: number;
  offset: number;   // rotates the item order after a failed attempt
  attempts: number;
}

export interface PlacementState {
  complete: boolean;
  index: number;
  score: number;
}

export const MAX_CONSECUTIVE_TEACHING = 4;
export const ASSESSMENT_PASS = 8;
export const STRUGGLE_SUPPORT_THRESHOLD = 2;
export const DIFFICULT_FEELINGS: ChildFeeling[] = ["sad", "frustrated", "worried", "tired"];
export interface TopicExamState {

  active: boolean;
  topicId: string;
  index: number;
  score: number;
}

export interface ExitExamState {
  active: boolean;
  index: number;
  score: number;
  mistakes: number;
  totalQuestions: number;
  attempts: number;
}

export interface Profile {
  childId: string;
  parentId: string;
  name: string;
  level: number;
  interests: string[];
  consecutiveTeaching: number;
  learning: LearningRecord[];
  turns: TurnNote[];
  lastSummary: string;
  lastStruggle: number;
  sessions: number;
  assessment: AssessmentState;
  placement: PlacementState;
  topicExam?: TopicExamState;
  exitExam?: ExitExamState;
  completedTopics: string[]; // Topic IDs completed at the current level
  createdAt: Date;
  updatedAt: Date;
}

export function newProfile(childId: string, parentId = ""): Profile {
  return {
    childId,
    parentId,
    name: "friend",
    level: 1,
    interests: [],
    consecutiveTeaching: 0,
    learning: [],
    turns: [],
    lastSummary: "",
    lastStruggle: 0,
    sessions: 1,
    assessment: { active: false, index: 0, score: 0, offset: 0, attempts: 0 },
    placement: { complete: false, index: 0, score: 0 },
    completedTopics: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function normalizeProfile(raw: Partial<Profile> & Pick<Profile, "childId">): Profile {
  const base = newProfile(raw.childId, raw.parentId || "");
  return {
    ...base,
    ...raw,
    learning: Array.isArray(raw.learning) ? raw.learning : [],
    turns: Array.isArray(raw.turns) ? raw.turns : [],
    lastSummary: typeof raw.lastSummary === "string" ? raw.lastSummary : "",
    lastStruggle: typeof raw.lastStruggle === "number" ? raw.lastStruggle : 0,
    sessions: typeof raw.sessions === "number" ? raw.sessions : 0,
    completedTopics: Array.isArray(raw.completedTopics) ? raw.completedTopics : [],
    topicExam: raw.topicExam && typeof raw.topicExam === "object" ? {
      active: Boolean(raw.topicExam.active),
      topicId: String(raw.topicExam.topicId || ""),
      index: Number(raw.topicExam.index) || 0,
      score: Number(raw.topicExam.score) || 0,
    } : undefined,
    exitExam: raw.exitExam && typeof raw.exitExam === "object" ? {
      active: Boolean(raw.exitExam.active),
      index: Number(raw.exitExam.index) || 0,
      score: Number(raw.exitExam.score) || 0,
      mistakes: Number(raw.exitExam.mistakes) || 0,
      totalQuestions: Number(raw.exitExam.totalQuestions) || 12,
      attempts: Number(raw.exitExam.attempts) || 0,
    } : undefined,
    assessment:
      raw.assessment && typeof raw.assessment === "object"
        ? {
            active: Boolean(raw.assessment.active),
            index: Number(raw.assessment.index) || 0,
            score: Number(raw.assessment.score) || 0,
            offset: Number(raw.assessment.offset) || 0,
            attempts: Number(raw.assessment.attempts) || 0,
          }
        : { active: false, index: 0, score: 0, offset: 0, attempts: 0 },
    placement:
      raw.placement && typeof raw.placement === "object"
        ? {
            complete: Boolean(raw.placement.complete),
            index: Number(raw.placement.index) || 0,
            score: Number(raw.placement.score) || 0,
          }
        : { complete: false, index: 0, score: 0 },
  };
}
