import { getSupabase } from '../sync/supabaseClient.js';
import { syncNow } from '../sync/sync.js';

export function mapAuthError(err) {
    const msg = String((err && (err.message || err.error_description || err.msg)) || err || '');
    if (/provider is not enabled|unsupported provider|provider_not_enabled/i.test(msg)) return 'provider_not_enabled';
    if (/user.*(closed|cancel)|did not approve|canceled|cancelled|access_denied/i.test(msg)) return 'cancelled';
    return msg || 'unknown';
}

/** Extract the PKCE code (or error) from the redirect URL (query or hash). */
export function parseAuthRedirect(redirectUrl) {
    if (!redirectUrl) return { error: 'no_redirect' };
    let u;
    try { u = new URL(redirectUrl); } catch (e) { return { error: 'bad_redirect' }; }
    const params = new URLSearchParams(u.search);
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
    const get = (k) => params.get(k) || hash.get(k);
    const errDesc = get('error_description') || get('error');
    if (errDesc) return { error: mapAuthError(errDesc) };
    const code = get('code');
    if (!code) return { error: 'no_code' };
    return { code };
}

export async function signInWithGitHubFlow() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: { redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true },
        });
        if (error) return { ok: false, error: mapAuthError(error) };
        if (!data || !data.url) return { ok: false, error: 'no_auth_url' };

        const redirectUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
        const parsed = parseAuthRedirect(redirectUrl);
        if (parsed.error) return { ok: false, error: parsed.error };

        const res = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (res.error) return { ok: false, error: mapAuthError(res.error) };

        syncNow({ full: true }).catch(() => {});
        return { ok: true };
    } catch (e) {
        return { ok: false, error: mapAuthError(e) };
    }
}
