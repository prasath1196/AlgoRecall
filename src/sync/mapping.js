// Pure mapping helpers between local IndexedDB records and Supabase rows.

const LOCAL_ONLY = ['_dirty', 'local_saved_at'];
const DIRECT_FIELDS = [
    'url', 'title', 'platform', 'difficulty', 'code', 'language', 'description', 'notes',
    'interval', 'repetition_count', 'ease_factor', 'next_review_at', 'created_at',
];
// Local keys handled explicitly (not part of "extra")
const HANDLED_LOCAL = new Set([
    ...DIRECT_FIELDS, ...LOCAL_ONLY, 'pattern_tag', 'last_updated_at', '_deleted_at', 'review_history',
]);
// Remote columns handled explicitly (not part of "extra" spread-back)
const HANDLED_REMOTE = new Set([
    ...DIRECT_FIELDS, 'user_id', 'pattern_tags', 'client_updated_at', 'updated_at', 'deleted_at', 'extra',
]);

function iso(v) {
    if (v === null || v === undefined || v === '') return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

export function toRemoteProblem(local) {
    const extra = {};
    for (const k of Object.keys(local)) {
        if (!HANDLED_LOCAL.has(k) && local[k] !== undefined) extra[k] = local[k];
    }
    const row = {};
    for (const f of DIRECT_FIELDS) {
        if (local[f] !== undefined) row[f] = local[f];
    }
    row.next_review_at = iso(local.next_review_at);
    row.created_at = iso(local.created_at);
    row.pattern_tags = Array.isArray(local.pattern_tag) ? local.pattern_tag : [];
    row.client_updated_at = iso(local.last_updated_at) || new Date(0).toISOString();
    row.deleted_at = iso(local._deleted_at);
    row.extra = extra;
    return row;
}

export function fromRemoteProblem(remote, existingLocal) {
    const rec = { ...(remote.extra || {}) };
    for (const k of Object.keys(remote)) {
        if (!HANDLED_REMOTE.has(k)) rec[k] = remote[k];
    }
    for (const f of DIRECT_FIELDS) {
        if (remote[f] !== undefined) rec[f] = remote[f];
    }
    rec.next_review_at = iso(remote.next_review_at);
    rec.created_at = iso(remote.created_at);
    rec.pattern_tag = Array.isArray(remote.pattern_tags) ? remote.pattern_tags : [];
    rec.last_updated_at = iso(remote.client_updated_at);
    rec._deleted_at = iso(remote.deleted_at);
    rec._dirty = false;
    rec.local_saved_at = (existingLocal && existingLocal.local_saved_at) || new Date().toISOString();
    rec.review_history = existingLocal && Array.isArray(existingLocal.review_history)
        ? existingLocal.review_history : [];
    return rec;
}

/** Union of two review histories by (date, quality), sorted by date ascending. */
export function mergeReviewHistory(a, b) {
    const seen = new Map();
    for (const item of [...(a || []), ...(b || [])]) {
        if (!item) continue;
        const date = iso(item.date);
        if (!date) continue;
        const key = `${new Date(date).getTime()}|${item.quality}`;
        if (!seen.has(key)) seen.set(key, { date, quality: item.quality });
    }
    return [...seen.values()].sort((x, y) => new Date(x.date) - new Date(y.date));
}

export function toRemoteReviews(local) {
    return mergeReviewHistory(local.review_history, []).map(r => ({
        url: local.url,
        reviewed_at: r.date,
        quality: r.quality,
    }));
}

/** Last-writer-wins: apply remote if there's no local or remote is strictly newer. */
export function shouldApplyRemote(local, remote) {
    if (!local) return true;
    const l = local.last_updated_at ? new Date(local.last_updated_at).getTime() : 0;
    const r = remote.client_updated_at ? new Date(remote.client_updated_at).getTime() : 0;
    return r > l;
}
