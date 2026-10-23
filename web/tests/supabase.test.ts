import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicProfile } from "@/lib/supabase";

afterEach(() => vi.unstubAllGlobals());

describe("getPublicProfile", () => {
  it("returns null when RPC returns null (notFound path)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", f);
    expect(await getPublicProfile("nobody")).toBeNull();
  });
  it("sends apikey + content-type and username in body", async () => {
    const profile = { username: "demo", display_name: "D", member_since: null, stats: { patterns: [], active_days: [] } };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => profile });
    vi.stubGlobal("fetch", f);
    const out = await getPublicProfile("Demo");
    expect(out).toEqual(profile);
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/rest\/v1\/rpc\/get_public_profile$/);
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toMatch(/^sb_publishable_/);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ p_username: "demo" });
    expect(init.next).toEqual({ revalidate: 300 });
  });
  it("returns null on http error and invalid usernames without fetching", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", f);
    expect(await getPublicProfile("nobody")).toBeNull();
    f.mockClear();
    expect(await getPublicProfile("a!")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
