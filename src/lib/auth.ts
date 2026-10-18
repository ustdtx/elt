import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";

const SESSION_COOKIE = "elt-parent-session";
const SESSION_DAYS = 30;

export interface Parent {
  parentId: string;
  username: string;
  createdAt: Date;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const wanted = Buffer.from(expected, "hex");
  return wanted.length === actual.length && timingSafeEqual(actual, wanted);
}

function hashSession(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeParent(doc: { parentId: string; username: string; createdAt: Date }): Parent {
  return { parentId: doc.parentId, username: doc.username, createdAt: doc.createdAt };
}

export async function registerParent(username: string, password: string): Promise<Parent | null> {
  const normalized = normalizeUsername(username);
  const passwordHash = hashPassword(password);
  const parentId = randomBytes(16).toString("hex");
  const createdAt = new Date();
  const db = await getDb();
  if (!db) throw new Error("MongoDB is required for parent registration");
  const existing = await db.collection("users").findOne({ username: normalized });
  if (existing) return null;
  await db.collection("users").insertOne({ parentId, username: normalized, passwordHash, createdAt, role: "parent" });
  return { parentId, username: normalized, createdAt };
}

export async function authenticateParent(username: string, password: string): Promise<Parent | null> {
  const normalized = normalizeUsername(username);
  const db = await getDb();
  if (!db) throw new Error("MongoDB is required for parent login");
  const parent = await db.collection("users").findOne<{ parentId: string; username: string; passwordHash: string; createdAt: Date }>({ username: normalized, role: "parent" });
  if (!parent || !verifyPassword(password, parent.passwordHash)) return null;
  return safeParent(parent);
}

export async function createSession(parentId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const db = await getDb();
  if (!db) throw new Error("MongoDB is required for sessions");
  await db.collection("sessions").insertOne({ tokenHash: hashSession(token), parentId, expiresAt });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getCurrentParent(): Promise<Parent | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const tokenHash = hashSession(token);
  const session = await db.collection("sessions").findOne<{ parentId: string; expiresAt: Date }>({ tokenHash });
  const expiresAt = session?.expiresAt instanceof Date ? session.expiresAt.getTime() : session?.expiresAt;
  if (!session || !expiresAt || expiresAt <= Date.now()) {
    await clearSessionCookie();
    return null;
  }
  const parent = await db.collection("users").findOne<{ parentId: string; username: string; createdAt: Date }>({ parentId: session.parentId, role: "parent" });
  return parent ? safeParent(parent) : null;
}

export async function deleteCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    if (db) await db.collection("sessions").deleteOne({ tokenHash: hashSession(token) });
  }
  await clearSessionCookie();
}

export function validateCredentials(username: string, password: string): string | null {
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username.trim())) return "Use a username with 3 to 40 letters, numbers, dots, dashes, or underscores.";
  if (password.length < 10 || password.length > 200) return "Use a password between 10 and 200 characters.";
  return null;
}
