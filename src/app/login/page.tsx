"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error || "Could not log in.");
      return;
    }
    window.location.href = "/dashboard";
  }
  return (
    <main className="lesson">
      <header className="lessonHeader"><div><p className="eyebrow">English tutor</p><h1>Parent log in</h1></div></header>
      <form className="panel authForm" onSubmit={submit}>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="statusLine">{error}</p>}
        <button className="send" type="submit">Log in</button>
        <p className="mutedLine">New parent? <a href="/register">Create an account</a></p>
      </form>
    </main>
  );
}
