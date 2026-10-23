import { getSupabase } from './supabaseClient.js';
import { getSession } from './auth.js';
import {
    getAllRecordsIncludingDeleted, getDirtyRecords, markClean, putFromSync, purgeTombstones,
} from '../../db.js';
import {
    toRemoteProblem, fromRemoteProblem, toRemoteReviews, mergeReviewHistory, shouldApplyRemote,
} from './mapping.js';

const PAGE = 1000;
const PUSH_BATCH = 500;
const EPOCH = '1970-01-01T00:00:00.000Z';

let running = null;
let queuedFull = false;
let debounceTimer = null;

function broadcast(message) {
    try {
        const p = chrome.runtime.sendMessage(message);
        if (p && typeof p.catch === 'function') p.catch(() => {}); // "Receiving end does not exist"
    } catch (e) { /* ignore */ }
}

async function storeGet(keys) {
    return (await chrome.storage.local.get(keys)) || {};
}

async function setStatus(patch) {
    const cur = (await storeGet('sync_status')).sync_status || {};
    const status = { state: 'idle', lastSyncedAt: null, error: null, email: null, ...cur, ...patch };
    await chrome.storage.local.set({ sync_status: status });
    broadcast({ type: 'SYNC_STATUS_CHANGED', status });
    return status;
}

export async function getSyncStatus() {
    const session = await getSession().catch(() => null);
    const saved = (await storeGet('sync_status')).sync_status || {};
    if (!session) {
        return { state: 'signed_out', lastSyncedAt: saved.lastSyncedAt || null, error: null, email: null };
    }
    let state = saved.state || 'idle';
    if (state === 'signed_out') state = 'idle';
    if (state === 'syncing' && !running) state = 'idle'; // stale after worker restart
    return {
        state,
        lastSyncedAt: saved.lastSyncedAt || null,
        error: saved.error || null,
        email: session.user ? session.user.email || null : null,
    };
}

function isNetworkError(e) {
    if (!e) return false;
    if (e instanceof TypeError) return true;
    return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(e.message || String(e));
}

function check(error) {
    if (error) throw error;
}

async function pushDirty(userId, full) {
    const records = full ? await getAllRecordsIncludingDeleted() : await getDirtyRecords();
    if (!records.length) return 0;
    const supabase = getSupabase();

    for (let i = 0; i < records.length; i += PUSH_BATCH) {
        const rows = records.slice(i, i + PUSH_BATCH).map(r => ({ user_id: userId, ...toRemoteProblem(r) }));
        const { error } = await supabase.from('problems').upsert(rows, { onConflict: 'user_id,url' });
        check(error);
    }

    const reviewRows = [];
    for (const r of records) {
        for (const rev of toRemoteReviews(r)) reviewRows.push({ user_id: userId, ...rev });
    }
    for (let i = 0; i < reviewRows.length; i += PUSH_BATCH) {
        const { error } = await supabase.from('reviews').upsert(reviewRows.slice(i, i + PUSH_BATCH), {
            onConflict: 'user_id,url,reviewed_at',
            ignoreDuplicates: true,
        });
        check(error);
    }

    // Only clear _dirty if the record is unchanged since we read it.
    for (const r of records) {
        if (r._dirty) await markClean(r.url, r.last_updated_at);
    }
    return records.length;
}

async function fetchAll(table, column, cursor) {
    const supabase = getSupabase();
    const out = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from(table).select('*')
            .gt(column, cursor)
            .order(column, { ascending: true })
            .range(from, from + PAGE - 1);
        check(error);
        out.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }
    return out;
}

async function pull(full) {
    const stored = await storeGet(['sync_cursor', 'sync_reviews_cursor']);
    const pCursor = full ? EPOCH : (stored.sync_cursor || EPOCH);
    const rCursor = full ? EPOCH : (stored.sync_reviews_cursor || EPOCH);

    const [remoteProblems, remoteReviews] = await Promise.all([
        fetchAll('problems', 'updated_at', pCursor),
        fetchAll('reviews', 'created_at', rCursor),
    ]);

    const local = new Map((await getAllRecordsIncludingDeleted()).map(r => [r.url, r]));
    const changed = new Set();

    for (const remote of remoteProblems) {
        const cur = local.get(remote.url);
        if (!shouldApplyRemote(cur, remote)) continue;
        const rec = fromRemoteProblem(remote, cur);
        local.set(rec.url, rec);
        changed.add(rec.url);
        await putFromSync(rec);
    }

    const byUrl = new Map();
    for (const rv of remoteReviews) {
        if (!byUrl.has(rv.url)) byUrl.set(rv.url, []);
        byUrl.get(rv.url).push({ date: rv.reviewed_at, quality: rv.quality });
    }
    for (const [url, revs] of byUrl) {
        const cur = local.get(url);
        if (!cur) continue;
        const merged = mergeReviewHistory(cur.review_history, revs);
        if (merged.length === (cur.review_history || []).length) continue;
        const rec = { ...cur, review_history: merged };
        local.set(url, rec);
        changed.add(url);
        await putFromSync(rec, { keepDirty: true });
    }

    const maxOf = (rows, col, fallback) =>
        rows.reduce((m, r) => (r[col] && r[col] > m ? r[col] : m), fallback);
    const patch = {};
    if (remoteProblems.length) patch.sync_cursor = maxOf(remoteProblems, 'updated_at', pCursor);
    else if (full) patch.sync_cursor = pCursor;
    if (remoteReviews.length) patch.sync_reviews_cursor = maxOf(remoteReviews, 'created_at', rCursor);
    else if (full) patch.sync_reviews_cursor = rCursor;
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);

    return changed.size;
}

async function runSync(full) {
    const session = await getSession();
    if (!session) {
        await setStatus({ state: 'signed_out', error: null, email: null });
        return { pushed: 0, pulled: 0 };
    }
    const email = session.user ? session.user.email || null : null;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await setStatus({ state: 'offline', error: null, email });
        return { pushed: 0, pulled: 0 };
    }

    await setStatus({ state: 'syncing', error: null, email });
    try {
        const { sync_cursor } = await storeGet('sync_cursor');
        const doFull = !!full || !sync_cursor; // first sign-in on this device: push all, pull all
        const pushed = await pushDirty(session.user.id, doFull);
        const pulled = await pull(doFull);
        try { await purgeTombstones(30); } catch (e) { /* non-fatal */ }
        await setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString(), error: null, email });
        if (pulled > 0) broadcast({ type: 'PROBLEMS_CHANGED' });
        return { pushed, pulled };
    } catch (e) {
        if (isNetworkError(e)) {
            await setStatus({ state: 'offline', error: null, email });
        } else {
            console.error('AlgoRecall: sync failed', e);
            await setStatus({ state: 'error', error: (e && e.message) || String(e), email });
        }
        return { pushed: 0, pulled: 0 };
    }
}

export function syncNow({ full = false } = {}) {
    if (running) {
        if (full) queuedFull = true;
        return running;
    }
    running = (async () => {
        try {
            let result = await runSync(full);
            while (queuedFull) {
                queuedFull = false;
                result = await runSync(true);
            }
            return result;
        } finally {
            running = null;
        }
    })();
    return running;
}

export function scheduleSync() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        syncNow().catch(() => {});
    }, 2000);
}

// ---- Realtime ----
// MV3 workers can be suspended, dropping the websocket; the 5-minute alarm is the backstop.
let channel = null;
let channelUser = null;

export async function startRealtime() {
    const session = await getSession();
    if (!session) { await stopRealtime(); return false; }
    if (channel && channelUser === session.user.id) return true;
    await stopRealtime();
    const supabase = getSupabase();
    const filter = `user_id=eq.${session.user.id}`;
    channelUser = session.user.id;
    channel = supabase.channel(`algorecall-sync-${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'problems', filter }, () => scheduleSync())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter }, () => scheduleSync())
        .subscribe();
    return true;
}

export async function stopRealtime() {
    if (channel) {
        try { await getSupabase().removeChannel(channel); } catch (e) { /* ignore */ }
    }
    channel = null;
    channelUser = null;
}
