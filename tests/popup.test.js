/**
 * @jest-environment jsdom
 */
import { getAllProblems } from '../db.js';

// Setup Mock DOM
document.body.innerHTML = `
    <button id="tabBtnSave"></button>
    <button id="tabBtnReview"></button>
    <div id="tabSave"></div>
    <div id="tabReview" class="hidden"></div>
    <ul id="reviewList"></ul>
    <span id="dueCountBadge"></span>
    <button id="startSessionBtn"></button>
    <div id="url"></div>
    <div id="title"></div>
    <div id="platform"></div>
    <div id="difficulty"></div>
    <div id="tags"></div>
    <div id="notes"></div>
    <button id="saveBtn"></button>
    <div id="status"></div>
    <button id="dashboardBtn"></button>
    <a id="openDashboardLink"></a>
`;

// Mock chrome
global.chrome = {
    runtime: {
        getURL: jest.fn(path => path),
        sendMessage: jest.fn(),
        lastError: null
    },
    tabs: {
        query: jest.fn((query, cb) => cb([{ id: 1, url: 'https://leetcode.com/problems/two-sum/', title: 'Two Sum' }])),
        create: jest.fn(),
        sendMessage: jest.fn(),
    }
};

describe('Popup Due Count Logic', () => {
    let mockGetAllProblems;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Re-mock db.js for fresh state
        jest.mock('../db.js', () => ({
            getAllProblems: jest.fn(),
        }));

        mockGetAllProblems = require('../db.js').getAllProblems;

        // Reset elements that popup.js might have modified
        document.getElementById('reviewList').innerHTML = '';
        document.getElementById('dueCountBadge').textContent = '';
    });

    test('reproduces discrepancy: popup uses now() while dashboard uses end of UTC day', async () => {
        // Set fixed "now"
        const now = new Date('2026-01-24T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(now);

        // Problem 1: Due exactly now
        // Problem 2: Due in 2 hours (2026-01-24T14:00:00Z) - Still today UTC
        // Problem 3: Due tomorrow (2026-01-25T12:00:00Z)

        const problems = [
            { title: 'Due Now', next_review_at: '2026-01-24T12:00:00Z', url: 'p1', difficulty: 'Easy' },
            { title: 'Due Later Today', next_review_at: '2026-01-24T14:00:00Z', url: 'p2', difficulty: 'Medium' },
            { title: 'Due Tomorrow', next_review_at: '2026-01-25T12:00:00Z', url: 'p3', difficulty: 'Hard' }
        ];

        mockGetAllProblems.mockResolvedValue(problems);

        // Import popup.js using require to ensure it picked up the mock
        require('../popup.js');

        // Manually dispatch DOMContentLoaded to trigger listener
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // Trigger review tab click
        const tabBtnReview = document.getElementById('tabBtnReview');
        tabBtnReview.click();

        // Advance timers and flush promises
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const dueCountBadge = document.getElementById('dueCountBadge');

        // Current popup logic (BUG): 1.
        // '2026-01-24T14:00:00Z' <= '2026-01-24T12:00:00Z' is FALSE
        // Dashboard expectation: 2.

        expect(dueCountBadge.textContent).toBe('2 Due');

        jest.useRealTimers();
    });
});

async function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
