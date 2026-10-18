import { createSession, registerParent, setSessionCookie, validateCredentials } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const username = body.username || "";
  const password = body.password || "";
  const validation = validateCredentials(username, password);
  if (validation) return Response.json({ error: validation }, { status: 400 });
  let parent;
  try {
    parent = await registerParent(username, password);
  } catch (err) {
    console.error("[auth/register] database error:", (err as Error).message);
    return Response.json({ error: "Account storage is unavailable. Check the MongoDB connection." }, { status: 503 });
  }
  if (!parent) return Response.json({ error: "That username is already in use." }, { status: 409 });
  try {
    await setSessionCookie(await createSession(parent.parentId));
  } catch (err) {
    console.error("[auth/register] session error:", (err as Error).message);
    return Response.json({ error: "Account was not signed in. Please try again." }, { status: 503 });
  }
  return Response.json({ username: parent.username });
}
