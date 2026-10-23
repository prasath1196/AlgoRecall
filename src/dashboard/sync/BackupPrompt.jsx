import React, { useEffect, useState } from 'react';
import { CloudIcon } from './icons';
import { sendMsg, storageGet, storageSet } from './syncApi';
import './sync.css';

export const SNOOZE_KEY = 'backup_prompt_snoozed_until';
export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// Shown only when signed out, status is known, and there is local data worth protecting.
const BackupPrompt = ({ signedIn, statusLoaded = true, onBackup }) => {
    const [total, setTotal] = useState(0);
    const [snoozed, setSnoozed] = useState(true); // hidden until storage is read

    useEffect(() => {
        if (signedIn || !statusLoaded) return undefined;
        let alive = true;
        (async () => {
            const [summary, stored] = await Promise.all([
                sendMsg({ type: 'GET_LOCAL_SUMMARY' }, 3000),
                storageGet([SNOOZE_KEY]),
            ]);
            if (!alive) return;
            setTotal(summary && typeof summary.total === 'number' ? summary.total : 0);
            const until = Number(stored && stored[SNOOZE_KEY]) || 0;
            setSnoozed(until > Date.now());
        })();
        return () => { alive = false; };
    }, [signedIn, statusLoaded]);

    if (signedIn || !statusLoaded || snoozed || total <= 0) return null;

    const snooze = () => {
        setSnoozed(true);
        storageSet({ [SNOOZE_KEY]: Date.now() + SNOOZE_MS });
    };

    return (
        <section aria-labelledby="backup-prompt-title" data-testid="backup-prompt"
            className="mb-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-gray-900 to-gray-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0 self-start">
                <CloudIcon size={22} />
            </div>
            <div className="flex-1 min-w-0">
                <h2 id="backup-prompt-title" className="text-sm font-semibold text-white">
                    Back up your {total} problem{total === 1 ? '' : 's'} - sync across devices
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                    Everything stays on this device first. Sign in to keep a safe copy and pick up where you left off anywhere.
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={onBackup}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                    Back up now
                </button>
                <button type="button" onClick={snooze}
                    className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    Not now
                </button>
            </div>
        </section>
    );
};

export default BackupPrompt;
