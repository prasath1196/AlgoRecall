import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccountPanel from '../../../src/dashboard/sync/AccountPanel';
import { useSyncStatus } from '../../../src/dashboard/sync/useSyncStatus';
import { installChrome } from './helpers';

const mockAuth = { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn(), signOut: jest.fn() };
jest.mock('../../../src/sync/auth.js', () => ({
    sendEmailCode: (...a) => mockAuth.sendEmailCode(...a),
    verifyEmailCode: (...a) => mockAuth.verifyEmailCode(...a),
    signOut: (...a) => mockAuth.signOut(...a),
}), { virtual: true });

// Test harness that mirrors how App wires the panel
const Harness = () => {
    const { status, setStatus, refresh } = useSyncStatus();
    return <AccountPanel isOpen onClose={() => { }} status={status} setStatus={setStatus} refresh={refresh} />;
};

const typeCode = (code) => {
    const first = screen.getByLabelText('Sign-in code');
    fireEvent.paste(first, { clipboardData: { getData: () => code } });
};

describe('AccountPanel', () => {
    let bus;
    beforeEach(() => {
        jest.clearAllMocks();
        bus = installChrome({ state: 'signed_out', lastSyncedAt: null, error: null, email: null });
    });

    test('sign-in flow: send code -> verify -> signed-in view', async () => {
        mockAuth.sendEmailCode.mockResolvedValue({});
        mockAuth.verifyEmailCode.mockImplementation(async () => {
            chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
                cb && cb(msg.type === 'GET_SYNC_STATUS'
                    ? { state: 'idle', lastSyncedAt: new Date().toISOString(), error: null, email: 'me@x.com' } : undefined);
            });
            return {};
        });
        render(<Harness />);

        expect(screen.getByText(/Back up & sync across devices/i)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'me@x.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

        await screen.findByLabelText('Sign-in code');
        expect(mockAuth.sendEmailCode).toHaveBeenCalledWith('me@x.com');
        expect(screen.getByText(/Resend code in 30s/)).toBeInTheDocument();

        typeCode('123456');
        await waitFor(() => expect(mockAuth.verifyEmailCode).toHaveBeenCalledWith('me@x.com', '123456'));
        expect(await screen.findByTestId('account-email')).toHaveTextContent('me@x.com');
        expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    });

    test('shows rate-limit and invalid-code errors', async () => {
        mockAuth.sendEmailCode.mockRejectedValueOnce(Object.assign(new Error('email rate limit exceeded'), { status: 429 }));
        render(<Harness />);
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'me@x.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
        expect(await screen.findByText('Too many requests, try again in a minute')).toBeInTheDocument();

        mockAuth.sendEmailCode.mockResolvedValue({});
        fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
        await screen.findByLabelText('Sign-in code');
        mockAuth.verifyEmailCode.mockRejectedValue(new Error('Token has expired or is invalid'));
        typeCode('000000');
        expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument();
    });

    describe('length-agnostic code entry', () => {
        const toCodeStep = async () => {
            mockAuth.sendEmailCode.mockResolvedValue({});
            mockAuth.verifyEmailCode.mockResolvedValue({});
            render(<Harness />);
            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'me@x.com' } });
            fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
            return screen.findByLabelText('Sign-in code');
        };

        test('8-digit paste auto-submits the full code', async () => {
            await toCodeStep();
            typeCode('12345678');
            await waitFor(() => expect(mockAuth.verifyEmailCode).toHaveBeenCalledWith('me@x.com', '12345678'));
            expect(mockAuth.verifyEmailCode).toHaveBeenCalledTimes(1);
        });

        test('typed 6 digits do not auto-submit; Enter submits', async () => {
            const input = await toCodeStep();
            fireEvent.change(input, { target: { value: '654321' } });
            expect(input).toHaveValue('654321');
            expect(mockAuth.verifyEmailCode).not.toHaveBeenCalled();
            fireEvent.keyDown(input, { key: 'Enter' });
            await waitFor(() => expect(mockAuth.verifyEmailCode).toHaveBeenCalledWith('me@x.com', '654321'));
        });

        test('5 digits keeps Verify disabled; 6 enables it', async () => {
            const input = await toCodeStep();
            fireEvent.change(input, { target: { value: '12345' } });
            expect(screen.getByRole('button', { name: /verify & sign in/i })).toBeDisabled();
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(mockAuth.verifyEmailCode).not.toHaveBeenCalled();
            fireEvent.change(input, { target: { value: '123456' } });
            expect(screen.getByRole('button', { name: /verify & sign in/i })).toBeEnabled();
        });

        test('non-digits are stripped on input and paste', async () => {
            const input = await toCodeStep();
            fireEvent.change(input, { target: { value: '12a-3 4' } });
            expect(input).toHaveValue('1234');
            typeCode('12 34-56 78');
            await waitFor(() => expect(mockAuth.verifyEmailCode).toHaveBeenCalledWith('me@x.com', '12345678'));
        });
    });

    describe('send-code error mapping', () => {
        const submit = (addr = 'me@x.com') => {
            render(<Harness />);
            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: addr } });
            fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
        };

        test('HTTP 500 SMTP failure shows could-not-send message, not email-format', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
            mockAuth.sendEmailCode.mockRejectedValueOnce(Object.assign(new Error('Error sending magic link email'), { status: 500, code: 'unexpected_failure', name: 'AuthApiError' }));
            submit();
            expect(await screen.findByText("We couldn't send the code right now. Please try again in a minute.")).toBeInTheDocument();
            expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument();
            expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^AlgoRecall:/), expect.anything());
            spy.mockRestore();
        });

        test('400 email_address_invalid shows valid-email message', async () => {
            mockAuth.sendEmailCode.mockRejectedValueOnce(Object.assign(new Error('Email address "x@y" is invalid'), { status: 400, code: 'email_address_invalid' }));
            submit();
            expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
        });

        test('429 over_email_send_rate_limit shows rate-limit message', async () => {
            mockAuth.sendEmailCode.mockRejectedValueOnce(Object.assign(new Error('email rate limit exceeded'), { status: 429, code: 'over_email_send_rate_limit' }));
            submit();
            expect(await screen.findByText('Too many requests, try again in a minute')).toBeInTheDocument();
        });

        test('client-side check rejects "abc" without calling auth', () => {
            submit('abc');
            expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
            expect(mockAuth.sendEmailCode).not.toHaveBeenCalled();
        });

        test('unknown error with "email" in message falls back to generic message', async () => {
            mockAuth.sendEmailCode.mockRejectedValueOnce(new Error('something about email odd'));
            submit();
            expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
        });
    });

    test('signed in: sync now sends SYNC_NOW and sign out asks for confirmation', async () => {
        installChrome({ state: 'idle', lastSyncedAt: new Date().toISOString(), error: null, email: 'me@x.com' });
        mockAuth.signOut.mockResolvedValue();
        render(<Harness />);
        expect(await screen.findByTestId('account-email')).toHaveTextContent('me@x.com');

        fireEvent.click(screen.getByRole('button', { name: /sync now/i }));
        await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'SYNC_NOW' }, expect.any(Function)));

        fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
        expect(screen.getByText(/stay on this device/i)).toBeInTheDocument();
        expect(mockAuth.signOut).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /confirm sign out/i }));
        await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalled());
        expect(await screen.findByText(/Back up & sync/i)).toBeInTheDocument();
    });
});
