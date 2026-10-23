export function installChrome(statusResponse) {
    const listeners = new Set();
    global.chrome = {
        storage: { local: { get: jest.fn(), set: jest.fn() } },
        runtime: {
            lastError: undefined,
            sendMessage: jest.fn((msg, cb) => {
                let res;
                if (msg.type === 'GET_SYNC_STATUS') res = statusResponse;
                if (msg.type === 'SYNC_NOW') res = { status: { state: 'idle', lastSyncedAt: new Date().toISOString(), error: null, email: 'a@b.co' } };
                if (cb) cb(res);
                return undefined;
            }),
            onMessage: {
                addListener: (fn) => listeners.add(fn),
                removeListener: (fn) => listeners.delete(fn),
            },
        },
    };
    return { listeners, emit: (msg) => [...listeners].forEach((fn) => fn(msg)) };
}
