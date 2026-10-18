"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Turn {
  role: "child" | "tutor";
  text: string;
}

interface ProfileState {
  level: number;
  activeMode: "learning" | "chat" | "play" | "support" | "conversation-learning";
  activeMood: "happy" | "interested" | "uninterested" | "calm" | "sad" | "frustrated" | "worried" | "tired" | "unclear";
  mode: "learning" | "chat" | "play" | "support";
  consecutiveTeaching: number;
  placementComplete: boolean;
  name: string;
}

export default function Home() {
  const [childId, setChildId] = useState<string>("");
  const [childName, setChildName] = useState<string>("");
  const [profileState, setProfileState] = useState<ProfileState>({
    level: 1,
    activeMode: "conversation-learning",
    activeMood: "unclear",
    mode: "learning",
    consecutiveTeaching: 0,
    placementComplete: false,
    name: "friend",
  });
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshProfile = useCallback(async (cid: string, updateMode = true) => {
    try {
      const res = await fetch(`/api/progress?childId=${encodeURIComponent(cid)}`);
      if (res.ok) {
        const data = await res.json();
        setProfileState((prev) => ({
          ...prev,
           level: data.level || 1,
           ...(updateMode ? { activeMode: data.activeMode || "learning" } : {}),
           ...(updateMode ? { activeMood: data.activeMood || "unclear" } : {}),
           placementComplete: Boolean(data.placement?.complete),
          name: data.nickname || prev.name,
        }));
      }
    } catch (err) {
      console.warn("Could not load progress:", err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        setAuthenticated(false);
        return;
      }
      setAuthenticated(true);
      const children = await fetch("/api/children");
      if (!children.ok) return;
      const data = (await children.json()) as { children: { childId: string; name: string; level?: number }[] };
      const requested = new URLSearchParams(window.location.search).get("childId");
      const stored = requested || localStorage.getItem("elt-child-id");
      const selected = data.children.find((child) => child.childId === stored) || data.children[0];
      if (selected) {
        setChildId(selected.childId);
        setChildName(selected.name);
        localStorage.setItem("elt-child-id", selected.childId);
        void refreshProfile(selected.childId);
      }
    };
    void load();
  }, [refreshProfile]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !childId) return;
      setBusy(true);
      setDraft("");
      setStatus("");
      setTurns((t) => [...t, { role: "child", text: trimmed }, { role: "tutor", text: "" }]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId, text: trimmed }),
        });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const activeMode = res.headers.get("X-Active-Mode");
        if (activeMode === "learning" || activeMode === "chat" || activeMode === "play" || activeMode === "support") {
          setProfileState((prev) => ({ ...prev, activeMode }));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const piece = decoder.decode(value, { stream: true });
          if (!piece) continue;
          full += piece;
           setTurns((t) => {
            const copy = t.slice();
            if (copy.length && copy[copy.length - 1].role === "tutor") {
              copy[copy.length - 1] = { role: "tutor", text: full };
            }
            return copy;
          });
        }
        if (!full.trim()) {
          setStatus("The AI returned no reply. Check the server log and try again.");
        }
        void refreshProfile(childId, true);
      } catch {
        setStatus("The lesson could not be reached. Please try again.");
        setTurns((t) => {
          const copy = t.slice();
          if (copy.length && copy[copy.length - 1].role === "tutor") {
            copy[copy.length - 1] = { role: "tutor", text: "" };
          }
          return copy;
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, childId, refreshProfile]
  );

  if (authenticated === null) {
    return <main className="lesson"><p className="logEmpty">Loading your lesson...</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="lesson">
        <header className="lessonHeader">
           <div><p className="eyebrow">English tutor</p><h1>Parent sign in</h1></div>
        </header>
        <section className="panel">
          <p className="mutedLine">Sign in to manage children and see their progress.</p>
          <p><a className="send" href="/login">Log in</a>{" or "}<a href="/register">Register</a></p>
        </section>
      </main>
    );
  }

  if (!childId) {
    return (
      <main className="lesson">
        <header className="lessonHeader">
          <div><p className="eyebrow">Parent area</p><h1>Choose a learner</h1></div>
        </header>
        <section className="panel">
          <p className="mutedLine">Add a child before starting a lesson.</p>
          <a className="send" href="/dashboard">Open parent dashboard</a>
        </section>
      </main>
    );
  }

  return (
    <main className="lesson">
      <header className="lessonHeader">
        <div>
          <p className="eyebrow">
            Level {profileState.level} · Step-by-Step English
          </p>
          <h1>English Conversation</h1>
          <div className="modeIndicator">
            <span className={`modeDot ${profileState.activeMode}`}></span>
            <span>Active mode: {profileState.activeMode === "conversation-learning" ? "Conversation + Learning" : profileState.activeMode === "chat" ? "Conversation" : profileState.activeMode === "play" ? "Engagement" : profileState.activeMode[0].toUpperCase() + profileState.activeMode.slice(1)} [{profileState.activeMood}]</span>
          </div>
        </div>
         <div className="sessionActions">
           <span className="sessionTag">Learner: <strong>{childName || "friend"}</strong></span>
           <a className="quitButton" href="/dashboard">Quit</a>
         </div>
      </header>

      {/* Conversational Chat Log */}
      <div className="log" ref={scrollRef} aria-live="polite">
        {turns.length === 0 && (
          <p className="logEmpty">
            Say hello or type what you would like to do.
          </p>
        )}
        {turns.map((turn, i) =>
          turn.role === "child" ? (
            <div className="row child" key={i}>
              <span className="turn child">{turn.text}</span>
            </div>
          ) : (
            <div className="row tutor" key={i}>
              <span className="turn tutor">{turn.text || "\u2026"}</span>
            </div>
          )
        )}
      </div>

      {status && <p className="statusLine">{status}</p>}

      {/* Child Typing Input */}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          className="draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your reply to your English tutor here..."
          disabled={busy}
          aria-label="Message to teacher"
          autoFocus
        />
        <button className="send" type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
