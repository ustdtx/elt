"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error || "Could not register.");
      return;
    }
    window.location.href = "/dashboard";
  }
  return (
    <main className="lesson">
      <header className="lessonHeader"><div><p className="eyebrow">English tutor</p><h1>Create parent account</h1></div></header>
      <form className="panel authForm" onSubmit={submit}>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label>
        <p className="mutedLine">Use at least 10 characters.</p>
        {error && <p className="statusLine">{error}</p>}
        <button className="send" type="submit">Register</button>
        <p className="mutedLine">Already registered? <a href="/login">Log in</a></p>
      </form>
    </main>
  );
}
