import React, { useEffect, useState } from 'react';
import { CloudIcon, CloudOffIcon, CloudCheckIcon, CloudAlertIcon, RefreshIcon } from './icons';
import { formatRelative } from './syncApi';
import './sync.css';

export function describeStatus(status, now) {
    switch (status.state) {
        case 'syncing': return { label: 'Syncing…', tone: 'text-indigo-400', Icon: RefreshIcon, spin: true };
        case 'idle': return {
            label: status.lastSyncedAt ? `Synced ${formatRelative(status.lastSyncedAt, now)}` : 'Synced',
            tone: 'text-emerald-400', Icon: CloudCheckIcon,
        };
        case 'error': return { label: `Sync error${status.error ? `: ${status.error}` : ''}`, tone: 'text-red-400', Icon: CloudAlertIcon };
        case 'offline': return { label: 'Offline - changes will sync when you reconnect', tone: 'text-amber-400', Icon: CloudOffIcon };
        default: return { label: 'Sign in to sync', tone: 'text-gray-500', Icon: CloudIcon };
    }
}

const SyncIndicator = ({ status, onClick }) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);
    const { label, tone, Icon, spin } = describeStatus(status, now);
    const short = status.state === 'idle' ? label : null;

    return (
        <>
            <button
                type="button"
                onClick={onClick}
                title={label}
                aria-label={`Account and sync: ${label}`}
                className={`flex items-center gap-1.5 p-2 rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${tone}`}
            >
                <Icon size={20} className={spin ? 'ar-spin' : ''} />
                {short && <span className="hidden md:inline text-xs font-medium">{short}</span>}
            </button>
            <span className="sr-only" role="status" aria-live="polite">{label}</span>
        </>
    );
};

export default SyncIndicator;
