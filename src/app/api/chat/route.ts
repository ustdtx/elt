import { HumanMessage } from "@langchain/core/messages";
import { streamTurn } from "@/lib/graph";
import {
  assessmentItems,
  calmActivity,
  focusFor,
  pickCheckin,
  rotatedAssessmentItem,
  selectActivity,
  selectTarget,
  selPack,
  teachingMoveFor,
  type ActivityItem,
} from "@/lib/curriculum";
import { extractOutcome, inferFeeling, mergeOutcome } from "@/lib/learn";
import { recordTurn } from "@/lib/metrics";
import { detectMode, isDistressed } from "@/lib/mode";
import { saveProfile, getOwnedProfile } from "@/lib/profile";
import { getCurrentParent } from "@/lib/auth";
import { PLACEMENT_ITEMS, levelFromPlacement } from "@/lib/placement";
import { taskFor } from "@/lib/lesson-tasks";
import {
  ASSESSMENT_PASS,
  MAX_CONSECUTIVE_TEACHING,
  type AssessmentState,
} from "@/lib/profile-types";

export const runtime = "nodejs";

// Turns for one child are serialized: the previous turn's records must be
// written before the next turn selects its target, or material repeats.
const pendingByChild = new Map<string, Promise<unknown>>();

async function waitForChild(childId: string): Promise<void> {
  const pending = pendingByChild.get(childId);
  if (pending) await pending.catch(() => undefined);
}

function trackChild(childId: string, work: Promise<unknown>): void {
  pendingByChild.set(childId, work);
  void work.finally(() => {
    if (pendingByChild.get(childId) === work) pendingByChild.delete(childId);
  });
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}]/gu;

function guardInput(raw: string): string {
  let text = raw.slice(0, 500);
  text = text.replace(EMAIL, "[hidden]");
  text = text.replace(PHONE, "[hidden]");
  text = text.replace(EMOJI, "");
  if (/\b(ignore|disregard)\b.*\b(instruction|prompt|rule)/i.test(text)) {
    text = "";
  }
  return text.trim();
}

export async function POST(req: Request) {
  const parent = await getCurrentParent();
  if (!parent) return Response.json({ error: "not authenticated" }, { status: 401 });
  let body: { childId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const childId = (body.childId || "").trim();
  const text = guardInput(body.text || "");
  if (!childId || !/^[a-zA-Z0-9_-]{6,64}$/.test(childId)) {
    return Response.json({ error: "invalid childId" }, { status: 400 });
  }
  if (!text) {
    return Response.json({ error: "empty text" }, { status: 400 });
  }

  await waitForChild(childId);
  const profile = await getOwnedProfile(childId, parent.parentId);
  if (!profile) return Response.json({ error: "child not found" }, { status: 404 });
  const { mode, reason } = detectMode(text, profile);
  const distress = isDistressed(text);
  const selection = mode === "learning" ? selectTarget(profile) : null;

  let assessment: AssessmentState = profile.assessment;
  let assessmentAsk: string | null = null;
  let activity: ActivityItem | null = null;

  if (mode === "learning") {
    const items = assessmentItems(profile.level);
    if (!assessment.active && selection?.levelReady && items.length > 0) {
      assessment = {
        active: true,
        index: 0,
        score: 0,
        offset: (assessment.attempts * 3) % items.length,
        attempts: assessment.attempts,
      };
      console.info("[chat] starting exit assessment for", childId, "L" + profile.level);
    }
    if (!profile.placement.complete) {
      assessmentAsk = PLACEMENT_ITEMS[profile.placement.index]?.prompt ?? null;
    } else if (assessment.active) {
      assessmentAsk = rotatedAssessmentItem(profile.level, assessment.index, assessment.offset)?.ask ?? null;
    }

  } else if (mode === "play") {
    activity = selectActivity(profile);
  }

  const sessionGapMs = Date.now() - new Date(profile.updatedAt).getTime();
  const SESSION_GAP_MS = 20 * 60 * 1000;
  const sessionStart = profile.turns.length === 0 || sessionGapMs > SESSION_GAP_MS;
  const sel = selPack(profile.level);
  const checkinAsk = sessionStart ? pickCheckin(profile.level, profile.turns.length) : null;
  const calm = mode === "support" ? calmActivity(profile.level, profile.turns.length) : null;
  const move =
    selection && !assessmentAsk ? teachingMoveFor(profile, selection.target.id) : null;
  const focus = selection && !assessmentAsk ? focusFor(profile, selection.target.id) : null;
  const task = mode === "learning" && !assessmentAsk && profile.turns.length > 0
    ? taskFor(profile.level, profile.turns.length)
    : null;

  console.info(
    "[chat]",
    childId,
    "mode=" + mode,
    reason,
    "teachStreak=" + profile.consecutiveTeaching,
    selection ? "target=" + selection.target.id + (selection.target.isNew ? " (new)" : " (review)") : "",
    move ? "move=" + move : "",
    assessmentAsk ? "assessing#" + (assessment.index + 1) + "/" + assessmentItems(profile.level).length : "",
    activity ? "activity=" + activity.id : "",
    calm ? "calm=" + calm.id : "",
    sessionStart ? "session-start" : ""
  );

  const encoder = new TextEncoder();
  let firstTokenAt = 0;
  let fullReply = "";
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const events = await streamTurn(
          {
            messages: [new HumanMessage(text)],
            mode,
            name: profile.name,
            level: profile.level,
            interests: profile.interests.slice(-3),
            learning: profile.learning.map((r) => ({ item: r.item, status: r.status })),
            lastSummary: profile.lastSummary,
            lastFeeling: profile.turns.at(-1)?.feeling ?? null,
            target: selection && !assessmentAsk ? { ...selection.target } : null,
            activity: activity ? { title: activity.title, how: activity.how } : null,
            assessmentAsk,
            sessionStart,
            checkinAsk,
            praise: sel.praise,
            encourage: sel.encourage,
            calm: calm ? { title: calm.title, how: calm.how } : null,
            selGoals: sel.goals,
            move,
            focus,
            task,
          },
          childId
        );
        for await (const [chunk] of events) {
          const piece = typeof chunk.content === "string" ? chunk.content : "";
          if (piece) {
            if (!firstTokenAt) {
              firstTokenAt = Date.now();
              console.info("[latency] first token ms:", firstTokenAt - started);
            }
            fullReply += piece;
            controller.enqueue(encoder.encode(piece));
          }
        }
      } catch (err) {
        console.error("[chat] stream error:", err);
        // Never replace a provider failure with invented tutor text. Let the
        // client see a failed stream so configuration problems are actionable.
        controller.error(err);
        return;
      }
      const finalize = async () => {
        // If the extractor is unavailable, the session still has to move on:
        // the published target was taught this turn, so it is recorded from
        // our own knowledge rather than from the model's report.
            const outcome =
          (await extractOutcome(
            text,
            fullReply,
            mode,
            assessmentAsk && !profile.placement.complete ? undefined : selection?.target
          )) ?? {
            summary: profile.lastSummary,
            taught:
              selection && !assessmentAsk
                ? [{ item: selection.target.id, status: "introduced" }]
                : [],
            mood: mode === "support" ? "struggle" : "partial",
            feeling: inferFeeling(text),
            interests: [],
          };
        const nextProfile = outcome ? mergeOutcome(profile, outcome, mode, distress) : profile;
        let finalProfile = nextProfile;

        if (!profile.placement.complete && assessmentAsk) {
          const score = profile.placement.score + (outcome?.mood === "strong" ? 1 : 0);
          const index = profile.placement.index + 1;
          finalProfile = {
            ...finalProfile,
            placement: index >= PLACEMENT_ITEMS.length
              ? { complete: true, index: PLACEMENT_ITEMS.length, score }
              : { complete: false, index, score },
            level: index >= PLACEMENT_ITEMS.length ? levelFromPlacement(score) : profile.level,
          };
        } else if (assessment.active && assessmentAsk) {
          const passed = outcome?.mood === "strong";
          const items = assessmentItems(profile.level);
          const nextScore = assessment.score + (passed ? 1 : 0);
          const nextIndex = assessment.index + 1;
          if (nextIndex >= items.length) {
            const passedLevel = nextScore >= ASSESSMENT_PASS;
            console.info(
              "[chat] assessment finished for",
              childId,
              "L" + profile.level,
              "score=" + nextScore + "/" + items.length,
              passedLevel ? "PASS" : "RETRY"
            );
            if (passedLevel && profile.level < 3) {
              finalProfile = { ...finalProfile, level: profile.level + 1 };
              assessment = {
                active: false,
                index: 0,
                score: 0,
                offset: 0,
                attempts: assessment.attempts + 1,
              };
            } else {
              assessment = {
                active: false,
                index: 0,
                score: 0,
                offset: ((assessment.attempts + 1) * 3) % items.length,
                attempts: assessment.attempts + 1,
              };
            }
          } else {
            assessment = { ...assessment, index: nextIndex, score: nextScore };
          }
        }

        finalProfile = { ...finalProfile, assessment };
        if (sessionStart) {
          finalProfile = { ...finalProfile, sessions: finalProfile.sessions + 1 };
        }
        if (firstTokenAt) {
          recordTurn({ firstTokenMs: firstTokenAt - started, totalMs: Date.now() - started });
        }
        const nextStreak = mode === "learning" ? finalProfile.consecutiveTeaching + 1 : 0;
        await saveProfile({
          ...finalProfile,
          consecutiveTeaching: Math.min(nextStreak, MAX_CONSECUTIVE_TEACHING),
        });
      };

      const finalization = finalize();
      trackChild(childId, finalization);
      try {
        await finalization;
      } catch (err) {
        console.error("[chat] turn finalization failed:", err);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Active-Mode": mode,
    },
  });
}
