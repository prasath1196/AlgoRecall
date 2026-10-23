import React, { useEffect, useRef, useState } from 'react';
import { BellIcon } from '../sync/icons';
import { sendMsg } from '../sync/syncApi';
import { Toggle, SectionShell, inputCls } from './ui';

const DEFAULT = { enabled: false, time: '09:00' };

const ReminderSection = () => {
    const [reminder, setReminder] = useState(DEFAULT);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;
        sendMsg({ type: 'GET_REMINDER' }, 3000).then((res) => {
            if (!alive.current || !res || typeof res !== 'object') return;
            setReminder({
                enabled: !!res.enabled,
                time: /^\d{2}:\d{2}$/.test(res.time || '') ? res.time : DEFAULT.time,
            });
        });
        return () => { alive.current = false; };
    }, []);

    const save = async (next) => {
        setReminder(next);
        setError(''); setSaved(false);
        const res = await sendMsg({ type: 'SET_REMINDER', enabled: next.enabled, time: next.time }, 5000);
        if (!alive.current) return;
        if (res && res.ok) setSaved(true);
        else setError("Couldn't save your reminder. Please try again.");
    };

    return (
        <SectionShell icon={<BellIcon size={16} className="text-gray-400" />} title="Daily reminder" testId="reminder-section">
            <div className="flex items-center justify-between gap-4">
                <label htmlFor="reminder-toggle" className="text-sm text-gray-300">Remind me to review</label>
                <Toggle id="reminder-toggle" label="Daily reminder" checked={reminder.enabled}
                    onChange={(v) => save({ ...reminder, enabled: v })} />
            </div>
            <div className="flex items-center gap-3">
                <label htmlFor="reminder-time" className="text-sm text-gray-400">Time</label>
                <input id="reminder-time" type="time" value={reminder.time} disabled={!reminder.enabled}
                    onChange={(e) => e.target.value && save({ ...reminder, time: e.target.value })}
                    className={`${inputCls} disabled:opacity-50 font-mono`} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
                Once a day at this time, AlgoRecall shows a browser notification if you have problems due. Clicking it opens your recall queue. Chrome needs to be running, and notifications must be allowed for Chrome on your system.
            </p>
            <div role="status" aria-live="polite" className="text-xs">
                {saved && !error && <span className="text-emerald-400">Reminder saved</span>}
                {error && <span className="text-red-400">{error}</span>}
            </div>
        </SectionShell>
    );
};

export default ReminderSection;
