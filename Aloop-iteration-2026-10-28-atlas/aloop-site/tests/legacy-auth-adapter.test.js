import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SOURCE = readFileSync(join(process.cwd(), 'assets/js/core/auth.js'), 'utf8');
const CONFIG = { supabaseUrl: 'https://project.supabase.test', supabaseAnonKey: 'public-anon-key', siteUrl: 'https://aloop.space' };

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function runAuth({ embedded, bridge, config = CONFIG, hash = '' } = {}) {
  const windowObject = {
    Aloop: {
      store: {
        data: {},
        getJSON(key, fallback) { return this.data[key] ?? fallback; },
        setJSON(key, value) { this.data[key] = value; },
        remove(key) { delete this.data[key]; },
      },
    },
    ALOOP_CONFIG: config,
    location: { hash, pathname: '/legacy.html', search: '', origin: 'https://aloop.space' },
    history: { replaceState: vi.fn() },
  };
  if (bridge) windowObject.parent = { __ALOOP_AUTH__: bridge };
  else windowObject.parent = windowObject;
  const document = {
    documentElement: { classList: { contains: (name) => embedded && name === 'vue-embedded' } },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
  };
  const timers = [];
  const schedule = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  windowObject.setTimeout = schedule;
  windowObject.clearTimeout = vi.fn();
  const fetchMock = vi.fn();
  const sandbox = {
    window: windowObject,
    document,
    fetch: fetchMock,
    URL,
    URLSearchParams,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setTimeout: schedule,
    clearTimeout: vi.fn(),
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { window: windowObject, document, timers, auth: windowObject.Aloop.auth, ready: windowObject.Aloop.authReady, fetchMock };
}

describe('legacy auth adapter — standalone mode', () => {
  it('uses the REST backend, never a debug account, when no shell bridge exists', async () => {
    const { auth, ready, fetchMock } = runAuth({ embedded: false, config: { supabaseUrl: '', supabaseAnonKey: '', siteUrl: 'https://aloop.space' } });
    await expect(ready).resolves.toBeUndefined();
    expect(auth.mode).toBe('standalone');
    expect(auth.configured).toBe(false);
    await expect(auth.signIn('a@b.co', 'secret-1')).resolves.toMatchObject({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in through GoTrue REST when the public config is present', async () => {
    const { auth, fetchMock } = runAuth({ embedded: false });
    fetchMock.mockResolvedValue(jsonResponse(200, {
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: { id: 'user-1', email: 'ada@example.com' },
    }));
    const result = await auth.signIn('ada@example.com', 'secret-1');
    expect(result.ok).toBe(true);
    expect(auth.isSignedIn).toBe(true);
    expect(auth.user).toMatchObject({ id: 'user-1', email: 'ada@example.com' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('https://project.supabase.test/auth/v1/token');
  });

  it('turns a recovery link into a pending password update', async () => {
    const { auth, document } = runAuth({ embedded: false, hash: '#access_token=recovery-token&type=recovery' });
    expect(auth.recoveryPending).toBe(true);
    expect(document.dispatchEvent).toHaveBeenCalled();
    expect(auth.accessToken).toBe('recovery-token');
  });
});

describe('legacy auth adapter — shell mode', () => {
  it('delegates every account action to the shell bridge', async () => {
    const bridge = {
      signIn: vi.fn().mockResolvedValue({ ok: true, user: { id: 'supabase-1', email: 'a@b.c', label: 'a' } }),
      signUp: vi.fn().mockResolvedValue({ ok: true, needsConfirmation: true }),
      signOut: vi.fn().mockResolvedValue({ ok: true }),
      resendVerification: vi.fn().mockResolvedValue({ ok: true }),
      requestPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
      updatePassword: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { auth, fetchMock } = runAuth({ embedded: true, bridge });
    expect(auth.mode).toBe('shell');
    expect(auth.configured).toBe(true);
    await expect(auth.signIn('a@b.c', 'secret-1')).resolves.toMatchObject({ ok: true });
    expect(bridge.signIn).toHaveBeenCalledWith('a@b.c', 'secret-1', {});
    await expect(auth.signUp('a@b.c', 'secret-1')).resolves.toMatchObject({ needsConfirmation: true });
    await expect(auth.signOut()).resolves.toMatchObject({ ok: true });
    await expect(auth.resendVerification('a@b.c')).resolves.toMatchObject({ ok: true });
    await expect(auth.requestPasswordReset('a@b.c')).resolves.toMatchObject({ ok: true });
    await expect(auth.updatePassword('new-secret-1')).resolves.toMatchObject({ ok: true });
    // Shell mode keeps REST fully disabled, even if a public config exists.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the session pushed by the shell and resolves the router gate', async () => {
    const bridge = { signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() };
    const { auth, ready } = runAuth({ embedded: true, bridge });
    expect(auth.user).toBeNull();
    auth.applySession({ id: 'u1', email: 'a@b.c', label: 'a' });
    await expect(ready).resolves.toBeUndefined();
    expect(auth.user).toMatchObject({ id: 'u1' });
    const seen = [];
    auth.onChange((user) => seen.push(user?.id ?? null));
    auth.applySession(null);
    expect(seen).toEqual([null]);
  });

  it('exposes a router-ready promise even if the shell never answers', async () => {
    const bridge = { signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() };
    const { timers, auth } = runAuth({ embedded: true, bridge });
    expect(auth.user).toBeNull();
    const timeout = timers.find((timer) => timer.ms === 6000);
    expect(timeout).toBeTruthy();
    timeout.fn();
    expect(auth.user).toBeNull();
  });
});
