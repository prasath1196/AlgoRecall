/**
 * Weighted random problem picker for mock interviews.
 * weight = 1; x3 if any pattern is in weakPatterns; x2 if overdue. Tombstoned problems excluded.
 * Sampling is without replacement. `rng` is injectable (returns [0,1)) for deterministic tests.
 */
export const getPatterns = (p) => {
    const raw = p && (p.pattern_tags || p.pattern_tag);
    return (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
};

export const isOverdue = (p, now = Date.now()) => {
    if (!p || !p.next_review_at) return false;
    const t = new Date(p.next_review_at).getTime();
    return !Number.isNaN(t) && t <= now;
};

export const problemWeight = (p, weakPatterns = [], now = Date.now()) => {
    let w = 1;
    const weak = new Set(weakPatterns || []);
    if (getPatterns(p).some((t) => weak.has(t))) w *= 3;
    if (isOverdue(p, now)) w *= 2;
    return w;
};

export function pickProblems(problems, { count = 3, weakPatterns = [], rng = Math.random, now = Date.now() } = {}) {
    const pool = (problems || []).filter((p) => p && !p._deleted_at);
    const items = pool.map((p) => ({ p, w: problemWeight(p, weakPatterns, now) }));
    const picked = [];
    const n = Math.min(count, items.length);
    while (picked.length < n) {
        const total = items.reduce((s, i) => s + i.w, 0);
        let r = rng() * total;
        let idx = items.length - 1;
        for (let i = 0; i < items.length; i++) {
            r -= items[i].w;
            if (r < 0) { idx = i; break; }
        }
        picked.push(items[idx].p);
        items.splice(idx, 1);
    }
    return picked;
}

export default pickProblems;
