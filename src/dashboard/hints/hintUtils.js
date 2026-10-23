export const HINT_LEVELS = [
    { level: 1, label: 'Nudge' },
    { level: 2, label: 'Key insight' },
    { level: 3, label: 'Outline' },
];

export const levelLabel = (level) => (HINT_LEVELS.find((l) => l.level === level) || {}).label || `Level ${level}`;

export const HINT_ERRORS = {
    limit_reached: 'Daily hint limit reached — resets tomorrow',
    not_configured: "AI hints aren't set up yet",
    signed_out: 'Sign in to use AI hints',
    generic: "Couldn't get a hint right now. Try again.",
};

const SIGNED_OUT_RE = /sign(ed)?[ _-]?(in|out)|not[ _-]?authenticated|unauthori[sz]ed|no[ _-]?session|jwt|401|auth/i;

export function errorMessage(err) {
    const s = typeof err === 'string' ? err : (err && (err.error || err.message)) || '';
    if (s === 'limit_reached') return HINT_ERRORS.limit_reached;
    if (s === 'not_configured') return HINT_ERRORS.not_configured;
    if (SIGNED_OUT_RE.test(s)) return HINT_ERRORS.signed_out;
    return HINT_ERRORS.generic;
}

export function buildHintPayload(problem, userCode, level) {
    const tags = Array.isArray(problem.pattern_tag) ? problem.pattern_tag : [problem.pattern_tag];
    const payload = {
        url: problem.url,
        title: problem.title,
        pattern_tags: (problem.pattern_tags || tags).filter(Boolean),
        difficulty: problem.difficulty,
        description: problem.description,
        level,
    };
    if (userCode && userCode.trim()) payload.user_code = userCode;
    return payload;
}

/** Dynamically load src/sync/profile.js; returns requestHint or null if unavailable. */
export async function loadRequestHint() {
    try {
        const mod = await import('../../sync/profile.js');
        return typeof mod.requestHint === 'function' ? mod.requestHint : null;
    } catch (e) {
        return null;
    }
}

export async function fetchHint(payload) {
    const fn = await loadRequestHint();
    if (!fn) return { error: 'not_configured' };
    try {
        const res = await fn(payload);
        return res || { error: 'generic' };
    } catch (e) {
        return { error: (e && e.message) || 'generic' };
    }
}
