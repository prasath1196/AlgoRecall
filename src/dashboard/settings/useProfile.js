import { useCallback, useEffect, useState } from 'react';
import { loadProfile } from '../sync/syncApi';

export const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;
export const EMPTY_PROFILE = { username: '', isPublic: false, weeklyRecap: false };

const normalize = (p) => ({
    username: (p && p.username) || '',
    isPublic: !!(p && (p.isPublic ?? p.is_public)),
    weeklyRecap: !!(p && (p.weeklyRecap ?? p.weekly_recap)),
});

// Loads the signed-in user's profile and exposes save(). Errors are returned as { ok:false, error }.
export function useProfile(enabled) {
    const [profile, setProfile] = useState(EMPTY_PROFILE);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;
        let alive = true;
        setLoading(true);
        (async () => {
            try {
                const mod = await loadProfile();
                const p = await mod.getMyProfile();
                if (alive && p) setProfile(normalize(p));
            } catch (e) { /* profile unavailable: keep defaults */ } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [enabled]);

    const save = useCallback(async (next) => {
        try {
            const mod = await loadProfile();
            const res = await mod.setProfile({
                username: next.username ? next.username : null,
                isPublic: !!next.isPublic,
                weeklyRecap: !!next.weeklyRecap,
            });
            if (res && res.ok === false) return { ok: false, error: res.error || 'unknown' };
            setProfile(normalize(next));
            return { ok: true };
        } catch (e) {
            const msg = String((e && (e.message || e.error)) || '');
            if (/username_taken/.test(msg)) return { ok: false, error: 'username_taken' };
            if (/invalid_username/.test(msg)) return { ok: false, error: 'invalid_username' };
            return { ok: false, error: 'unknown' };
        }
    }, []);

    return { profile, loading, save };
}
