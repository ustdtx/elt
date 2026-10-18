"use client";

import { useCallback, useEffect, useState } from "react";

interface ProgressPayload {
  nickname: string;
  level: number;
  levelTitle: string;
  levelGoals: string[];
  sessions: number;
  interests: string[];
  mastered: { item: string; level: number }[];
  practicing: { item: string; status: string; level: number }[];
  lastSummary: string;
  modeMix: Record<string, number>;
  assessment: { inProgress: boolean; item: number; total: number };
}

export default function ProgressPage() {
  const [childId, setChildId] = useState("");
  const [children, setChildren] = useState<{ childId: string; name: string; level: number; placementComplete: boolean }[]>([]);
  const [data, setData] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/progress?childId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as ProgressPayload);
      setError("");
    } catch {
      setError("Progress could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const start = async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        setError("Please log in to view progress.");
        return;
      }
      const result = await fetch("/api/children");
      if (!result.ok) return;
      const list = ((await result.json()) as { children: typeof children }).children;
      setChildren(list);
      const requested = new URLSearchParams(window.location.search).get("childId");
      const stored = requested || localStorage.getItem("elt-child-id") || "";
      const selected = list.find((child) => child.childId === stored) || list[0];
      if (selected) {
        setChildId(selected.childId);
        localStorage.setItem("elt-child-id", selected.childId);
        void load(selected.childId);
      }
    };
    void start();
  }, [load]);

  const totalTurns = data ? Object.values(data.modeMix).reduce((a, b) => a + b, 0) : 0;

  return (
    <main className="lesson">
      <header className="lessonHeader">
        <div>
          <p className="eyebrow">Learning record</p>
          <h1>Progress</h1>
        </div>
        <p className="sessionTag">
          <a href="/">Back to the lesson</a>
        </p>
      </header>

      {!childId && <p className="logEmpty">No lesson has been started in this browser yet.</p>}
      {error && <p className="statusLine">{error}</p>}
      {children.length > 0 && (
        <section className="panel">
          <h2>Learners</h2>
          <ul className="plainList">
            {children.map((child) => (
              <li key={child.childId}>
                <a href={`/progress?childId=${encodeURIComponent(child.childId)}`}>{child.name}</a>
                <span className="tag">{child.placementComplete ? `Level ${child.level}` : "Placement waiting"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <div className="report">
          <section className="panel">
            <h2>Current level</h2>
            <p className="levelLine">
              L{data.level} — {data.levelTitle}
            </p>
            <p className="mutedLine">
              {data.sessions} {data.sessions === 1 ? "session" : "sessions"} on record
              {totalTurns > 0 ? ` · ${totalTurns} turns of practice` : ""}
            </p>
            {data.assessment.inProgress && (
              <p className="mutedLine">
                Progress check in progress: item {data.assessment.item} of {data.assessment.total}.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Learned independently</h2>
            {data.mastered.length === 0 ? (
              <p className="mutedLine">Nothing confirmed yet; the first patterns are still settling in.</p>
            ) : (
              <ul className="plainList">
                {data.mastered.map((entry) => (
                  <li key={entry.item}>{entry.item}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>In practice</h2>
            {data.practicing.length === 0 ? (
              <p className="mutedLine">No items waiting in practice.</p>
            ) : (
              <ul className="plainList">
                {data.practicing.map((entry) => (
                  <li key={entry.item}>
                    {entry.item}
                    <span className="tag">{entry.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Latest lesson</h2>
            <p className="mutedLine">{data.lastSummary || "A summary appears after the first full turn."}</p>
            {data.interests.length > 0 && (
              <p className="mutedLine">Interests used in lessons: {data.interests.join(", ")}</p>
            )}
          </section>

          <section className="panel">
            <h2>How time is spent</h2>
            <ul className="plainList">
              {Object.entries(data.modeMix).map(([mode, count]) => (
                <li key={mode}>
                  {mode === "learning"
                    ? "Teaching"
                    : mode === "chat"
                      ? "Conversation"
                      : mode === "play"
                         ? "Play"
                        : "Support"}
                  <span className="tag">{count} turns</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Learning goals at this level</h2>
            <ul className="plainList">
              {data.levelGoals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
