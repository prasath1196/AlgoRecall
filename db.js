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

export async function saveProblem(problem) {
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
                problem.last_updated_at = now; // Explicit field as requested

                const putRequest = store.put(problem);
                putRequest.onsuccess = () => resolve(putRequest.result);
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

            request.onsuccess = () => resolve(request.result);
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
                const problems = request.result;
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
            const request = store.delete(url);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('AlgoRecall: Error deleting from DB', error);
        throw error;
    }
}
