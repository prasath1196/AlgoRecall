import './idbSetup.js';

const db = jest.requireActual('../../db.js');

async function clearAll() {
    const d = await db.openDB();
    await new Promise((res, rej) => {
        const r = d.transaction(['problems'], 'readwrite').objectStore('problems').clear();
        r.onsuccess = res; r.onerror = rej;
    });
}

const base = (url, extra = {}) => ({ url, title: url, pattern_tag: ['A'], ...extra });

beforeEach(async () => {
    await clearAll();
    db.setChangeListener(null);
    global.chrome = { runtime: { sendMessage: jest.fn(() => Promise.resolve()) } };
});

test('saveProblem marks dirty, sets timestamps, notifies listener', async () => {
    const fn = jest.fn();
    db.setChangeListener(fn);
    await db.saveProblem(base('u1'));
    const [r] = await db.getAllProblems();
    expect(r._dirty).toBe(true);
    expect(r._deleted_at).toBeNull();
    expect(r.last_updated_at).toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(1);
});

test('without listener, sends LOCAL_CHANGED message', async () => {
    await db.saveProblem(base('u1'));
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'LOCAL_CHANGED' });
});

test('fromSync save does not mark dirty, keep last_updated_at, no notify', async () => {
    await db.saveProblem(base('u1', { last_updated_at: '2020-01-01T00:00:00.000Z' }), { fromSync: true });
    const [r] = await db.getAllRecordsIncludingDeleted();
    expect(r._dirty).toBe(false);
    expect(r.last_updated_at).toBe('2020-01-01T00:00:00.000Z');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
});

test('deleteProblem leaves a dirty tombstone hidden from reads', async () => {
    await db.saveProblem(base('u1', { next_review_at: '2000-01-01T00:00:00Z' }));
    await db.saveProblem(base('u2'));
    await db.deleteProblem('u1');
    expect((await db.getAllProblems()).map(p => p.url)).toEqual(['u2']);
    expect(await db.getProblem('u1')).toBeUndefined();
    expect(await db.getDueProblemsCount()).toBe(0);
    const all = await db.getAllRecordsIncludingDeleted();
    const t = all.find(p => p.url === 'u1');
    expect(t._deleted_at).toBeTruthy();
    expect(t._dirty).toBe(true);
});

test('markClean only clears if unchanged', async () => {
    await db.saveProblem(base('u1'));
    const [rec] = await db.getDirtyRecords();
    await new Promise(r => setTimeout(r, 5));
    await db.saveProblem(base('u1', { title: 'edited' })); // edited during push
    expect(await db.markClean('u1', rec.last_updated_at)).toBe(false);
    expect(await db.getDirtyRecords()).toHaveLength(1);
    const [cur] = await db.getDirtyRecords();
    expect(await db.markClean('u1', cur.last_updated_at)).toBe(true);
    expect(await db.getDirtyRecords()).toHaveLength(0);
});

test('purgeTombstones removes only old clean tombstones', async () => {
    const old = new Date(Date.now() - 40 * 86400000).toISOString();
    await db.putFromSync(base('clean-old', { _deleted_at: old }));
    await db.putFromSync(base('clean-new', { _deleted_at: new Date().toISOString() }));
    await db.putFromSync(base('live'));
    await db.putFromSync(base('dirty-old', { _deleted_at: old }), { keepDirty: true });
    // make dirty-old actually dirty
    const d = await db.openDB();
    await new Promise(res => {
        const s = d.transaction(['problems'], 'readwrite').objectStore('problems');
        s.put({ ...base('dirty-old', { _deleted_at: old }), _dirty: true }).onsuccess = res;
    });
    await db.purgeTombstones(30);
    const urls = (await db.getAllRecordsIncludingDeleted()).map(p => p.url).sort();
    expect(urls).toEqual(['clean-new', 'dirty-old', 'live']);
});
