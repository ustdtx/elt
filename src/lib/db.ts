import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient | null> | null = null;

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }
  if (!clientPromise) {
    const connection = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      appName: "hartley-english",
    })
      .connect()
      .catch((err) => {
        console.error("[db] MongoDB unavailable:", (err as Error).message);
        clientPromise = null;
        throw err;
      });
    clientPromise = connection;
  }
  const client = await clientPromise;
  return client?.db(process.env.MONGODB_DB || "elt") ?? null;
}
