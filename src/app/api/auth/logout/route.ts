import { deleteCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await deleteCurrentSession();
  return Response.json({ ok: true });
}
