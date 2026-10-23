import React, { useState } from 'react';
import { MailIcon } from '../sync/icons';
import { Toggle, SectionShell } from './ui';

const WeeklyRecapSection = ({ profile, onSave }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const change = async (v) => {
        setBusy(true); setError('');
        const res = await onSave({ ...profile, weeklyRecap: v });
        setBusy(false);
        if (!(res && res.ok)) setError("Couldn't update your recap preference. Please try again.");
    };

    return (
        <SectionShell icon={<MailIcon size={16} className="text-gray-400" />} title="Weekly email recap" testId="recap-section">
            <div className="flex items-center justify-between gap-4">
                <label htmlFor="recap-toggle" className="text-sm text-gray-300">Email me a weekly recap</label>
                <Toggle id="recap-toggle" label="Weekly email recap" checked={profile.weeklyRecap} disabled={busy} onChange={change} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
                A short Monday email with your streak, reviews and weakest patterns, sent to your account email.
            </p>
            <div role="status" aria-live="polite" className="text-xs text-red-400">{error}</div>
        </SectionShell>
    );
};

export default WeeklyRecapSection;
