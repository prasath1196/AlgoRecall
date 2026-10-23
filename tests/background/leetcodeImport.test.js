jest.mock('../../db.js', () => ({ getAllProblems: jest.fn(), saveProblem: jest.fn(async () => {}) }));
const db = require('../../db.js');
const { importLeetCode, mapTopics } = require('../../src/background/leetcodeImport.js');

const sleep = jest.fn(async () => {});
const resp = (body, status = 200, headers = {}) => ({
    ok: status >= 200 && status < 300, status, json: async () => body,
    headers: { get: (k) => headers[k] ?? null },
});
const sub = (slug, over = {}) => ({ title_slug: slug, title: slug, status_display: 'Accepted', lang_name: 'python3', code: 'code-' + slug, timestamp: '1700000000', ...over });
const gqlQ = (slug) => ({ data: { question: { title: 'T ' + slug, difficulty: 'Easy', topicTags: [{ name: 'Hash Table' }, { name: 'Depth-First Search' }, { name: 'Weird' }] } } });

function setupFetch({ signedIn = true, pages = [], q429 = 0 } = {}) {
    let throttled = 0;
    global.fetch = jest.fn(async (url, init) => {
        if (url.includes('/graphql')) {
            const body = JSON.parse(init.body);
            if (body.query.includes('userStatus')) return resp({ data: { userStatus: { isSignedIn: signedIn, username: 'u' } } });
            if (throttled < q429) { throttled++; return resp({}, 429); }
            return resp(gqlQ(body.variables.titleSlug));
        }
        const offset = Number(new URL(url).searchParams.get('offset'));
        const idx = offset / 20;
        return resp({ submissions_dump: pages[idx] || [], has_next: idx < pages.length - 1 });
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    db.getAllProblems.mockResolvedValue([]);
    global.chrome = { runtime: { sendMessage: jest.fn(() => Promise.resolve()) } };
});

test('mapTopics maps and drops unknown', () => {
    expect(mapTopics(['Depth-First Search', 'Dynamic Programming', 'Array', 'Segment Tree'])).toEqual(['DFS', 'DP', 'Array']);
});

test('not_logged_in path', async () => {
    setupFetch({ signedIn: false });
    const r = await importLeetCode({ sleep });
    expect(r).toEqual({ ok: false, imported: 0, skipped: 0, error: 'not_logged_in' });
    expect(db.saveProblem).not.toHaveBeenCalled();
});

test('imports latest AC per slug, maps shape, skips existing, broadcasts', async () => {
    setupFetch({ pages: [
        [sub('two-sum', { code: 'latest' }), sub('bad', { status_display: 'Wrong Answer' }), sub('add-two')],
        [sub('two-sum', { code: 'older' }), sub('exists')],
    ] });
    db.getAllProblems.mockResolvedValue([{ url: 'https://leetcode.com/problems/exists' }]);
    const r = await importLeetCode({ sleep });
    expect(r).toEqual({ ok: true, imported: 2, skipped: 1 });
    const saved = db.saveProblem.mock.calls.map(c => c[0]);
    const two = saved.find(p => p.url === 'https://leetcode.com/problems/two-sum');
    expect(two).toMatchObject({
        title: 'T two-sum', platform: 'LeetCode', difficulty: 'Easy', pattern_tag: ['Hash Table', 'DFS'],
        code: 'latest', language: 'python3', interval: 0, repetition_count: 0, ease_factor: 2.5, review_history: [],
    });
    expect(two.created_at).toBe(new Date(1700000000 * 1000).toISOString());
    expect(new Date(two.next_review_at).getTime()).toBeLessThanOrEqual(Date.now());
    const types = chrome.runtime.sendMessage.mock.calls.map(c => c[0].type);
    expect(types).toContain('IMPORT_PROGRESS');
    expect(types[types.length - 1]).toBe('PROBLEMS_CHANGED');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'IMPORT_PROGRESS', done: 3, total: 3 });
});

test('limit caps unique slugs', async () => {
    setupFetch({ pages: [[sub('a'), sub('b'), sub('c')]] });
    const r = await importLeetCode({ limit: 2, sleep });
    expect(r.imported).toBe(2);
});

test('retries on 429 with backoff', async () => {
    setupFetch({ pages: [[sub('a')]], q429: 2 });
    const r = await importLeetCode({ sleep });
    expect(r).toEqual({ ok: true, imported: 1, skipped: 0 });
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(db.saveProblem.mock.calls[0][0].title).toBe('T a');
});

test('network error', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect((await importLeetCode({ sleep })).error).toBe('network');
});
