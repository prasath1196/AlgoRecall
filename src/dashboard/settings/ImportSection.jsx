import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, RefreshIcon } from '../sync/icons';
import { sendMsg, onRuntimeMessage } from '../sync/syncApi';
import { SectionShell, secondaryBtn } from './ui';

export const LEETCODE_LOGIN_URL = 'https://leetcode.com/accounts/login/';

const ImportSection = () => {
    const [phase, setPhase] = useState('idle'); // idle | running | done | not_logged_in | error
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState(null);
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;
        const off = onRuntimeMessage((msg) => {
            if (msg && msg.type === 'IMPORT_PROGRESS' && alive.current) {
                setProgress({ done: Number(msg.done) || 0, total: Number(msg.total) || 0 });
            }
        });
        return () => { alive.current = false; off(); };
    }, []);

    const start = async () => {
        setPhase('running'); setProgress({ done: 0, total: 0 }); setResult(null);
        const res = await sendMsg({ type: 'IMPORT_LEETCODE' }, 10 * 60 * 1000);
        if (!alive.current) return;
        if (res && res.ok) { setResult(res); setPhase('done'); }
        else if (res && res.error === 'not_logged_in') setPhase('not_logged_in');
        else setPhase('error');
    };

    const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
    const running = phase === 'running';

    return (
        <SectionShell icon={<DownloadIcon size={16} className="text-gray-400" />} title="Import from LeetCode" testId="import-section">
            <p className="text-xs text-gray-500 leading-relaxed">
                Bring in problems you've already solved. We read your accepted submissions using your existing leetcode.com login in this browser. Problems you've already saved keep their schedule.
            </p>
            <button type="button" onClick={start} disabled={running} className={secondaryBtn}>
                {running ? <RefreshIcon size={16} className="ar-spin" /> : <DownloadIcon size={16} />}
                {running ? 'Importing…' : 'Import my solved problems'}
            </button>
            {running && (
                <div className="space-y-1">
                    <div role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                        className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-500" data-testid="import-progress-text">
                        {progress.total > 0 ? `${progress.done} of ${progress.total}` : 'Starting…'}
                    </div>
                </div>
            )}
            <div role="status" aria-live="polite" className="text-sm">
                {phase === 'done' && result && (
                    <p className="text-emerald-400">Imported {result.imported || 0}, skipped {result.skipped || 0} already saved</p>
                )}
                {phase === 'not_logged_in' && (
                    <p className="text-amber-300">
                        Log in to leetcode.com in this browser, then try again.{' '}
                        <a href={LEETCODE_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="underline text-indigo-400 hover:text-indigo-300">Open leetcode.com</a>
                    </p>
                )}
                {phase === 'error' && <p className="text-red-400">Import failed. Check your connection and try again.</p>}
            </div>
        </SectionShell>
    );
};

export default ImportSection;
