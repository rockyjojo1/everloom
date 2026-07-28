import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { supabase } from "../lib/supabase";

export function Landing() {
  const initFromSupabase = useGameStore((s) => s.initFromSupabase);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setNotice("");
    if (!email.trim() || !password) return;
    if (tab === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    if (tab === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
      if (err) { setError(err.message); setLoading(false); return; }

      // If the project has "Confirm email" enabled (Supabase default), signUp
      // returns a user but NO session — the account exists yet nothing is
      // logged in. Previously we fell through to initFromSupabase(), which
      // silently created an anonymous guest instead, so the account appeared
      // not to be remembered. Tell the user to confirm rather than guessing.
      if (!data.session) {
        setNotice(
          "Account created. Check your email for a confirmation link, then log in."
        );
        setTab("login");
        setPassword("");
        setConfirm("");
        setLoading(false);
        return;
      }
    }
    await initFromSupabase();
    setLoading(false);
  }

  async function handleGuest() {
    setLoading(true);
    await initFromSupabase();
    setLoading(false);
  }

  return (
    <div className="landing">
      {/* Decorative header */}
      <svg width="200" height="60" viewBox="0 0 200 60" style={{ opacity: 0.35 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={i} x1={i * 10} y1="0" x2={i * 10} y2="60" stroke="#D9A441" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 10} x2="200" y2={i * 10} stroke="#D9A441" strokeWidth="1" />
        ))}
        <path d="M20 15 Q100 45 180 15" stroke="#A63A32" strokeWidth="2" fill="none" />
        <path d="M20 35 Q100 5 180 35" stroke="#3C5A73" strokeWidth="2" fill="none" />
      </svg>

      <h1>Everloom</h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginTop: -8 }}>Gather. Craft. Survive.</p>

      {/* Tab toggle */}
      <div className="auth-tabs">
        <button
          className={`auth-tab ${tab === "login" ? "active" : ""}`}
          onClick={() => { setTab("login"); setError(""); }}
        >
          Login
        </button>
        <button
          className={`auth-tab ${tab === "signup" ? "active" : ""}`}
          onClick={() => { setTab("signup"); setError(""); }}
        >
          Create Account
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoComplete={tab === "login" ? "current-password" : "new-password"}
        />
        {tab === "signup" && (
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoComplete="new-password"
          />
        )}

        {error && (
          <div style={{
            fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--madder)",
            background: "rgba(166,58,50,0.15)", border: "1px solid var(--madder)",
            borderRadius: 4, padding: "6px 10px",
          }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{
            fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--weld)",
            background: "rgba(217,164,65,0.15)", border: "1px solid var(--weld)",
            borderRadius: 4, padding: "6px 10px",
          }}>
            {notice}
          </div>
        )}

        <button className="btn btn-gold" onClick={handleSubmit} disabled={loading}>
          {loading ? "Loading…" : tab === "login" ? "Login" : "Create Account"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 300, margin: "4px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--walnut)", opacity: 0.3 }} />
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.4 }}>OR</span>
        <div style={{ flex: 1, height: 1, background: "var(--walnut)", opacity: 0.3 }} />
      </div>

      <button className="btn" style={{ width: "100%", maxWidth: 300 }} onClick={handleGuest} disabled={loading}>
        Play as Guest
      </button>

      <p style={{ fontSize: 10, opacity: 0.35, marginTop: 8, fontFamily: "var(--font-ui)", textAlign: "center" }}>
        Guests can't sync across devices
      </p>
    </div>
  );
}
