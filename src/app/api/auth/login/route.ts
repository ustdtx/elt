import { authenticateParent, createSession, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  let parent;
  try {
    parent = await authenticateParent(body.username || "", body.password || "");
  } catch (err) {
    console.error("[auth/login] database error:", (err as Error).message);
    return Response.json({ error: "Account storage is unavailable. Check the MongoDB connection." }, { status: 503 });
  }
  if (!parent) return Response.json({ error: "Username or password is not correct." }, { status: 401 });
  try {
    await setSessionCookie(await createSession(parent.parentId));
  } catch (err) {
    console.error("[auth/login] session error:", (err as Error).message);
    return Response.json({ error: "Could not create a login session. Please try again." }, { status: 503 });
  }
  return Response.json({ username: parent.username });
}
