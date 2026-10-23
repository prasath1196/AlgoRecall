const mockAuth = { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn() };
jest.mock('../../src/sync/supabaseClient.js', () => ({ getSupabase: () => ({ auth: mockAuth }) }));
const mockSync = jest.fn(() => Promise.resolve());
jest.mock('../../src/sync/sync.js', () => ({ syncNow: (...a) => mockSync(...a) }));
const { parseAuthRedirect, mapAuthError, signInWithGitHubFlow } = require('../../src/background/githubAuth.js');

beforeEach(() => {
    jest.clearAllMocks();
    global.chrome = { identity: { getRedirectURL: () => 'https://id.chromiumapp.org/', launchWebAuthFlow: jest.fn() } };
});

test('parseAuthRedirect', () => {
    expect(parseAuthRedirect('https://id.chromiumapp.org/?code=abc')).toEqual({ code: 'abc' });
    expect(parseAuthRedirect('https://id.chromiumapp.org/#code=xyz')).toEqual({ code: 'xyz' });
    expect(parseAuthRedirect('https://id.chromiumapp.org/')).toEqual({ error: 'no_code' });
    expect(parseAuthRedirect(undefined)).toEqual({ error: 'no_redirect' });
    expect(parseAuthRedirect('https://x/?error=access_denied&error_description=denied')).toEqual({ error: 'denied' });
});

test('mapAuthError', () => {
    expect(mapAuthError({ message: 'Unsupported provider: provider is not enabled' })).toBe('provider_not_enabled');
    expect(mapAuthError(new Error('The user did not approve access.'))).toBe('cancelled');
});

test('success exchanges code and triggers full sync', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://auth' }, error: null });
    chrome.identity.launchWebAuthFlow.mockResolvedValue('https://id.chromiumapp.org/?code=c1');
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    expect(await signInWithGitHubFlow()).toEqual({ ok: true });
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github', options: { redirectTo: 'https://id.chromiumapp.org/', skipBrowserRedirect: true },
    });
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith({ url: 'https://auth', interactive: true });
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('c1');
    expect(mockSync).toHaveBeenCalledWith({ full: true });
});

test('provider not enabled from signInWithOAuth', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'provider is not enabled' } });
    expect(await signInWithGitHubFlow()).toEqual({ ok: false, error: 'provider_not_enabled' });
});

test('provider not enabled surfaced in redirect', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'u' }, error: null });
    chrome.identity.launchWebAuthFlow.mockResolvedValue('https://x/?error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled');
    expect(await signInWithGitHubFlow()).toEqual({ ok: false, error: 'provider_not_enabled' });
});

test('user closes the window', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'u' }, error: null });
    chrome.identity.launchWebAuthFlow.mockRejectedValue(new Error('The user did not approve access.'));
    expect(await signInWithGitHubFlow()).toEqual({ ok: false, error: 'cancelled' });
});
