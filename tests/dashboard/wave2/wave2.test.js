import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccountPanel from '../../../src/dashboard/sync/AccountPanel';
import BackupPrompt from '../../../src/dashboard/sync/BackupPrompt';
import SettingsModal from '../../../src/dashboard/SettingsModal';
import App, { queryClient as appQueryClient } from '../../../src/dashboard/App';
import { useProblems } from '../../../src/dashboard/hooks/useProblems';
import { PUBLIC_SITE_URL } from '../../../src/sync/config.js';

const mockProfile = { getMyProfile: jest.fn(), setProfile: jest.fn() };
jest.mock('../../../src/sync/profile.js', () => ({
    getMyProfile: (...a) => mockProfile.getMyProfile(...a),
    setProfile: (...a) => mockProfile.setProfile(...a),
}), { virtual: true });
jest.mock('../../../src/sync/auth.js', () => ({ sendEmailCode: jest.fn(), verifyEmailCode: jest.fn(), signOut: jest.fn() }), { virtual: true });
jest.mock('../../../src/sync/stats.js', () => ({ fetchStats: jest.fn().mockResolvedValue(null) }), { virtual: true });
jest.mock('../../../src/dashboard/hooks/useProblems');
jest.mock('../../../src/dashboard/components/QueueView', () => () => <div>Queue View</div>);
jest.mock('../../../src/dashboard/components/ReviewSession', () => () => <div />);
jest.mock('../../../src/dashboard/mock/MockInterviewView.jsx', () => ({
    __esModule: true,
    default: ({ onExit, weakPatterns }) => <div data-testid="mock-view">mock {weakPatterns.length}<button onClick={onExit}>exit-mock</button></div>,
}), { virtual: true });

let listeners;
let responses;
let storage;
const installChrome = () => {
    listeners = new Set();
    storage = {};
    responses = {};
    global.chrome = {
        storage: {
            local: {
                get: jest.fn((keys, cb) => { const out = {}; [].concat(keys).forEach(k => { if (k in storage) out[k] = storage[k]; }); cb && cb(out); }),
                set: jest.fn((obj, cb) => { Object.assign(storage, obj); cb && cb(); }),
            },
        },
        runtime: {
            lastError: undefined,
            sendMessage: jest.fn((msg, cb) => {
                const r = responses[msg.type];
                const res = typeof r === 'function' ? r(msg) : r;
                if (cb) cb(res);
            }),
            onMessage: { addListener: (f) => listeners.add(f), removeListener: (f) => listeners.delete(f) },
        },
    };
};
const emit = (m) => act(() => { [...listeners].forEach(f => f(m)); });
const signedOut = { state: 'signed_out', lastSyncedAt: null, error: null, email: null };
const signedIn = { state: 'idle', lastSyncedAt: new Date().toISOString(), error: null, email: 'a@b.co' };

beforeEach(() => { jest.clearAllMocks(); installChrome(); appQueryClient.clear(); });

describe('BackupPrompt', () => {
    test('shows for signed-out user with problems and opens account', async () => {
        responses.GET_LOCAL_SUMMARY = { total: 12, due: 2 };
        const onBackup = jest.fn();
        render(<BackupPrompt signedIn={false} onBackup={onBackup} />);
        expect(await screen.findByText(/Back up your 12 problems/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Back up now'));
        expect(onBackup).toHaveBeenCalled();
    });

    test('Not now snoozes 7 days', async () => {
        responses.GET_LOCAL_SUMMARY = { total: 3 };
        render(<BackupPrompt signedIn={false} onBackup={() => { }} />);
        fireEvent.click(await screen.findByText('Not now'));
        expect(screen.queryByTestId('backup-prompt')).toBeNull();
        const until = storage.backup_prompt_snoozed_until;
        expect(until - Date.now()).toBeGreaterThan(6.9 * 86400000);
        expect(until - Date.now()).toBeLessThanOrEqual(7 * 86400000);
    });

    test('hidden while snoozed, when signed in, or with zero problems', async () => {
        responses.GET_LOCAL_SUMMARY = { total: 3 };
        storage.backup_prompt_snoozed_until = Date.now() + 100000;
        const a = render(<BackupPrompt signedIn={false} onBackup={() => { }} />);
        await waitFor(() => expect(chrome.storage.local.get).toHaveBeenCalled());
        await act(async () => { });
        expect(screen.queryByTestId('backup-prompt')).toBeNull();
        a.unmount();
        storage = {};
        const b = render(<BackupPrompt signedIn onBackup={() => { }} />);
        await act(async () => { });
        expect(screen.queryByTestId('backup-prompt')).toBeNull();
        b.unmount();
        responses.GET_LOCAL_SUMMARY = { total: 0 };
        render(<BackupPrompt signedIn={false} onBackup={() => { }} />);
        await act(async () => { });
        expect(screen.queryByTestId('backup-prompt')).toBeNull();
    });
});

describe('Settings sections', () => {
    const open = (status = signedOut) => render(<SettingsModal isOpen onClose={() => { }} onSave={() => { }} status={status} />);

    test('reminder toggle sends SET_REMINDER with loaded time', async () => {
        responses.GET_REMINDER = { enabled: false, time: '07:30' };
        responses.SET_REMINDER = { ok: true };
        open();
        await waitFor(() => expect(screen.getByLabelText('Time')).toHaveValue('07:30'));
        fireEvent.click(screen.getByRole('switch', { name: 'Daily reminder' }));
        await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            { type: 'SET_REMINDER', enabled: true, time: '07:30' }, expect.any(Function)));
        expect(await screen.findByText('Reminder saved')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Time'), { target: { value: '21:15' } });
        await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            { type: 'SET_REMINDER', enabled: true, time: '21:15' }, expect.any(Function)));
    });

    test('import shows progress then summary', async () => {
        let finish;
        responses.IMPORT_LEETCODE = () => undefined;
        chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
            if (msg.type === 'IMPORT_LEETCODE') finish = cb;
        });
        open();
        fireEvent.click(screen.getByText('Import my solved problems'));
        emit({ type: 'IMPORT_PROGRESS', done: 5, total: 10 });
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
        expect(screen.getByText('5 of 10')).toBeInTheDocument();
        await act(async () => { finish({ ok: true, imported: 42, skipped: 8 }); });
        expect(await screen.findByText('Imported 42, skipped 8 already saved')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    test('import not_logged_in shows login guidance with link', async () => {
        responses.IMPORT_LEETCODE = { ok: false, error: 'not_logged_in' };
        open();
        fireEvent.click(screen.getByText('Import my solved problems'));
        expect(await screen.findByText(/Log in to leetcode.com in this browser, then try again/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /leetcode.com/i })).toHaveAttribute('href', expect.stringContaining('leetcode.com'));
    });

    test('profile + recap sections hidden when signed out', () => {
        open(signedOut);
        expect(screen.queryByTestId('profile-section')).toBeNull();
        expect(screen.queryByTestId('recap-section')).toBeNull();
    });

    test('public profile validates username, builds link, handles username_taken', async () => {
        mockProfile.getMyProfile.mockResolvedValue({ username: '', isPublic: false, weeklyRecap: false });
        mockProfile.setProfile.mockResolvedValue({ ok: false, error: 'username_taken' });
        open(signedIn);
        const input = await screen.findByLabelText('Username');
        fireEvent.change(input, { target: { value: 'AB' } });
        expect(input).toHaveValue('ab');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('profile-link')).toBeNull();
        expect(screen.getByText('Save profile')).toBeDisabled();

        fireEvent.change(input, { target: { value: 'Cool_Dev-1' } });
        expect(screen.getByTestId('profile-link')).toHaveTextContent(`${PUBLIC_SITE_URL}/u/cool_dev-1`);

        const writeText = jest.fn().mockResolvedValue();
        Object.assign(navigator, { clipboard: { writeText } });
        fireEvent.click(screen.getByLabelText('Copy profile link'));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${PUBLIC_SITE_URL}/u/cool_dev-1`));

        fireEvent.click(screen.getByRole('switch', { name: 'Make my progress page public' }));
        fireEvent.click(screen.getByText('Save profile'));
        expect(await screen.findByText(/already taken/)).toBeInTheDocument();
        expect(mockProfile.setProfile).toHaveBeenCalledWith({ username: 'cool_dev-1', isPublic: true, weeklyRecap: false });

        mockProfile.setProfile.mockResolvedValue({ ok: true });
        fireEvent.click(screen.getByText('Save profile'));
        expect(await screen.findByText('Profile saved')).toBeInTheDocument();
    });

    test('weekly recap toggle saves via setProfile', async () => {
        mockProfile.getMyProfile.mockResolvedValue({ username: 'sam', isPublic: true, weeklyRecap: false });
        mockProfile.setProfile.mockResolvedValue({ ok: true });
        open(signedIn);
        await waitFor(() => expect(screen.getByLabelText('Username')).toHaveValue('sam'));
        fireEvent.click(screen.getByRole('switch', { name: 'Weekly email recap' }));
        await waitFor(() => expect(mockProfile.setProfile).toHaveBeenCalledWith({ username: 'sam', isPublic: true, weeklyRecap: true }));
        await waitFor(() => expect(screen.getByRole('switch', { name: 'Weekly email recap' })).toHaveAttribute('aria-checked', 'true'));
    });
});

describe('AccountPanel GitHub', () => {
    const panel = () => render(<AccountPanel isOpen onClose={() => { }} status={signedOut} setStatus={() => { }} refresh={async () => signedOut} />);

    test('provider_not_enabled shows friendly message', async () => {
        responses.SIGN_IN_GITHUB = { ok: false, error: 'provider_not_enabled' };
        panel();
        fireEvent.click(screen.getByText('Continue with GitHub'));
        expect(await screen.findByText(/GitHub sign-in isn't enabled yet/)).toBeInTheDocument();
        expect(screen.getByText(/use email for now/)).toBeInTheDocument();
    });

    test('button sits above the email form', () => {
        panel();
        const gh = screen.getByText('Continue with GitHub');
        const email = screen.getByLabelText(/Email address/);
        expect(gh.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('Mock interview tab', () => {
    test('mounts lazily, receives props, and exits', async () => {
        useProblems.mockReturnValue({ problems: [{ url: 'u', title: 't', review_history: [] }], isLoading: false, saveProblem: jest.fn(), deleteProblem: jest.fn() });
        responses.GET_SYNC_STATUS = signedOut;
        render(<App />);
        fireEvent.click(screen.getByText('Mock interview'));
        expect(await screen.findByTestId('mock-view')).toHaveTextContent('mock 0');
        fireEvent.click(screen.getByText('exit-mock'));
        expect(await screen.findByText('Queue View')).toBeInTheDocument();
    });
});
