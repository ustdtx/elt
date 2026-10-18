# System Design

## Scope

The system provides one-to-one English practice for children aged five to seven. A parent creates an account and child profile, then selects a child for a lesson. The application owns curriculum sequencing, mode selection, learning-state updates, and parent data access. The language model supplies the conversational wording within those boundaries.

## Components

### Web application

Next.js App Router pages provide the lesson, authentication, parent dashboard, and progress views. Client components stream chat responses into the lesson log and use browser speech capabilities when available.

### API routes

API routes are the server boundary for authentication, child ownership, chat, progress, metrics, STT, and TTS. Chat, STT, and TTS explicitly use the Node.js runtime.

### Conversation orchestration

`src/app/api/chat/route.ts` coordinates a turn:

- authenticates the parent;
- validates and sanitizes the input;
- serializes turns per child;
- selects mode, learning target, teaching move, activity, assessment item, and SEL context;
- invokes LangGraph for streaming response generation;
- extracts a bounded turn outcome;
- merges the outcome through deterministic learning rules;
- saves the profile and metrics.

LangGraph has one response node and a checkpointer. Its state contains the current message, mode, learner level, interests, learning records, recent summary, feeling, authored target/activity, assessment prompt, SEL guidance, and teaching move.

### Curriculum and SEL

Curriculum is authored and selected in code. Level data contains patterns, vocabulary, activities, assessments, and SEL packs. SEL is intentionally lightweight: the tutor can notice feelings, praise effort, invite curiosity, and offer calm support, but should respond to the child’s latest meaning first and avoid forced personal questions.

### Learning records

Model extraction is advisory. `mergeOutcome` is authoritative:

- only learning mode can create or advance learning records;
- conversation, engagement, and support record feelings/interests but do not advance mastery;
- a new item starts as `introduced`;
- three consecutive strong turns on the exact item are required for `mastered`;
- a struggle can move a mastered item back to practice;
- exit-level promotion uses the authored assessment and its pass threshold.

### Persistence

Profiles are stored in the MongoDB `profiles` collection. LangGraph uses MongoDB checkpoints when `MONGODB_URI` is configured. The application falls back to process memory if MongoDB is absent or unreachable, which is useful for development only.

## Data Flow

### Chat

```text
Browser
  -> authenticated POST /api/chat
  -> parent and child ownership check
  -> input guard
  -> mode and authored context selection
  -> serialized LangGraph stream
  -> Gemini or Groq
  -> streamed tutor text to browser
  -> outcome extraction
  -> deterministic profile merge
  -> MongoDB profile/checkpoint write
```

### Voice

1. The browser tries on-device speech recognition first.
2. If unavailable or unsuccessful, the browser records audio and sends it to `/api/stt`.
3. `/api/stt` forwards audio to Deepgram and returns the transcript.
4. Tutor response sentences are sent to `/api/tts` as needed.
5. Deepgram Aura audio is played in the browser; the device voice is the fallback.

## Security and Privacy

- Parent sessions use an HttpOnly cookie.
- Child, progress, and chat APIs verify that the child belongs to the authenticated parent.
- API keys remain server-side and are never exposed as public environment variables.
- Input is bounded and removes email addresses, phone numbers, and emoji before model calls.
- Profiles store nickname-level learning data, not family or address information.
- MongoDB production users should have least-privilege access and network restrictions.
- `.env*` files are ignored; only `.env.example` is committed.

## Reliability and Concurrency

Provider calls use a token-budget queue and one retry. The client receives an explicit failed stream instead of fabricated tutor text. `pendingByChild` prevents overlapping turns from selecting the same stale learning state. MongoDB is the durable source when configured; memory fallback is process-local and can be lost on restart or instance replacement.

## Deployment Model

Vercel hosts the Next.js pages and Node.js API functions. MongoDB Atlas provides durable profile and checkpoint storage. Gemini or Groq provides language generation. Deepgram is optional for hosted speech. Environment variables are configured per Vercel environment rather than committed to the repository.

## Operational Considerations

- Use MongoDB for all production deployments, including previews that need persistence.
- Keep provider token limits aligned with `LLM_ITPM` and `LLM_MAX_TOKENS`.
- Monitor `GET /api/metrics` for in-process latency percentiles; these metrics reset when a server instance is replaced.
- Test streaming, authentication, child ownership, placement, assessment, and voice fallback after deployment.
- Avoid logging child message content or API secrets.

## Extension Rules

Changes to levels belong in `docs/curriculum-spec.md` and authored curriculum files. Mode logic belongs in `src/lib/mode.ts`. Learning-state rules belong in `src/lib/learn.ts`. Prompt behavior must remain consistent with authored curriculum and should stay lean to control hosted token usage.
