import { saveProblem, getAllProblems } from '../../db.js';
import { ALLOWED_PATTERN_TAGS_SET } from '../constants.js';

const GRAPHQL = 'https://leetcode.com/graphql';
const SUBMISSIONS = 'https://leetcode.com/api/submissions/';
const PAGE_SIZE = 20;
const THROTTLE_MS = 340; // ~3 req/s
const MAX_RETRIES = 4;
const MAX_PAGES = 200;

// LeetCode topic name -> app pattern tag (best effort).
export const TOPIC_MAP = {
    'Sliding Window': 'Sliding Window',
    'Two Pointers': 'Two Pointers',
    'Depth-First Search': 'DFS',
    'Breadth-First Search': 'BFS',
    'Dynamic Programming': 'DP',
    'Memoization': 'DP',
    'Binary Search': 'Binary Search',
    'Binary Search Tree': 'Tree',
    'Backtracking': 'Backtracking',
    'Greedy': 'Greedy',
    'Stack': 'Stack',
    'Monotonic Stack': 'Stack',
    'Queue': 'Queue',
    'Monotonic Queue': 'Queue',
    'Heap (Priority Queue)': 'Heap',
    'Linked List': 'Linked List',
    'Doubly-Linked List': 'Linked List',
    'Tree': 'Tree',
    'Binary Tree': 'Tree',
    'Graph': 'Graph',
    'Topological Sort': 'Graph',
    'Shortest Path': 'Graph',
    'Hash Table': 'Hash Table',
    'Array': 'Array',
    'String': 'String',
    'Math': 'Math',
    'Bit Manipulation': 'Bit Manipulation',
    'Bitmask': 'Bit Manipulation',
    'Union Find': 'Union Find',
    'Trie': 'Trie',
    'Recursion': 'Recursion',
    'Sorting': 'Sorting',
};

export function mapTopics(topicNames) {
    const out = [];
    for (const name of topicNames || []) {
        const mapped = TOPIC_MAP[name] || (ALLOWED_PATTERN_TAGS_SET.has(name) ? name : null);
        if (mapped && !out.includes(mapped)) out.push(mapped);
    }
    return out;
}

const defaultSleep = (ms) => new Promise(r => setTimeout(r, ms));

class ImportError extends Error {
    constructor(code) { super(code); this.code = code; }
}

async function getCsrf() {
    try {
        if (chrome.cookies && chrome.cookies.get) {
            const c = await chrome.cookies.get({ url: 'https://leetcode.com', name: 'csrftoken' });
            return c ? c.value : null;
        }
    } catch (e) { /* cookies permission not granted: fine */ }
    return null;
}

async function request(url, init, sleep) {
    let delay = 1000;
    for (let attempt = 0; ; attempt++) {
        let res;
        try {
            res = await fetch(url, { credentials: 'include', ...init });
        } catch (e) {
            throw new ImportError('network');
        }
        if (res.status === 429 && attempt < MAX_RETRIES) {
            const ra = Number(res.headers && res.headers.get && res.headers.get('Retry-After'));
            await sleep(ra > 0 ? ra * 1000 : delay);
            delay *= 2;
            continue;
        }
        if (res.status === 429) throw new ImportError('rate_limited');
        if (res.status === 401 || res.status === 403) throw new ImportError('not_logged_in');
        if (!res.ok) throw new ImportError('http_' + res.status);
        try {
            return await res.json();
        } catch (e) {
            throw new ImportError('bad_response');
        }
    }
}

async function graphql(query, variables, sleep, csrf) {
    const headers = { 'Content-Type': 'application/json', Referer: 'https://leetcode.com/' };
    if (csrf) headers['x-csrftoken'] = csrf;
    const json = await request(GRAPHQL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) }, sleep);
    if (json && json.errors && !json.data) throw new ImportError('graphql_error');
    return json.data;
}

const STATUS_QUERY = 'query { userStatus { isSignedIn username } }';
const QUESTION_QUERY = `query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) { title difficulty topicTags { name } }
}`;

/** Newest-first accepted submissions, one per slug (latest AC), up to `limit` slugs. */
async function collectAccepted(limit, sleep) {
    const bySlug = new Map();
    let offset = 0;
    for (let page = 0; page < MAX_PAGES && bySlug.size < limit; page++) {
        const json = await request(`${SUBMISSIONS}?offset=${offset}&limit=${PAGE_SIZE}`,
            { headers: { Referer: 'https://leetcode.com/submissions/' } }, sleep);
        const dump = (json && json.submissions_dump) || [];
        for (const s of dump) {
            if (s.status_display !== 'Accepted' || !s.title_slug) continue;
            if (!bySlug.has(s.title_slug)) bySlug.set(s.title_slug, s);
            if (bySlug.size >= limit) break;
        }
        if (!json || !json.has_next || dump.length === 0) break;
        offset += PAGE_SIZE;
        await sleep(THROTTLE_MS);
    }
    return [...bySlug.values()];
}

export function buildProblem(sub, question, now = new Date()) {
    const slug = sub.title_slug;
    const ts = sub.timestamp ? new Date(Number(sub.timestamp) * 1000) : null;
    return {
        url: `https://leetcode.com/problems/${slug}`,
        title: (question && question.title) || sub.title || slug,
        platform: 'LeetCode',
        difficulty: (question && question.difficulty) || 'Medium',
        pattern_tag: mapTopics(((question && question.topicTags) || []).map(t => t.name)),
        code: sub.code || '',
        language: sub.lang_name || sub.lang || '',
        description: '',
        notes: '',
        interval: 0,
        repetition_count: 0,
        ease_factor: 2.5,
        next_review_at: now.toISOString(),
        created_at: ts && !isNaN(ts) ? ts.toISOString() : now.toISOString(),
        review_history: [],
    };
}

function broadcast(message) {
    try {
        const p = chrome.runtime.sendMessage(message);
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* ignore */ }
}

export async function importLeetCode({ limit = 200, sleep = defaultSleep } = {}) {
    let imported = 0;
    let skipped = 0;
    try {
        const csrf = await getCsrf();
        const status = await graphql(STATUS_QUERY, {}, sleep, csrf);
        if (!status || !status.userStatus || !status.userStatus.isSignedIn) {
            return { ok: false, imported: 0, skipped: 0, error: 'not_logged_in' };
        }
        const cap = Math.max(1, Number(limit) || 200);
        const subs = await collectAccepted(cap, sleep);
        const existing = new Set((await getAllProblems()).map(p => p.url));
        const total = subs.length;
        broadcast({ type: 'IMPORT_PROGRESS', done: 0, total });

        let done = 0;
        for (const sub of subs) {
            const url = `https://leetcode.com/problems/${sub.title_slug}`;
            if (existing.has(url)) {
                skipped++;
            } else {
                let question = null;
                try {
                    const data = await graphql(QUESTION_QUERY, { titleSlug: sub.title_slug }, sleep, csrf);
                    question = data && data.question;
                } catch (e) {
                    if (e.code === 'network' || e.code === 'not_logged_in') throw e;
                    // metadata is best-effort; import with submission info only
                }
                await saveProblem(buildProblem(sub, question));
                imported++;
                await sleep(THROTTLE_MS);
            }
            done++;
            broadcast({ type: 'IMPORT_PROGRESS', done, total });
        }
        return { ok: true, imported, skipped };
    } catch (e) {
        return { ok: false, imported, skipped, error: e instanceof ImportError ? e.code : ((e && e.message) || 'unknown') };
    } finally {
        if (imported > 0) broadcast({ type: 'PROBLEMS_CHANGED' });
    }
}
