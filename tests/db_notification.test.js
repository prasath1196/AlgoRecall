/**
 * @jest-environment jsdom
 */
import { getDueProblemsCount, openDB } from '../db.js';

// Basic IDBRequest mock helper
const createRequest = (result) => {
    let _onsuccess = null;
    const req = { result };

    Object.defineProperty(req, 'onsuccess', {
        set: (cb) => {
            _onsuccess = cb;
            if (typeof cb === 'function') setTimeout(() => cb({ target: { result } }), 0);
        },
        get: () => _onsuccess
    });
    return req;
};

// Mock IndexedDB Globals
const mockDB = {
    transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
            getAll: jest.fn()
        }))
    }))
};

global.indexedDB = {
    open: jest.fn(() => createRequest(mockDB))
};

describe('DB Notification Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Need to use require to ensure we get the fresh module with global mocks applied
    // But since db.js is an ES module, we should use dynamic import in the test

    test('getDueProblemsCount should use end-of-UTC-day logic', async () => {
        // Reset modules to pick up new global.indexedDB mock
        // Reset modules to pick up new global.indexedDB mock
        jest.resetModules();

        // Use requireActual to get the REAL implementation, bypassing setupTests.js mock
        const { getDueProblemsCount } = jest.requireActual('../db.js');

        // Setup Date: 12:00 UTC
        const now = new Date('2026-01-24T12:00:00Z');

        // Mock Date only, keep setTimeout real for IndexedDB callbacks
        jest.useFakeTimers({
            now: now,
            doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'nextTick', 'requestAnimationFrame']
        });

        const problems = [
            { title: 'Due Now', next_review_at: '2026-01-24T12:00:00Z', url: 'p1' },
            { title: 'Due Later Today', next_review_at: '2026-01-24T14:00:00Z', url: 'p2' },
            { title: 'Due Tomorrow', next_review_at: '2026-01-25T12:00:00Z', url: 'p3' }
        ];

        // Configure mock store
        const mockGetAll = jest.fn(() => createRequest(problems));
        mockDB.transaction.mockReturnValue({
            objectStore: jest.fn(() => ({
                getAll: mockGetAll
            }))
        });

        const promise = getDueProblemsCount();
        const count = await promise;

        // BUG: db.js uses 'now' as cutoff, so it will only see Problem 1.
        // EXPECTED: 2 (Problem 1 + Problem 2) because dashboard treats "Due Today" as anything < End of Day.
        // Bug expectation
        expect(count).toBe(2);
    });
});
