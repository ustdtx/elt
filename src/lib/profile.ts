import { newProfile, normalizeProfile, type Profile } from "./profile-types";
import { getDb } from "./db";

const mem = new Map<string, Profile>();
export async function getProfile(childId: string, parentId?: string): Promise<Profile> {
  try {
    const db = await getDb();
    if (db) {
      const doc = await db.collection<Profile>("profiles").findOne({ childId, ...(parentId ? { parentId } : {}) });
      if (doc) return normalizeProfile(doc) as Profile;
      const fresh = newProfile(childId, parentId);
      await db.collection("profiles").insertOne(fresh).catch(() => undefined);
      return fresh;
    }

  } catch (err) {
    console.warn("[profile] read failed, memory fallback:", (err as Error).message);
  }
  return mem.get(childId) ?? newProfile(childId);
}

export async function getOwnedProfile(childId: string, parentId: string): Promise<Profile | null> {
  const db = await getDb();
  if (db) {
    const doc = await db.collection<Profile>("profiles").findOne({ childId, parentId });
    return doc ? normalizeProfile(doc) : null;
  }
  const profile = mem.get(childId);
  return profile?.parentId === parentId ? profile : null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  const updated: Profile = { ...profile, updatedAt: new Date() };
  mem.set(profile.childId, updated);
  try {
    const db = await getDb();
    if (db) {
      const { _id: _ignored, ...doc } = updated as Profile & { _id?: unknown };
      await db.collection("profiles").updateOne(
        { childId: profile.childId, parentId: profile.parentId },
        { $set: doc },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn("[profile] write failed:", (err as Error).message);
  }
}

export async function createChild(parentId: string, name: string): Promise<Profile> {
  const childId = `kid-${randomId()}`;
  const profile = newProfile(childId, parentId);
  profile.name = name.trim().slice(0, 40);
  mem.set(childId, profile);
  const db = await getDb();
  if (db) await db.collection("profiles").insertOne(profile);
  return profile;
}

export async function listChildren(parentId: string): Promise<Profile[]> {
  const db = await getDb();
  if (db) return (await db.collection<Profile>("profiles").find({ parentId }).sort({ createdAt: 1 }).toArray()).map(normalizeProfile);
  return [...mem.values()].filter((profile) => profile.parentId === parentId);
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}
