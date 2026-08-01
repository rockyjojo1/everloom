import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { migrateSave, type GameSave } from "@everloom/core";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const cloudConfigured = Boolean(url && publishableKey && !url.includes("your-project"));

let singleton: SupabaseClient | null = null;

export function cloudClient(): SupabaseClient | null {
  if (!cloudConfigured || !url || !publishableKey) return null;
  singleton ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return singleton;
}

export async function currentCloudSession(): Promise<Session | null> {
  const client = cloudClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function createCloudAccount(email: string, password: string): Promise<Session | null> {
  const client = cloudClient();
  if (!client) throw new Error("Cloud saving has not been connected yet.");
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signInToCloud(email: string, password: string): Promise<Session> {
  const client = cloudClient();
  if (!client) throw new Error("Cloud saving has not been connected yet.");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOutOfCloud(): Promise<void> {
  const client = cloudClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function uploadCloudSave(save: GameSave): Promise<void> {
  const client = cloudClient();
  if (!client) return;
  const session = await currentCloudSession();
  if (!session) return;
  const { error } = await client.from("el_cloud_saves").upsert({
    user_id: session.user.id,
    slot: 0,
    payload: save,
    save_version: save.saveVersion,
    revision: save.lastSavedAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,slot" });
  if (error) throw error;
}

export async function downloadCloudSave(): Promise<{ save: GameSave; updatedAt: string } | null> {
  const client = cloudClient();
  if (!client) return null;
  const session = await currentCloudSession();
  if (!session) return null;
  const { data, error } = await client.from("el_cloud_saves")
    .select("payload,updated_at")
    .eq("user_id", session.user.id)
    .eq("slot", 0)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { save: migrateSave(data.payload), updatedAt: String(data.updated_at) };
}

export const CLOUD_AUTOSAVE_KEY = "everloom:cloud-autosave";

