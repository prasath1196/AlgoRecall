import React, { useEffect, useRef, useState } from 'react';
import { GlobeIcon, CopyIcon } from '../sync/icons';
import { PUBLIC_SITE_URL } from '../../sync/config.js';
import { Toggle, SectionShell, inputCls, secondaryBtn } from './ui';
import { USERNAME_RE } from './useProfile';

const ERRORS = {
    username_taken: 'That username is already taken. Try another.',
    invalid_username: 'Usernames are 3-30 characters: lowercase letters, numbers, - and _.',
};

const PublicProfileSection = ({ profile, onSave, loading }) => {
    const [username, setUsername] = useState(profile.username);
    const [isPublic, setIsPublic] = useState(profile.isPublic);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef(null);

    useEffect(() => { setUsername(profile.username); setIsPublic(profile.isPublic); }, [profile.username, profile.isPublic]);
    useEffect(() => () => clearTimeout(copyTimer.current), []);

    const valid = USERNAME_RE.test(username);
    const showInvalid = username.length > 0 && !valid;
    const link = valid ? `${PUBLIC_SITE_URL}/u/${username}` : '';
    const dirty = username !== profile.username || isPublic !== profile.isPublic;
    const canSave = !saving && dirty && (isPublic ? valid : (username === '' || valid));

    const save = async () => {
        setSaving(true); setError(''); setSaved(false);
        const res = await onSave({ ...profile, username, isPublic });
        setSaving(false);
        if (res && res.ok) setSaved(true);
        else setError(ERRORS[res && res.error] || "Couldn't save your profile. Please try again.");
    };

    const copy = async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true); } catch (e) { setCopied(false); setError('Copy failed. Select the link and copy it manually.'); return; }
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
    };

    return (
        <SectionShell icon={<GlobeIcon size={16} className="text-gray-400" />} title="Public profile" testId="profile-section">
            <div className="space-y-1.5">
                <label htmlFor="profile-username" className="block text-xs text-gray-400">Username</label>
                <input id="profile-username" type="text" value={username} disabled={loading} autoComplete="off" spellCheck="false"
                    maxLength={30} placeholder="your-name"
                    onChange={(e) => { setUsername(e.target.value.toLowerCase()); setSaved(false); setError(''); }}
                    aria-invalid={showInvalid || undefined} aria-describedby="profile-username-help"
                    className={`${inputCls} w-full font-mono`} />
                <p id="profile-username-help" className={`text-xs ${showInvalid ? 'text-red-400' : 'text-gray-500'}`}>
                    {showInvalid ? ERRORS.invalid_username : '3-30 characters: lowercase letters, numbers, - and _.'}
                </p>
            </div>
            <div className="flex items-center justify-between gap-4">
                <label htmlFor="profile-public" className="text-sm text-gray-300">Make my progress page public</label>
                <Toggle id="profile-public" label="Make my progress page public" checked={isPublic}
                    onChange={(v) => { setIsPublic(v); setSaved(false); }} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
                Shows your streak, retention and pattern strengths. Never your code, notes, or problem titles.
            </p>
            {isPublic && !valid && <p className="text-xs text-amber-300">Choose a valid username to publish your page.</p>}
            {link && (
                <div className="flex items-center gap-2">
                    <a href={link} target="_blank" rel="noopener noreferrer" data-testid="profile-link"
                        className="flex-1 min-w-0 truncate text-sm text-indigo-400 hover:text-indigo-300 underline font-mono">{link}</a>
                    <button type="button" onClick={copy} className={secondaryBtn} aria-label="Copy profile link">
                        <CopyIcon size={14} /> {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            )}
            <div className="flex items-center gap-3">
                <button type="button" onClick={save} disabled={!canSave} className={secondaryBtn}>
                    {saving ? 'Saving…' : 'Save profile'}
                </button>
                <div role="status" aria-live="polite" className="text-xs">
                    {saved && !error && <span className="text-emerald-400">Profile saved</span>}
                    {error && <span className="text-red-400">{error}</span>}
                </div>
            </div>
        </SectionShell>
    );
};

export default PublicProfileSection;
