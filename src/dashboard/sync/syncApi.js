// Thin, defensive wrappers around chrome messaging and the src/sync modules.
// Sync modules are imported lazily so the dashboard keeps working when they
// are unavailable (e.g. tests, or before the sync engine ships).

export const DEFAULT_STATUS = { state: 'signed_out', lastSyncedAt: null, error: null, email: null };

export function sendMsg(message, timeoutMs = 30000) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        const timer = setTimeout(() => finish(undefined), timeoutMs);
        const settle = (v) => { clearTimeout(timer); finish(v); };
        try {
            const r = chrome.runtime.sendMessage(message, (res) => {
                try { void chrome.runtime.lastError; } catch (e) { /* ignore */ }
                settle(res);
            });
            if (r && typeof r.then === 'function') r.then(settle, () => settle(undefined));
        } catch (e) {
            settle(undefined);
        }
    });
}

export const normalizeStatus = (res) => {
    const s = res && (res.status || res);
    if (s && typeof s === 'object' && typeof s.state === 'string') return { ...DEFAULT_STATUS, ...s };
    return DEFAULT_STATUS;
};

export const getStatus = async () => normalizeStatus(await sendMsg({ type: 'GET_SYNC_STATUS' }, 3000));
export const syncNowMsg = async () => {
    const res = await sendMsg({ type: 'SYNC_NOW' });
    return res && res.status ? normalizeStatus(res) : null;
};

// Subscribe to runtime broadcasts. Returns an unsubscribe function.
export function onRuntimeMessage(handler) {
    try {
        const ev = chrome?.runtime?.onMessage;
        if (!ev || typeof ev.addListener !== 'function') return () => { };
        ev.addListener(handler);
        return () => { try { ev.removeListener(handler); } catch (e) { /* ignore */ } };
    } catch (e) {
        return () => { };
    }
}

export const loadAuth = () => import('../../sync/auth.js');

export async function fetchStatsSafe() {
    try {
        const mod = await import('../../sync/stats.js');
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const res = await mod.fetchStats(tz);
        return res || null;
    } catch (e) {
        return null;
    }
}

export function formatRelative(iso, now = Date.now()) {
    if (!iso) return 'never';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 'never';
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
}

// chrome.storage.local helpers (callback or promise style, never throw).
export function storageGet(keys, timeoutMs = 2000) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v || {}); } };
        const timer = setTimeout(() => finish({}), timeoutMs);
        try {
            const r = chrome.storage.local.get(keys, (res) => { clearTimeout(timer); finish(res); });
            if (r && typeof r.then === 'function') r.then((res) => { clearTimeout(timer); finish(res); }, () => finish({}));
        } catch (e) { clearTimeout(timer); finish({}); }
    });
}

export function storageSet(obj) {
    try {
        const r = chrome.storage.local.set(obj);
        if (r && typeof r.then === 'function') return r.catch(() => { });
    } catch (e) { /* ignore */ }
    return Promise.resolve();
}

// Profile module (owned elsewhere) is imported lazily so the UI degrades gracefully.
export const loadProfile = () => import('../../sync/profile.js');
