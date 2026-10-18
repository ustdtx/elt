# Architecture Diagram

```mermaid
flowchart TD
    Browser[Child or parent browser]

    subgraph Vercel[ Vercel Next.js application ]
        Pages[App Router pages<br/>lesson, auth, dashboard, progress]
        AuthAPI[Auth API routes<br/>register, login, logout, me]
        ChildAPI[Children and progress API routes]
        ChatAPI[POST /api/chat<br/>Node.js streaming route]
        VoiceAPI[STT and TTS proxy routes]
        Auth[HttpOnly parent session<br/>ownership checks]
        Mode[Mode selection<br/>learning, chat, play, support]
        Curriculum[Authored curriculum<br/>levels, targets, activities, SEL]
        Graph[LangGraph turn graph]
        Prompt[Lean system prompt<br/>level, history, SEL context]
        Learn[Outcome extraction and merge rules]
        Queue[Per-child serialization<br/>and provider retry/token queue]
        Metrics[In-process latency metrics]
    end

    Mongo[(MongoDB Atlas<br/>profiles and checkpoints)]
    Memory[(Memory fallback<br/>non-durable local mode)]
    LLM[Gemini or Groq]
    Deepgram[Deepgram STT and Aura TTS]

    Browser --> Pages
    Browser --> AuthAPI
    Browser --> ChildAPI
    Browser --> ChatAPI
    Browser --> VoiceAPI

    AuthAPI --> Auth
    ChildAPI --> Auth
    ChatAPI --> Auth
    Auth --> Mongo
    ChildAPI --> Mongo

    ChatAPI --> Mode
    ChatAPI --> Curriculum
    ChatAPI --> Queue
    Queue --> Graph
    Graph --> Prompt
    Prompt --> LLM
    Graph --> Mongo
    Graph -. unavailable .-> Memory
    ChatAPI --> Learn
    Learn --> Mongo
    ChatAPI --> Metrics

    VoiceAPI --> Deepgram
    Browser -. device speech fallback .-> Browser
```

## Request Boundaries

- Pages are client-facing React routes under `src/app`.
- API routes authenticate the parent before reading or changing child data.
- `POST /api/chat` is a Node.js route because it uses LangGraph, provider SDKs, MongoDB, and streaming.
- External LLM and Deepgram credentials are server-only environment variables.
- The browser never calls the LLM or Deepgram directly.

## Main Chat Flow

1. The browser sends a child ID and one message to `POST /api/chat`.
2. The route verifies the parent owns that child and waits for any previous turn for the child.
3. Application code detects mode and selects authored curriculum, SEL, assessment, and teaching context.
4. LangGraph builds a lean system prompt and streams the tutor response from Gemini or Groq.
5. The response is streamed to the browser while the completed turn is extracted and merged into the profile.
6. The profile and learning records are persisted before the next turn selects a target.

## Persistence

MongoDB stores parent-owned profiles and LangGraph checkpoints. The process-memory fallback exists for local operation without MongoDB; it is not durable and should not be used for production.
