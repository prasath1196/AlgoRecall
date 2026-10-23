jest.mock('../../db.js', () => ({ getAllProblems: jest.fn() }));
const db = require('../../db.js');
const r = require('../../src/background/reminders.js');

let store;
beforeEach(() => {
    store = {};
    global.chrome = {
        storage: { local: {
            get: jest.fn(async (k) => (k in store ? { [k]: store[k] } : {})),
            set: jest.fn(async (o) => Object.assign(store, o)),
        } },
        alarms: { create: jest.fn(async () => {}), clear: jest.fn(async () => true) },
        notifications: { create: jest.fn(async () => 'id'), clear: jest.fn() },
        tabs: { create: jest.fn() },
        runtime: { getURL: (p) => 'chrome-extension://x/' + p },
    };
});

describe('computeNextAlarmTime', () => {
    test('later today when time not passed', () => {
        const now = new Date(2026, 5, 10, 8, 0, 0);
        expect(new Date(r.computeNextAlarmTime('09:30', now))).toEqual(new Date(2026, 5, 10, 9, 30, 0, 0));
    });
    test('tomorrow when time passed or equal', () => {
        const now = new Date(2026, 5, 10, 9, 30, 0, 0);
        expect(new Date(r.computeNextAlarmTime('09:30', now))).toEqual(new Date(2026, 5, 11, 9, 30, 0, 0));
        expect(new Date(r.computeNextAlarmTime('07:05', now))).toEqual(new Date(2026, 5, 11, 7, 5, 0, 0));
    });
    test('month/year rollover keeps local wall-clock time', () => {
        const now = new Date(2026, 11, 31, 23, 0, 0);
        const d = new Date(r.computeNextAlarmTime('06:00', now));
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2027, 0, 1, 6, 0]);
    });
});

describe('reminder scheduling', () => {
    test('default reminder', async () => {
        expect(await r.getReminder()).toEqual({ enabled: false, time: '09:00' });
    });
    test('setReminder stores and creates daily alarm', async () => {
        expect(await r.setReminder({ enabled: true, time: '20:15' })).toEqual({ ok: true });
        expect(store.reminder).toEqual({ enabled: true, time: '20:15' });
        const [name, info] = chrome.alarms.create.mock.calls[0];
        expect(name).toBe('algorecall-reminder');
        expect(info.periodInMinutes).toBe(1440);
        const d = new Date(info.when);
        expect([d.getHours(), d.getMinutes()]).toEqual([20, 15]);
        expect(info.when).toBeGreaterThan(Date.now());
    });
    test('disable clears alarm; invalid time rejected', async () => {
        await r.setReminder({ enabled: false, time: '10:00' });
        expect(chrome.alarms.clear).toHaveBeenCalledWith('algorecall-reminder');
        expect((await r.setReminder({ enabled: true, time: '25:99' })).ok).toBe(false);
    });
});

describe('alarm handling', () => {
    const iso = (d) => new Date(d).toISOString();
    test('notifies only when due > 0', async () => {
        store.reminder = { enabled: true, time: '09:00' };
        db.getAllProblems.mockResolvedValue([{ url: 'a', next_review_at: iso(Date.now() + 5 * 86400000) }]);
        expect(await r.handleReminderAlarm()).toBe(false);
        expect(chrome.notifications.create).not.toHaveBeenCalled();

        db.getAllProblems.mockResolvedValue([
            { url: 'a', next_review_at: iso(Date.now() - 1000) },
            { url: 'b', next_review_at: iso(Date.now() - 5000) },
            { url: 'c', next_review_at: iso(Date.now() + 5 * 86400000) },
        ]);
        expect(await r.handleReminderAlarm()).toBe(true);
        const [, opts] = chrome.notifications.create.mock.calls[0];
        expect(opts.title).toBe('AlgoRecall');
        expect(opts.iconUrl).toBe('icon128.png');
        expect(opts.message).toBe('2 problems due today — keep your streak going 🔥');
    });
    test('disabled reminder never notifies', async () => {
        db.getAllProblems.mockResolvedValue([{ url: 'a', next_review_at: iso(0) }]);
        expect(await r.handleReminderAlarm()).toBe(false);
    });
    test('click opens dashboard and clears', () => {
        r.handleNotificationClick('algorecall-due');
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://x/src/dashboard/index.html' });
        expect(chrome.notifications.clear).toHaveBeenCalledWith('algorecall-due');
        chrome.tabs.create.mockClear();
        r.handleNotificationClick('other');
        expect(chrome.tabs.create).not.toHaveBeenCalled();
    });
    test('getLocalSummary counts total and due', async () => {
        db.getAllProblems.mockResolvedValue([{ next_review_at: iso(0) }, { next_review_at: iso(Date.now() + 9e9) }]);
        expect(await r.getLocalSummary()).toEqual({ total: 2, due: 1 });
    });
});
