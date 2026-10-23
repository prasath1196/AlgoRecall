import { getSupabase } from './supabaseClient.js';

export const SYNC_CURSOR_KEYS = ['sync_cursor', 'sync_reviews_cursor', 'sync_status'];

export async function sendEmailCode(email) {
    const { data, error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
    });
    if (error) throw error;
    return data;
}

export async function verifyEmailCode(email, code) {
    const { data, error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
    try {
        const p = chrome.runtime.sendMessage({ type: 'SYNC_NOW', full: true });
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* ignore */ }
    return data;
}

export async function signOut() {
    try {
        await getSupabase().auth.signOut({ scope: 'local' });
    } finally {
        // Keep local data; only forget sync state so the next sign-in does a full sync.
        await chrome.storage.local.remove(SYNC_CURSOR_KEYS);
    }
}

export async function getSession() {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) return null;
    return data ? data.session : null;
}

export function onAuthChange(cb) {
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => cb(event, session));
    return () => data.subscription.unsubscribe();
}
