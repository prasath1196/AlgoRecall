import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PublicProfile } from "./types";

// Public client config (copied from the extension's src/sync/config.js). Safe to ship: data is protected by RLS.
const DEFAULT_URL = "https://xqzgcvayyzuvbtlcgibe.supabase.co";
const DEFAULT_KEY = "sb_publishable_Vaw1YOsH4QmoUEUquoo_bA_teSd5F55";

export const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

export async function getPublicProfile(
  rawUsername: string,
): Promise<PublicProfile | null> {
  const username = rawUsername.toLowerCase();
  if (!USERNAME_RE.test(username)) return null;

  if (process.env.PUBLIC_PROFILE_FIXTURES === "1") {
    try {
      const file = path.join(process.cwd(), "fixtures", `${username}.json`);
      return JSON.parse(await readFile(file, "utf8")) as PublicProfile;
    } catch {
      return null;
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

  const res = await fetch(`${url}/rest/v1/rpc/get_public_profile`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_username: username }),
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as PublicProfile | null;
  if (!data || typeof data !== "object" || !data.stats) return null;
  return data;
}
