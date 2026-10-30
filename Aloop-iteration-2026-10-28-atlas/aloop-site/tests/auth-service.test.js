import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: fakeAuth },
  supabaseConfigError: null,
  isSupabaseConfigured: true,
}));

vi.mock('../src/lib/data', () => ({
  ensureProfile: vi.fn().mockResolvedValue(null),
}));

const authModule = await import('../src/lib/auth.js');
const dataModule = await import('../src/lib/data.js');

const authUser = { id: 'user-1', email: 'ada@example.com', user_metadata: { display_name: 'Ada' } };

describe('Supabase auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataModule.ensureProfile.mockResolvedValue(null);
    fakeAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('restores a persisted session on init', async () => {
    fakeAuth.getSession.mockResolvedValue({ data: { session: { user: authUser } }, error: null });
    const result = await authModule.initAuth();
    expect(result.configured).toBe(true);
    expect(authModule.authState.user.value).toEqual({ id: 'user-1', email: 'ada@example.com', label: 'Ada', mode: 'supabase' });
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('signs in with the official password grant', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({ data: { user: authUser }, error: null });
    const result = await authModule.signIn('ada@example.com', 'secret');
    expect(fakeAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret' });
    expect(result.ok).toBe(true);
    expect(result.user.label).toBe('Ada');
  });

  it('maps invalid credentials to a failure without throwing', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    const result = await authModule.signIn('ada@example.com', 'wrong');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_credentials');
  });

  it('reports a network failure explicitly', async () => {
    fakeAuth.signInWithPassword.mockRejectedValue(new Error('fetch failed'));
    const result = await authModule.signIn('ada@example.com', 'secret');
    expect(result).toEqual({ ok: false, reason: 'network_error', message: 'fetch failed' });
  });

  it('flags a signup that still needs email confirmation', async () => {
    fakeAuth.signUp.mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    const result = await authModule.signUp('ada@example.com', 'secret');
    expect(result.ok).toBe(true);
    expect(result.needsConfirmation).toBe(true);
  });

  it('clears the user on sign out', async () => {
    fakeAuth.signOut.mockResolvedValue({ error: null });
    const result = await authModule.signOut();
    expect(result.ok).toBe(true);
    expect(authModule.authState.user.value).toBeNull();
  });

  it('does not double-subscribe when initAuth runs twice', async () => {
    // initAuth is idempotent: later calls must not add another auth listener.
    const before = fakeAuth.onAuthStateChange.mock.calls.length;
    await authModule.initAuth();
    await authModule.initAuth();
    expect(fakeAuth.onAuthStateChange.mock.calls.length).toBe(before);
  });
});
