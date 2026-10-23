import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SyncIndicator from '../../../src/dashboard/sync/SyncIndicator';
import { useSyncStatus } from '../../../src/dashboard/sync/useSyncStatus';
import { installChrome } from './helpers';

const Wrapper = () => {
    const { status } = useSyncStatus();
    return <SyncIndicator status={status} onClick={() => { }} />;
};

test('indicator loads initial status and reacts to SYNC_STATUS_CHANGED, cleans up listener', async () => {
    const bus = installChrome({ state: 'signed_out', lastSyncedAt: null, error: null, email: null });
    const { unmount } = render(<Wrapper />);
    expect(await screen.findByRole('button', { name: /Sign in to sync/ })).toBeInTheDocument();
    expect(bus.listeners.size).toBe(1);

    act(() => bus.emit({ type: 'SYNC_STATUS_CHANGED', status: { state: 'syncing', lastSyncedAt: null, error: null, email: 'a@b.co' } }));
    expect(screen.getByRole('button', { name: /Syncing/ })).toBeInTheDocument();

    act(() => bus.emit({ type: 'SYNC_STATUS_CHANGED', status: { state: 'idle', lastSyncedAt: new Date(Date.now() - 2 * 60000).toISOString(), error: null, email: 'a@b.co' } }));
    expect(screen.getByRole('button', { name: /Synced 2m ago/ })).toBeInTheDocument();

    act(() => bus.emit({ type: 'SYNC_STATUS_CHANGED', status: { state: 'error', lastSyncedAt: null, error: 'boom', email: 'a@b.co' } }));
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringContaining('boom'));

    act(() => bus.emit({ type: 'SYNC_STATUS_CHANGED', status: { state: 'offline', lastSyncedAt: null, error: null, email: 'a@b.co' } }));
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringMatching(/offline/i));

    unmount();
    expect(bus.listeners.size).toBe(0);
});
