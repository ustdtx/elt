import { describeItem, loadCurriculum } from "@/lib/curriculum";
import { getCurrentParent } from "@/lib/auth";
import { getOwnedProfile } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const parent = await getCurrentParent();
  if (!parent) return Response.json({ error: "not authenticated" }, { status: 401 });
  const childId = (new URL(req.url).searchParams.get("childId") || "").trim();
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(childId)) {
    return Response.json({ error: "invalid childId" }, { status: 400 });
  }

  const profile = await getOwnedProfile(childId, parent.parentId);
  if (!profile) return Response.json({ error: "child not found" }, { status: 404 });
  const curriculum = loadCurriculum(profile.level);
  const describe = (item: string) => describeItem(profile.level, item);

  const mastered = profile.learning
    .filter((r) => r.status === "mastered")
    .map((r) => ({ item: describe(r.item), level: r.level }));
  const practicing = profile.learning
    .filter((r) => r.status !== "mastered")
    .sort((a, b) => b.seen - a.seen)
    .map((r) => ({ item: describe(r.item), status: r.status, level: r.level }));

  const modeMix: Record<string, number> = { learning: 0, chat: 0, play: 0, support: 0 };
  for (const turn of profile.turns) {
    modeMix[turn.mode] = (modeMix[turn.mode] ?? 0) + 1;
  }

  return Response.json({
    nickname: profile.name,
    level: profile.level,
    levelTitle: curriculum.title,
    levelGoals: curriculum.sel.goals,
    sessions: profile.sessions,
    interests: profile.interests,
    mastered,
    practicing,
    lastSummary: profile.lastSummary,
    activeMode: profile.turns.at(-1)?.mode ?? "conversation-learning",
    activeMood: profile.turns.at(-1)?.feeling ?? "unclear",
    modeMix,
    assessment: {
      inProgress: profile.assessment.active,
      item: profile.assessment.index + 1,
      total: curriculum.assessment.length,
    },
    placement: {
      complete: profile.placement.complete,
      item: profile.placement.index + 1,
      total: 10,
    },

  });
}
