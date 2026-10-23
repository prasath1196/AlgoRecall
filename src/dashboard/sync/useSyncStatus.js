import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_STATUS, getStatus, onRuntimeMessage, normalizeStatus } from './syncApi';

export function useSyncStatus() {
    const [status, setStatus] = useState(DEFAULT_STATUS);

    const refresh = useCallback(async () => {
        const s = await getStatus();
        setStatus(s);
        return s;
    }, []);

    useEffect(() => {
        let alive = true;
        getStatus().then((s) => { if (alive) setStatus((prev) => (prev === DEFAULT_STATUS ? s : prev)); });
        const off = onRuntimeMessage((msg) => {
            if (msg && msg.type === 'SYNC_STATUS_CHANGED' && alive) setStatus(normalizeStatus(msg.status));
        });
        return () => { alive = false; off(); };
    }, []);

    return { status, setStatus, refresh };
}
