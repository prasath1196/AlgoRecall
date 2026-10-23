import { getAllProblems } from '../../db.js';

export const REMINDER_ALARM = 'algorecall-reminder';
export const NOTIFICATION_ID = 'algorecall-due';
export const DEFAULT_REMINDER = { enabled: false, time: '09:00' };

export function isValidTime(t) {
    return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** Epoch ms of the next occurrence of HH:MM in local time, strictly after `now`. DST-safe: hours are re-set after day roll. */
export function computeNextAlarmTime(time, now = new Date()) {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(now.getTime());
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now.getTime()) {
        d.setDate(d.getDate() + 1);
        d.setHours(h, m, 0, 0);
    }
    return d.getTime();
}

export function endOfLocalDay(now = new Date()) {
    const d = new Date(now.getTime());
    d.setHours(23, 59, 59, 999);
    return d;
}

export async function getLocalSummary(now = new Date()) {
    const problems = await getAllProblems();
    const cutoff = endOfLocalDay(now).getTime();
    const due = problems.filter(p => p.next_review_at && new Date(p.next_review_at).getTime() <= cutoff).length;
    return { total: problems.length, due };
}

export async function getReminder() {
    const res = (await chrome.storage.local.get('reminder')) || {};
    const r = res.reminder || {};
    return {
        enabled: !!r.enabled,
        time: isValidTime(r.time) ? r.time : DEFAULT_REMINDER.time,
    };
}

export async function setReminder({ enabled, time }) {
    if (!isValidTime(time)) return { ok: false, error: 'invalid_time' };
    await chrome.storage.local.set({ reminder: { enabled: !!enabled, time } });
    await scheduleReminder();
    return { ok: true };
}

export async function scheduleReminder() {
    const { enabled, time } = await getReminder();
    try {
        if (!enabled) {
            await chrome.alarms.clear(REMINDER_ALARM);
            return null;
        }
        const when = computeNextAlarmTime(time);
        await chrome.alarms.create(REMINDER_ALARM, { when, periodInMinutes: 1440 });
        return when;
    } catch (e) {
        console.error('AlgoRecall: reminder schedule failed', e);
        return null;
    }
}

export async function handleReminderAlarm() {
    const { enabled } = await getReminder();
    if (!enabled) return false;
    // Period is a fixed 1440 min, so re-anchor to local time (handles DST shifts).
    scheduleReminder();
    const { due } = await getLocalSummary();
    if (due <= 0) return false;
    await chrome.notifications.create(NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'AlgoRecall',
        message: `${due} problem${due === 1 ? '' : 's'} due today — keep your streak going 🔥`,
    });
    return true;
}

export function handleNotificationClick(id) {
    if (id !== NOTIFICATION_ID) return;
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
    chrome.notifications.clear(id);
}
