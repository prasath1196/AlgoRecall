import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Async storage adapter so the auth session survives service-worker restarts and is shared
// between the background worker and extension pages.
export const chromeStorageAdapter = {
    async getItem(key) {
        const res = await chrome.storage.local.get(key);
        const v = res ? res[key] : undefined;
        return v === undefined ? null : v;
    },
    async setItem(key, value) {
        await chrome.storage.local.set({ [key]: value });
    },
    async removeItem(key) {
        await chrome.storage.local.remove(key);
    },
};

let client = null;

export function getSupabase() {
    if (!client) {
        client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                storage: chromeStorageAdapter,
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                flowType: 'pkce',
            },
        });
    }
    return client;
}
