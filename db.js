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

            // Add timestamp for local tracking
            problem.local_saved_at = new Date().toISOString();

            const request = store.put(problem);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
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
