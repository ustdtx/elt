# English Tutor

English tutoring conversations for children aged five to seven. The application combines authored three-level curriculum content with a single tutor persona, mode switching, voice input/output, parent accounts, and progress records.

## Features

- Learning, conversation, engagement, and support modes selected in application code.
- Authored curriculum targets, activities, placement, and level exit assessment.
- Learning records that require three consecutive strong turns before mastery.
- Parent authentication and parent-owned child profiles.
- Browser speech recognition with Deepgram STT fallback.
- Sentence-streamed Deepgram Aura TTS with device voice fallback.
- MongoDB persistence with an in-memory fallback for local development.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB Atlas or another MongoDB deployment for persistent accounts and profiles
- An LLM provider key: Google Gemini or Groq
- Optional Deepgram key for hosted speech recognition and speech output

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.

3. Set the required values. A minimal Gemini and MongoDB setup is:

   ```env
   LLM_PROVIDER=google
   GEMINI_API_KEY=your-gemini-key
   GEMINI_MODEL=gemini-3.5-flash-lite
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=elt
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

Without `MONGODB_URI`, profiles use process memory and are lost when the server restarts. Without Deepgram, browser speech recognition and device speech synthesis are used where available.

## Commands

```bash
npm run dev       # development server
npm run typecheck # TypeScript validation
npm run build     # production build and type validation
npm start         # serve the production build
```

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | Yes | `google` or `groq` |
| `GEMINI_API_KEY` | If Google | Gemini API key |
| `GEMINI_MODEL` | No | Gemini model name |
| `GROQ_API_KEY` | If Groq | Groq API key |
| `GROQ_MODEL` | No | Groq model name |
| `EXTRACT_MODEL` | No | Optional model for turn-record extraction |
| `LLM_ITPM` | No | Per-minute input token budget |
| `LLM_MAX_TOKENS` | No | Tutor response output cap |
| `LLM_REASONING_EFFORT` | No | Reasoning setting for supported providers |
| `DEEPGRAM_API_KEY` | No | STT fallback and TTS proxy |
| `DEEPGRAM_TTS_VOICE` | No | Deepgram Aura voice name |
| `MONGODB_URI` | Production | MongoDB connection string |
| `MONGODB_DB` | No | MongoDB database, default `elt` |

Never commit `.env.local` or other `.env` files. `.env.example` contains placeholders only.

## Deployment To Vercel

1. Push this repository to GitHub.
2. In Vercel, import the repository as a Next.js project.
3. Add the production environment variables from the table above in **Project Settings -> Environment Variables**.
4. Use the default install and build settings. The build command is `npm run build`.
5. Deploy and verify authentication, child creation, chat streaming, progress, and voice routes.

MongoDB must allow connections from Vercel. For MongoDB Atlas, configure an appropriate network access rule and use a least-privilege database user. Production should always set `MONGODB_URI`; the memory fallback is not durable and is not suitable for a multi-instance deployment.

Vercel preview deployments should use separate preview credentials or a separate database when test data must not mix with production data.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Child lesson chat and voice experience |
| `/login` | Parent login |
| `/register` | Parent registration |
| `/dashboard` | Parent child management and lesson entry |
| `/progress` | Parent-facing learning record |
| `POST /api/chat` | Authenticated streamed tutoring turn |
| `POST /api/stt` | Deepgram speech-to-text proxy |
| `POST /api/tts` | Deepgram text-to-speech proxy |
| `GET /api/progress?childId=` | Authenticated child progress |
| `GET /api/metrics` | In-process latency metrics |
| `GET/POST /api/children` | Authenticated child profile management |
| `POST /api/auth/register` | Create parent account |
| `POST /api/auth/login` | Create parent session |
| `POST /api/auth/logout` | Clear parent session |
| `GET /api/auth/me` | Read current parent session |

## Product and Safety Rules

- Curriculum content is authored in `src/lib/curriculum/*.json`.
- Mode switching is decided by `src/lib/mode.ts`, not by the model.
- Every learning turn has an application-selected teaching move and authored target.
- Conversation, engagement, and support turns do not advance mastery.
- Model-reported mastery is not trusted; records advance through `src/lib/learn.ts`.
- Parent sessions use an HttpOnly cookie and child ownership is checked by APIs.
- Input guards remove email addresses, phone numbers, and emoji before model calls.
- See `docs/content-standards.md` and `docs/curriculum-spec.md` for content requirements.

## Documentation

- [Architecture diagram](docs/architecture.md)
- [System design](docs/system-design.md)
- [Curriculum specification](docs/curriculum-spec.md)
- [Content standards](docs/content-standards.md)
