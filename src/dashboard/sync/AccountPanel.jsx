import React, { useEffect, useRef, useState } from 'react';
import { CloudIcon, XIcon, MailIcon, RefreshIcon, LogOutIcon, SparklesIcon, CloudCheckIcon, GithubIcon } from './icons';
import CodeInput from './CodeInput';
import { loadAuth, syncNowMsg, sendMsg, formatRelative, DEFAULT_STATUS } from './syncApi';
import './sync.css';

const RESEND_SECONDS = 30;

export function friendlyAuthError(err, kind) {
    const msg = String((err && (err.message || err.error_description || err)) || '');
    const code = err && (err.status || err.code);
    if (code === 429 || /429|rate|too many|security purposes/i.test(msg)) return 'Too many requests, try again in a minute';
    if (kind === 'verify' && /invalid|expired|token|otp|code/i.test(msg)) return 'That code is invalid or expired. Check it and try again.';
    if (/fetch|network|offline/i.test(msg)) return 'Network error. Check your connection and try again.';
    if (/email/i.test(msg) && kind === 'send') return 'Please enter a valid email address.';
    return msg || 'Something went wrong. Please try again.';
}

export const GITHUB_DISABLED_MSG = "GitHub sign-in isn't enabled yet \u2014 use email for now";

const AccountPanel = ({ isOpen, onClose, status, setStatus, refresh }) => {
    const [step, setStep] = useState('email'); // email | code
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [confirmOut, setConfirmOut] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const emailRef = useRef(null);

    const signedIn = status.state !== 'signed_out';

    useEffect(() => {
        if (countdown <= 0) return undefined;
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    useEffect(() => { if (isOpen && emailRef.current) emailRef.current.focus(); }, [isOpen, signedIn]);

    if (!isOpen) return null;

    const sendCode = async (e) => {
        if (e) e.preventDefault();
        const addr = email.trim();
        if (!/^\S+@\S+\.\S+$/.test(addr)) { setError('Please enter a valid email address.'); return; }
        setBusy(true); setError('');
        try {
            const auth = await loadAuth();
            await auth.sendEmailCode(addr);
            setStep('code'); setCode(''); setCountdown(RESEND_SECONDS);
        } catch (err) {
            setError(friendlyAuthError(err, 'send'));
        } finally { setBusy(false); }
    };

    const verify = async (value) => {
        const token = value || code;
        if (token.length !== 6 || busy) return;
        setBusy(true); setError('');
        try {
            const auth = await loadAuth();
            await auth.verifyEmailCode(email.trim(), token);
            const s = await refresh();
            if (!s || s.state === 'signed_out') setStatus({ ...DEFAULT_STATUS, state: 'idle', email: email.trim() });
            sendMsg({ type: 'SYNC_NOW' });
            setStep('email'); setCode('');
        } catch (err) {
            setError(friendlyAuthError(err, 'verify'));
            setCode('');
        } finally { setBusy(false); }
    };

    const signInGitHub = async () => {
        setBusy(true); setError('');
        try {
            let res = await sendMsg({ type: 'SIGN_IN_GITHUB' }, 120000);
            if (res === undefined) {
                // No background responder (e.g. opened outside the extension): try the module directly.
                const auth = await loadAuth();
                if (typeof auth.signInWithGitHub === 'function') {
                    try { res = await auth.signInWithGitHub(); if (res === undefined) res = { ok: true }; }
                    catch (err) { res = { ok: false, error: String((err && (err.code || err.message)) || 'failed') }; }
                }
            }
            if (res && res.ok) {
                const s = await refresh();
                if (!s || s.state === 'signed_out') setStatus({ ...DEFAULT_STATUS, state: 'idle' });
                sendMsg({ type: 'SYNC_NOW' });
            } else if (res && /provider_not_enabled/.test(String(res.error))) {
                setError(GITHUB_DISABLED_MSG);
            } else if (res && /cancel|closed|user_cancel|did not approve/i.test(String(res.error))) {
                setError('GitHub sign-in was cancelled.');
            } else {
                setError("Couldn't sign in with GitHub. Please try again or use email.");
            }
        } finally { setBusy(false); }
    };

    const doSyncNow = async () => {
        setSyncing(true);
        try {
            const s = await syncNowMsg();
            if (s) setStatus(s); else await refresh();
        } finally { setSyncing(false); }
    };

    const doSignOut = async () => {
        setBusy(true); setError('');
        try {
            const auth = await loadAuth();
            await auth.signOut();
            setStatus(DEFAULT_STATUS);
            setConfirmOut(false);
        } catch (err) {
            setError(friendlyAuthError(err, 'signout'));
        } finally { setBusy(false); }
    };

    const inputCls = 'w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder:text-gray-600';
    const primaryBtn = 'w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="account-title"
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-4 flex items-center justify-between border-b border-gray-800">
                    <h2 id="account-title" className="text-lg font-semibold text-white flex items-center gap-2">
                        <CloudIcon className="text-indigo-400" size={20} /> Account &amp; Sync
                    </h2>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <XIcon size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {!signedIn ? (
                        <>
                            <div className="text-center space-y-2">
                                <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                    <SparklesIcon size={24} className="text-indigo-400" />
                                </div>
                                <h3 className="text-white font-bold text-lg">Back up &amp; sync across devices</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Sign in with a one-time email code - no password. Your problems stay on this device first, and sync quietly in the background.
                                </p>
                            </div>

                            {step === 'email' && (
                                <>
                                    <button type="button" onClick={signInGitHub} disabled={busy}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors border border-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                                        <GithubIcon size={18} /> Continue with GitHub
                                    </button>
                                    <div className="flex items-center gap-3 text-xs text-gray-600" aria-hidden="true">
                                        <span className="flex-1 h-px bg-gray-800" /> or <span className="flex-1 h-px bg-gray-800" />
                                    </div>
                                </>
                            )}

                            {step === 'email' ? (
                                <form onSubmit={sendCode} className="space-y-3" noValidate>
                                    <label htmlFor="account-email" className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <MailIcon size={16} className="text-gray-400" /> Email address
                                    </label>
                                    <input id="account-email" ref={emailRef} type="email" autoComplete="email" value={email}
                                        onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                                        disabled={busy} className={inputCls} aria-invalid={!!error || undefined}
                                        aria-describedby={error ? 'account-error' : undefined} />
                                    <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>
                                        {busy ? (<><RefreshIcon size={16} className="ar-spin" /> Sending…</>) : 'Send code'}
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-400 text-center">
                                        We sent a 6-digit code to <span className="text-white font-medium">{email.trim()}</span>.
                                    </p>
                                    <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} hasError={!!error} />
                                    <button type="button" onClick={() => verify()} disabled={busy || code.length !== 6} className={primaryBtn}>
                                        {busy ? (<><RefreshIcon size={16} className="ar-spin" /> Verifying…</>) : 'Verify & sign in'}
                                    </button>
                                    <div className="flex items-center justify-between text-xs">
                                        <button type="button" onClick={() => { setStep('email'); setError(''); setCode(''); }}
                                            className="text-gray-400 hover:text-white underline">Use a different email</button>
                                        <button type="button" onClick={() => sendCode()} disabled={countdown > 0 || busy}
                                            className="text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:no-underline underline">
                                            {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-bold uppercase shrink-0">
                                    {(status.email || '?')[0]}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-white font-medium truncate" data-testid="account-email">{status.email || 'Signed in'}</div>
                                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                        <CloudCheckIcon size={14} className="text-emerald-400" />
                                        Last synced {status.lastSyncedAt ? formatRelative(status.lastSyncedAt) : 'never'}
                                    </div>
                                </div>
                            </div>
                            {status.state === 'error' && status.error && (
                                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{status.error}</p>
                            )}
                            <button type="button" onClick={doSyncNow} disabled={syncing || status.state === 'syncing'} className={primaryBtn}>
                                <RefreshIcon size={16} className={(syncing || status.state === 'syncing') ? 'ar-spin' : ''} />
                                {(syncing || status.state === 'syncing') ? 'Syncing…' : 'Sync now'}
                            </button>

                            <div className="border-t border-gray-800 pt-4">
                                {!confirmOut ? (
                                    <button type="button" onClick={() => setConfirmOut(true)}
                                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors">
                                        <LogOutIcon size={16} /> Sign out
                                    </button>
                                ) : (
                                    <div className="space-y-3 bg-gray-950 border border-gray-800 rounded-lg p-4" role="alertdialog" aria-label="Confirm sign out">
                                        <p className="text-sm text-gray-300">
                                            Sign out of this device? Your problems stay on this device - they just stop syncing until you sign in again.
                                        </p>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={doSignOut} disabled={busy}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg">Confirm sign out</button>
                                            <button type="button" onClick={() => setConfirmOut(false)}
                                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-lg">Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div id="account-error" role="alert" aria-live="assertive" className="min-h-0">
                        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPanel;
