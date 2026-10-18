# elt — English tutor for young learners

One-to-one English teaching conversations for children aged five to seven, delivered by a single tutor persona with a three-level progression and mode switching (learning, chat, play, support).

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (also typechecks)
- `npm run typecheck` — tsc only
- `npm start` — run the production build

## Stack

- Next.js 15 App Router, TypeScript, Node runtime only
- Orchestration: `@langchain/langgraph` state graph with MongoDB checkpointer (`@langchain/langgraph-checkpoint-mongodb`), memory fallback when MongoDB is unreachable
- LLM: Gemini via `@langchain/google-genai` or Groq via `@langchain/groq`, selected by `LLM_PROVIDER`
- Storage: MongoDB Atlas, `profiles` collection; in-memory fallback without `MONGODB_URI`
- Voice: on-device speech recognition primary (`src/lib/voice.ts`), automatic hand-over to microphone recording plus Deepgram proxy at `/api/stt` when it fails or is unavailable, sentence-streamed Deepgram Aura speech out via `/api/tts` with device voice fallback

## Routes

- `/` — lesson view (chat plus voice)
- `/progress` — parent-facing learning record, nickname and curriculum labels only
- `POST /api/chat` — one conversational turn, streamed
- `POST /api/stt` — Deepgram speech recognition fallback
- `GET /api/progress?childId=` — learning record for the progress page
- `GET /api/metrics` — in-process latency percentiles for the current server process
- `/login`, `/register`, `/dashboard` — parent authentication, child management, and learner selection
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — parent session APIs
- `GET/POST /api/children` — authenticated parent-owned child profiles

## Rules

- `.env*` files are gitignored and never committed; `.env.example` is the only exception.
- Standards in `docs/content-standards.md` are merge gates: no emoji anywhere, authored curriculum only, no grammar-rule teaching, no personal-data collection.
- Mode switching is decided in code (`src/lib/mode.ts`), never delegated to the model.
- Curriculum data is authored in `src/lib/curriculum/*.json`; teaching targets, play activities, exit-assessment items, and promotion are selected in `src/lib/curriculum.ts`. The model may only deliver authored items.
- Level promotion happens only through the authored exit assessment in `src/app/api/chat/route.ts` (8 of 10 to pass, rotated retry).
- Mastery claims from model output are never trusted: learning records advance only through `src/lib/learn.ts` merge rules.
- `docs/curriculum-spec.md` is the source of truth for levels; prompt behaviors in `src/lib/prompts.ts` must match it.
- Do not run `npm audit fix --force`; dependency changes go through review.
- Every learning turn is a teaching turn. The move (model, guide, produce, review) is chosen in code from the child's record in `teachingMoveFor` (`src/lib/curriculum.ts`), never by the model, and the target pattern must appear in the tutor's reply.
- Mastery needs three consecutive strong learning turns on that exact item (`src/lib/learn.ts`). Conversation, play, and support turns record feelings and interests but never advance mastery.
- Turns for one child are serialized through `pendingByChild` in `src/app/api/chat/route.ts`; the previous turn's records must be written before the next target is chosen.
- Parent sessions use an HttpOnly cookie; lesson and progress APIs must verify that the selected child belongs to the authenticated parent.
- New children complete the authored five-item placement flow before regular teaching begins; placement assigns L1, L2, or L3 and is separate from level exit promotion.
- Provider calls go through `invokeWithRetry` (`src/lib/llm.ts`): it queues against the per-minute token budget (`LLM_ITPM`) and retries once. A child must never see a silent turn. Hidden reasoning is off (`LLM_REASONING_EFFORT`) because it is charged against the reply budget and truncates sentences.
- Keep the system prompt lean: the hosted tier allows 7000 input tokens per minute, and every turn also pays for one record-extraction call.
