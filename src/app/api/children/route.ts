import { getCurrentParent } from "@/lib/auth";
import { createChild, listChildren } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return Response.json({ error: "not authenticated" }, { status: 401 });
  const children = await listChildren(parent.parentId);
  return Response.json({ children: children.map((child) => ({ childId: child.childId, name: child.name, level: child.level, placementComplete: child.placement.complete })) });
}

export async function POST(req: Request) {
  const parent = await getCurrentParent();
  if (!parent) return Response.json({ error: "not authenticated" }, { status: 401 });
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  if (!/^[a-zA-Z][a-zA-Z '-]{1,39}$/.test(name)) return Response.json({ error: "Enter a nickname between 2 and 40 letters." }, { status: 400 });
  const child = await createChild(parent.parentId, name);
  return Response.json({ childId: child.childId, name: child.name }, { status: 201 });
}
