import './idbSetup.js';

jest.mock('../../db.js', () => jest.requireActual('../../db.js'));

const mockUpserts = [];
let mockRemote = { problems: [], reviews: [] };
const mockSession = { user: { id: 'uid-1', email: 'a@b.c' } };
let mockSignedIn = true;

jest.mock('../../src/sync/supabaseClient.js', () => ({
    getSupabase: () => ({
        auth: { getSession: async () => ({ data: { session: mockSignedIn ? mockSession : null }, error: null }) },
        from: (table) => ({
            upsert: async (rows, opts) => { mockUpserts.push({ table, rows, opts }); return { error: null }; },
            select: () => {
                let cursor = '';
                const q = {
                    gt: (_c, v) => { cursor = v; return q; },
                    order: () => q,
                    range: async (from, to) => {
                        const col = table === 'problems' ? 'updated_at' : 'created_at';
                        const rows = mockRemote[table].filter(r => r[col] > cursor);
                        return { data: rows.slice(from, to + 1), error: null };
                    },
                };
                return q;
            },
        }),
    }),
}));

const db = require('../../db.js');
const { syncNow, getSyncStatus } = require('../../src/sync/sync.js');

let store;
beforeEach(async () => {
    store = {};
    mockUpserts.length = 0;
    mockRemote = { problems: [], reviews: [] };
    mockSignedIn = true;
    global.chrome = {
        storage: { local: {
            get: jest.fn(async (k) => {
                const keys = Array.isArray(k) ? k : [k];
                return Object.fromEntries(keys.filter(x => x in store).map(x => [x, store[x]]));
            }),
            set: jest.fn(async (o) => { Object.assign(store, o); }),
            remove: jest.fn(async (k) => { [].concat(k).forEach(x => delete store[x]); }),
        } },
        runtime: { sendMessage: jest.fn(() => Promise.resolve()) },
    };
    const d = await db.openDB();
    await new Promise(r => { d.transaction(['problems'], 'readwrite').objectStore('problems').clear().onsuccess = r; });
    db.setChangeListener(() => {});
});

const remoteRow = (url, over = {}) => ({
    url, title: 'remote ' + url, platform: 'LeetCode', difficulty: 'Easy', pattern_tags: ['X'],
    client_updated_at: '2026-03-01T00:00:00.000Z', updated_at: '2026-03-01T00:00:01.000Z',
    deleted_at: null, extra: {}, interval: 1, repetition_count: 0, ease_factor: 2.5,
    next_review_at: null, created_at: '2026-01-01T00:00:00.000Z', ...over,
});

test('pushes dirty records with mapped rows, then clears dirty', async () => {
    await db.saveProblem({
        url: 'u1', title: 'T', pattern_tag: ['DP'], review_history: [{ date: '2026-01-02T00:00:00.000Z', quality: 4 }],
    });
    const res = await syncNow();
    expect(res.pushed).toBe(1);
    const p = mockUpserts.find(u => u.table === 'problems');
    expect(p.opts).toEqual({ onConflict: 'user_id,url' });
    expect(p.rows[0]).toMatchObject({ user_id: 'uid-1', url: 'u1', pattern_tags: ['DP'], deleted_at: null });
    expect(p.rows[0].client_updated_at).toBeTruthy();
    const r = mockUpserts.find(u => u.table === 'reviews');
    expect(r.opts.ignoreDuplicates).toBe(true);
    expect(r.rows).toEqual([{ user_id: 'uid-1', url: 'u1', reviewed_at: '2026-01-02T00:00:00.000Z', quality: 4 }]);
    expect(await db.getDirtyRecords()).toHaveLength(0);
    expect((await getSyncStatus()).state).toBe('idle');
});

test('pull applies newer remote, ignores older, advances cursor, merges reviews, broadcasts', async () => {
    await db.putFromSync({ url: 'newer', title: 'old', last_updated_at: '2026-01-01T00:00:00.000Z', review_history: [] });
    await db.putFromSync({ url: 'older', title: 'keep', last_updated_at: '2026-06-01T00:00:00.000Z', review_history: [] });
    const recent = new Date().toISOString();
    mockRemote.problems = [
        remoteRow('newer'),
        remoteRow('older', { updated_at: '2026-03-01T00:00:02.000Z' }),
        remoteRow('gone', { deleted_at: recent, updated_at: '2026-03-01T00:00:03.000Z' }),
    ];
    mockRemote.reviews = [{ url: 'newer', reviewed_at: '2026-02-01T00:00:00+00:00', quality: 5, created_at: '2026-03-01T00:00:05.000Z' }];

    const res = await syncNow();
    expect(res.pulled).toBe(2); // newer (+review) and gone
    const all = Object.fromEntries((await db.getAllRecordsIncludingDeleted()).map(r => [r.url, r]));
    expect(all.newer.title).toBe('remote newer');
    expect(all.newer.pattern_tag).toEqual(['X']);
    expect(all.newer.review_history).toEqual([{ date: '2026-02-01T00:00:00.000Z', quality: 5 }]);
    expect(all.older.title).toBe('keep');
    expect(all.gone._deleted_at).toBe(recent);
    expect((await db.getAllProblems()).map(p => p.url).sort()).toEqual(['newer', 'older']);
    expect(store.sync_cursor).toBe('2026-03-01T00:00:03.000Z');
    expect(store.sync_reviews_cursor).toBe('2026-03-01T00:00:05.000Z');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'PROBLEMS_CHANGED' });

    // incremental second sync uses cursor: nothing new
    const again = await syncNow();
    expect(again.pulled).toBe(0);
});

test('signed out -> no-op, status signed_out', async () => {
    mockSignedIn = false;
    expect(await syncNow()).toEqual({ pushed: 0, pulled: 0 });
    expect((await getSyncStatus()).state).toBe('signed_out');
});

test('concurrent syncNow calls coalesce', async () => {
    const a = syncNow();
    const b = syncNow();
    expect(a).toBe(b);
    await a;
});
