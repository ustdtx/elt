"use client";

import { FormEvent, useEffect, useState } from "react";

interface Child { childId: string; name: string; level: number; placementComplete: boolean }

export default function DashboardPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  async function load() {
    const me = await fetch("/api/auth/me");
    if (!me.ok) { window.location.href = "/login"; return; }
    setUsername(((await me.json()) as { username: string }).username);
    const res = await fetch("/api/children");
    if (res.ok) {
      const nextChildren = ((await res.json()) as { children: Child[] }).children;
      setChildren(nextChildren);
      const stored = localStorage.getItem("elt-child-id") || "";
      const selected = nextChildren.find((child) => child.childId === stored) || nextChildren[0];
      if (selected) {
        setSelectedChildId(selected.childId);
        localStorage.setItem("elt-child-id", selected.childId);
      }
    }
  }
  useEffect(() => { void load(); }, []);
  async function addChild(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!res.ok) { setError(((await res.json()) as { error?: string }).error || "Could not add child."); return; }
    setName(""); setError(""); await load();
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <main className="lesson">
       <header className="lessonHeader"><div><p className="eyebrow">Parent dashboard</p><h1>Welcome, {username}</h1></div><div className="dashboardActions"><a className="button dashboardRecord" href={selectedChildId ? `/progress?childId=${encodeURIComponent(selectedChildId)}` : "/progress"}>Learning Record &amp; SEL</a><button onClick={logout}>Log out</button></div></header>
       <section className="panel">
         <h2>Your learners</h2>
         {children.length === 0 && <p className="mutedLine">Add your first learner to begin.</p>}
         <ul className="plainList">{children.map((child) => <li key={child.childId}><a href={`/progress?childId=${encodeURIComponent(child.childId)}`}><strong>{child.name}</strong></a><span className="tag">{child.placementComplete ? `Level ${child.level}` : "Placement waiting"}</span><a href={`/?childId=${encodeURIComponent(child.childId)}`}>Start lesson</a></li>)}</ul>
       </section>
      <form className="panel authForm" onSubmit={addChild}>
        <h2>Add a learner</h2>
        <label>Nickname<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        {error && <p className="statusLine">{error}</p>}
        <button className="send" type="submit">Add child</button>
      </form>
    </main>
  );
}
