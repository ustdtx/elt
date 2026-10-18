import { getCurrentParent } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return Response.json({ error: "not authenticated" }, { status: 401 });
  return Response.json({ username: parent.username });
}
