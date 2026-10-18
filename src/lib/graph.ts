import { MongoClient } from "mongodb";
import { AIMessage, AIMessageChunk, BaseMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { buildSystemPrompt } from "./prompts";
import { invokeWithRetry, MAX_TOKENS, REASONING } from "./llm";
import type { ChildFeeling, Mode } from "./profile-types";
import type { LessonTask } from "./lesson-tasks";

const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  mode: Annotation<Mode>({
    reducer: (_l, r) => r,
    default: () => "learning" as Mode,
  }),
  name: Annotation<string>({ reducer: (_l, r) => r, default: () => "friend" }),
  level: Annotation<number>({ reducer: (_l, r) => r, default: () => 2 }),
  interests: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  learning: Annotation<{ item: string; status: string }[]>({
    reducer: (_l, r) => r,
    default: () => [],
  }),
  lastSummary: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  lastFeeling: Annotation<ChildFeeling | null>({ reducer: (_l, r) => r, default: () => null }),
  target: Annotation<{
    label: string;
    goal?: string;
    example?: string;
    instruction: string;
    isNew: boolean;
  } | null>({ reducer: (_l, r) => r, default: () => null }),
  activity: Annotation<{ title: string; how: string } | null>({
    reducer: (_l, r) => r,
    default: () => null,
  }),
  assessmentAsk: Annotation<string | null>({ reducer: (_l, r) => r, default: () => null }),
  sessionStart: Annotation<boolean>({ reducer: (_l, r) => r, default: () => false }),
  checkinAsk: Annotation<string | null>({ reducer: (_l, r) => r, default: () => null }),
  praise: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  encourage: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  calm: Annotation<{ title: string; how: string } | null>({
    reducer: (_l, r) => r,
    default: () => null,
  }),
  selGoals: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  focus: Annotation<{ thing: string; other: string; other2?: string; place?: string; scene?: string; interaction?: string; topic: string } | null>({
    reducer: (_l, r) => r,
    default: () => null,
  }),
  move: Annotation<"model" | "guide" | "produce" | "review" | null>({
    reducer: (_l, r) => r,
    default: () => null,
  }),
  task: Annotation<LessonTask | null>({ reducer: (_l, r) => r, default: () => null }),
  content: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
});

export type StateType = typeof State.State;

let llm: ChatGroq | ChatGoogleGenerativeAI | null = null;

function getLlm(): ChatGroq | ChatGoogleGenerativeAI {
  if (!llm) {
    const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();
    if (provider === "google" || provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is missing while LLM_PROVIDER is google");
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      console.info("[llm] using Gemini model:", model);
      llm = new ChatGoogleGenerativeAI({
        model,
        temperature: 0.6,
        maxOutputTokens: MAX_TOKENS,
        maxRetries: 0,
        apiKey,
      });
    } else {
      const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
      console.info("[llm] using Groq model:", model);
      llm = new ChatGroq({
        model,
        temperature: 0.6,
        maxTokens: MAX_TOKENS,
        streaming: true,
        apiKey: process.env.GROQ_API_KEY,
        reasoningEffort: REASONING,
      });
    }
  }
  return llm;
}

const MOVE_CUES = [
  "say it with me",
  "with me",
  "you finish",
  "finish it",
  "your turn",
  "you make",
  "you say",
  "add one more",
  "___",
];

async function respond(state: StateType): Promise<Partial<StateType>> {
  const system = buildSystemPrompt({
    name: state.name,
    level: state.level,
    interests: state.interests,
    mode: state.mode,
    learning: state.learning,
    lastSummary: state.lastSummary,
    lastFeeling: state.lastFeeling ?? undefined,
    target: state.target ?? undefined,
    activity: state.activity,
    assessmentAsk: state.assessmentAsk,
    sessionStart: state.sessionStart,
    checkinAsk: state.checkinAsk,
    praise: state.praise,
    encourage: state.encourage,
    calm: state.calm,
    selGoals: state.selGoals,
    move: state.move ?? undefined,
    focus: state.focus ?? undefined,
    task: state.task,
  });
  // Free conversation and support should follow the child's current words,
  // not recycle an old authored lesson scene from the checkpoint history.
  const trimmed = state.mode === "chat" || state.mode === "support"
    ? state.messages.slice(-1)
    : state.messages.slice(-8);
  const text = await invokeWithRetry(getLlm(), [new SystemMessage(system), ...trimmed]);
  return { messages: [new AIMessage(text)], content: text };
}

async function buildCheckpointer(): Promise<MemorySaver | MongoDBSaver> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return new MemorySaver();
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    return new MongoDBSaver({ client, dbName: process.env.MONGODB_DB || "elt" });
  } catch (err) {
    console.warn("[graph] Mongo checkpointer unavailable, memory fallback:", (err as Error).message);
    return new MemorySaver();
  }
}

const workflow = new StateGraph(State)
  .addNode("respond", respond)
  .addEdge(START, "respond")
  .addEdge("respond", END);

let compiled: ReturnType<typeof workflow.compile> | null = null;

export async function getGraph() {
  if (!compiled) {
    const checkpointer = await buildCheckpointer();
    compiled = workflow.compile({ checkpointer });
  }
  return compiled;
}

export async function* streamTurn(
  input: Partial<StateType>,
  threadId: string
): AsyncGenerator<[AIMessageChunk, Record<string, unknown>], void, unknown> {
  const graph = await getGraph();
  const events = await graph.stream(input, {
    configurable: { thread_id: threadId },
    streamMode: "messages",
  });
  for await (const event of events) {
    const [message, meta] = event as [BaseMessage, Record<string, unknown>];
    if (AIMessageChunk.isInstance(message)) {
      yield [message, meta ?? {}];
    }
  }
}
