import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CLOUD_AUTOSAVE_KEY,
  cloudClient,
  cloudConfigured,
  createCloudAccount,
  currentCloudSession,
  downloadCloudSave,
  signInToCloud,
  signOutOfCloud,
  uploadCloudSave,
} from "../cloud/cloud";
import { useGameStore } from "../game/store";

export function CloudAccount() {
  const save = useGameStore((state) => state.save);
  const importSaveText = useGameStore((state) => state.importSaveText);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem(CLOUD_AUTOSAVE_KEY) === "true");

  useEffect(() => {
    const client = cloudClient();
    if (!client) return;
    void currentCloudSession().then(setSession).catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!cloudConfigured) return <section className="cloud-account unavailable">
    <span className="eyebrow">EVERLOOM ACCOUNT</span>
    <strong>Cloud connection ready for its own project</strong>
    <p>Your local save and exports continue to work. Add the Everloom Supabase URL and publishable key to enable account creation—no unrelated database is touched.</p>
  </section>;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  if (!session) return <section className="cloud-account">
    <span className="eyebrow">EVERLOOM ACCOUNT</span>
    <strong>{mode === "create" ? "Create an account" : "Sign in"}</strong>
    <p>Keep the local save, then sync it between devices. No progress is deleted when you sign out.</p>
    <input aria-label="Account email" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
    <input aria-label="Account password" type="password" minLength={8} autoComplete={mode === "create" ? "new-password" : "current-password"} placeholder="Password (8+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} />
    <div className="button-row">
      <button disabled={busy || !email || password.length < 8} onClick={() => void run(async () => {
        const next = mode === "create" ? await createCloudAccount(email, password) : await signInToCloud(email, password);
        if (next) {
          setSession(next);
          localStorage.setItem(CLOUD_AUTOSAVE_KEY, "true");
          setAutoSave(true);
          if (save) await uploadCloudSave(save);
          setMessage("Account connected. This device is now backed up.");
        } else setMessage("Check your email to confirm the account, then sign in.");
      })}>{busy ? "Connecting…" : mode === "create" ? "Create account" : "Sign in"}</button>
      <button disabled={busy} onClick={() => setMode(mode === "create" ? "signin" : "create")}>{mode === "create" ? "I have an account" : "Create instead"}</button>
    </div>
    {message && <small className="cloud-message">{message}</small>}
  </section>;

  return <section className="cloud-account connected">
    <span className="eyebrow">EVERLOOM ACCOUNT</span>
    <strong>{session.user.email}</strong>
    <p>Local progress is always retained. Cloud actions use your private account row.</p>
    <label className="cloud-toggle"><input type="checkbox" checked={autoSave} onChange={(event) => {
      setAutoSave(event.target.checked);
      localStorage.setItem(CLOUD_AUTOSAVE_KEY, String(event.target.checked));
    }} /> Auto-save after local checkpoints</label>
    <div className="button-row">
      <button disabled={busy || !save} onClick={() => void run(async () => {
        if (save) await uploadCloudSave(save);
        setMessage("Cloud save updated.");
      })}>Save to cloud</button>
      <button disabled={busy} onClick={() => void run(async () => {
        const cloud = await downloadCloudSave();
        if (!cloud) return setMessage("No cloud save exists yet.");
        if (!confirm(`Replace this device's save with the cloud copy from ${new Date(cloud.updatedAt).toLocaleString()}? A local backup will be kept.`)) return;
        await importSaveText(JSON.stringify(cloud.save));
        setMessage("Cloud save loaded. The previous local checkpoint remains in backup storage.");
      })}>Load cloud save</button>
      <button disabled={busy} onClick={() => void run(async () => { await signOutOfCloud(); setMessage("Signed out. Local progress is unchanged."); })}>Sign out</button>
    </div>
    {message && <small className="cloud-message">{message}</small>}
  </section>;
}

