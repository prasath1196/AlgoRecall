import { getSupabase } from './supabaseClient.js';
import { getSession } from './auth.js';

export async function fetchStats(tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await getSupabase().rpc('get_my_stats', { tz });
    if (error) throw error;
    return data;
}
