const mockClient = { rpc: jest.fn(), functions: { invoke: jest.fn() } };
jest.mock('../../src/sync/supabaseClient.js', () => ({ getSupabase: () => mockClient }));
const { getMyProfile, setProfile, requestHint } = require('../../src/sync/profile.js');

beforeEach(() => jest.clearAllMocks());

test('getMyProfile', async () => {
    mockClient.rpc.mockResolvedValue({ data: { username: 'a' }, error: null });
    expect(await getMyProfile()).toEqual({ username: 'a' });
    expect(mockClient.rpc).toHaveBeenCalledWith('get_my_profile');
    mockClient.rpc.mockResolvedValue({ data: null, error: new Error('x') });
    await expect(getMyProfile()).rejects.toThrow('x');
});

test('setProfile maps params and errors', async () => {
    mockClient.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await setProfile({ username: 'bob', isPublic: true, weeklyRecap: false })).toEqual({ ok: true });
    expect(mockClient.rpc).toHaveBeenCalledWith('set_profile', { p_username: 'bob', p_is_public: true, p_weekly_recap: false });
    mockClient.rpc.mockResolvedValue({ data: { ok: false, error: 'username_taken' }, error: null });
    expect(await setProfile({ username: 'bob' })).toEqual({ ok: false, error: 'username_taken' });
    mockClient.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });
    expect(await setProfile({ username: 'bob' })).toEqual({ ok: false, error: 'username_taken' });
    mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'invalid_username' } });
    expect((await setProfile({ username: '!' })).error).toBe('invalid_username');
});

test('requestHint success and error mapping', async () => {
    mockClient.functions.invoke.mockResolvedValue({ data: { hint: 'h', remaining_today: 3 }, error: null });
    expect(await requestHint({ level: 1 })).toEqual({ hint: 'h', remaining_today: 3 });
    expect(mockClient.functions.invoke).toHaveBeenCalledWith('hint', { body: { level: 1 } });

    mockClient.functions.invoke.mockResolvedValue({ data: { error: 'not_configured' }, error: null });
    expect(await requestHint({})).toEqual({ error: 'not_configured' });

    mockClient.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', message: 'non-2xx', context: { status: 429, json: async () => ({ error: 'limit_reached' }) } } });
    expect(await requestHint({})).toEqual({ error: 'limit_reached' });

    mockClient.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', message: 'non-2xx', context: { status: 401, json: async () => { throw new Error(); } } } });
    expect(await requestHint({})).toEqual({ error: 'not_signed_in' });

    mockClient.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request' } });
    expect(await requestHint({})).toEqual({ error: 'network' });
});
