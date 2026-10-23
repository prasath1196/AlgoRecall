const DB_NAME = 'AlgoRecallDB';
const DB_VERSION = 1;
const STORE_NAME = 'problems';

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('AlgoRecall DB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // keyPath url ensures uniqueness per problem URL
                db.createObjectStore(STORE_NAME, { keyPath: 'url' });
            }
        };
    });
}

let changeListener = null;

/** Register a hook called after user-initiated saves/deletes (background registers scheduleSync). */
export function setChangeListener(fn) {
    changeListener = typeof fn === 'function' ? fn : null;
}

function notifyChange() {
    try {
        if (changeListener) {
            changeListener();
        } else if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
            // Non-background context (dashboard/popup): tell the background to schedule a sync.
            const p = chrome.runtime.sendMessage({ type: 'LOCAL_CHANGED' });
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }
    } catch (e) { /* ignore */ }
}

function isLive(p) {
    return !!p && !p._deleted_at;
}

export async function saveProblem(problem, options = {}) {
    const fromSync = !!(options && options.fromSync);
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Check if problem exists first
            const getRequest = store.get(problem.url);

            getRequest.onsuccess = () => {
                const existing = getRequest.result;

                // Merge logic: Preserve existing data if new data is missing
                if (existing) {
                    // 1. Preserve critical fields
                    if (existing.created_at) {
                        problem.created_at = existing.created_at;
                    }

                    // 2. Preserve metadata if missing in new scrape
                    if (!problem.description && existing.description) {
                        problem.description = existing.description;
                    }
                    if ((!problem.title || problem.title === 'Unknown Title' || problem.title === 'NeetCode') && existing.title) {
                        problem.title = existing.title;
                    }
                    // Preserve tags if new scrape failed to find them (e.g. History page)
                    if ((!problem.pattern_tag || problem.pattern_tag.length === 0) && existing.pattern_tag && existing.pattern_tag.length > 0) {
                        problem.pattern_tag = existing.pattern_tag;
                    }
                } else {
                    // New problem: Set created_at
                    if (!problem.created_at) {
                        problem.created_at = new Date().toISOString();
                    }
                }

                // Add timestamp for local tracking
                const now = new Date().toISOString();
                problem.local_saved_at = now;
                if (fromSync) {
                    if (!problem.last_updated_at) problem.last_updated_at = now;
                    problem._dirty = false;
                } else {
                    problem.last_updated_at = now; // Explicit field as requested
                    problem._dirty = true;
                    problem._deleted_at = null;
                    // Don't lose review history if the caller didn't supply one
                    if (!problem.review_history && existing && existing.review_history) {
                        problem.review_history = existing.review_history;
                    }
                }
                if (problem._deleted_at === undefined) problem._deleted_at = null;

                const putRequest = store.put(problem);
                putRequest.onsuccess = () => {
                    if (!fromSync) notifyChange();
                    resolve(putRequest.result);
                };
                putRequest.onerror = () => reject(putRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('AlgoRecall: Error saving to DB', error);
        throw error;
    }
}

export async function getAllProblems() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result.filter(isLive));
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('AlgoRecall: Error getting from DB', error);
        throw error;
    }
}

export async function getDueProblemsCount() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const problems = request.result.filter(isLive);
                const now = new Date();
                // Set cutoff to end of current UTC day
                const utcCutoff = new Date();
                utcCutoff.setUTCHours(23, 59, 59, 999);

                const dueCount = problems.filter(p => new Date(p.next_review_at) <= utcCutoff).length;
                resolve(dueCount);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('AlgoRecall: Error counting due problems', error);
        throw error;
    }
}

export async function deleteProblem(url) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(url);
            getReq.onsuccess = () => {
                const existing = getReq.result;
                if (!existing) { resolve(); return; }
                const now = new Date().toISOString();
                const tomb = { ...existing, _deleted_at: now, _dirty: true, last_updated_at: now, local_saved_at: now };
                const putReq = store.put(tomb);
                putReq.onsuccess = () => { notifyChange(); resolve(); };
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    } catch (error) {
        console.error('AlgoRecall: Error deleting from DB', error);
        throw error;
    }
}

export async function getProblem(url) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(url);

            request.onsuccess = () => resolve(isLive(request.result) ? request.result : undefined);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('AlgoRecall: Error getting problem from DB', error);
        throw error;
    }
}

// ---- Sync helpers (include tombstones) ----

export async function getAllRecordsIncludingDeleted() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const request = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getDirtyRecords() {
    const all = await getAllRecordsIncludingDeleted();
    return all.filter(r => r._dirty);
}

/** Clear _dirty only if the record hasn't changed since `lastUpdatedAt`. Resolves true if cleared. */
export async function markClean(url, lastUpdatedAt) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
        const getReq = store.get(url);
        getReq.onsuccess = () => {
            const rec = getReq.result;
            if (!rec || rec.last_updated_at !== lastUpdatedAt) { resolve(false); return; }
            const putReq = store.put({ ...rec, _dirty: false });
            putReq.onsuccess = () => resolve(true);
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

/** Write a record coming from the server, as-is, clean, without triggering sync. */
export async function putFromSync(record, { keepDirty = false } = {}) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
        const req = store.put({ ...record, _dirty: keepDirty ? !!record._dirty : false, _deleted_at: record._deleted_at || null });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function purgeTombstones(olderThanDays = 30) {
    const cutoff = Date.now() - olderThanDays * 86400000;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        let purged = 0;
        req.onsuccess = () => {
            for (const r of req.result) {
                if (r._deleted_at && !r._dirty && new Date(r._deleted_at).getTime() < cutoff) {
                    store.delete(r.url);
                    purged++;
                }
            }
        };
        tx.oncomplete = () => resolve(purged);
        tx.onerror = () => reject(tx.error);
    });
}
