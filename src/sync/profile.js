import { getSupabase } from './supabaseClient.js';

function errMsg(e) {
    return String((e && (e.message || e.error)) || e || '');
}

export async function getMyProfile() {
    const { data, error } = await getSupabase().rpc('get_my_profile');
    if (error) throw error;
    return data;
}

/** Resolves { ok, error? } where error is 'username_taken' | 'invalid_username' | other message. */
export async function setProfile({ username, isPublic, weeklyRecap }) {
    const { data, error } = await getSupabase().rpc('set_profile', {
        p_username: username || null,
        p_is_public: !!isPublic,
        p_weekly_recap: !!weeklyRecap,
    });
    if (error) {
        const m = errMsg(error);
        if (error.code === '23505' || /duplicate|username_taken|unique/i.test(m)) return { ok: false, error: 'username_taken' };
        if (/invalid_username|check constraint/i.test(m)) return { ok: false, error: 'invalid_username' };
        return { ok: false, error: m };
    }
    return data && typeof data === 'object' ? data : { ok: true };
}

/** Resolves { hint, remaining_today } or { error: 'limit_reached'|'not_configured'|'bad_request'|'network'|'not_signed_in' }. */
export async function requestHint(payload) {
    try {
        const { data, error } = await getSupabase().functions.invoke('hint', { body: payload });
        if (error) {
            // FunctionsHttpError carries the Response in error.context
            const ctx = error.context;
            if (ctx && typeof ctx.json === 'function') {
                try {
                    const body = await ctx.json();
                    if (body && body.error) return { error: body.error };
                } catch (e) { /* fall through */ }
                if (ctx.status === 401) return { error: 'not_signed_in' };
                if (ctx.status === 429) return { error: 'limit_reached' };
            }
            if (/FunctionsFetchError|Failed to fetch|network/i.test(`${error.name} ${errMsg(error)}`)) return { error: 'network' };
            return { error: 'bad_request' };
        }
        if (data && data.error) return { error: data.error };
        return data;
    } catch (e) {
        return { error: /fetch|network/i.test(errMsg(e)) ? 'network' : 'bad_request' };
    }
}
