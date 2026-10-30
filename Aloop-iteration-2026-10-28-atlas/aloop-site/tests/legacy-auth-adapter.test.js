import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SOURCE = readFileSync(join(process.cwd(), 'assets/js/core/auth.js'), 'utf8');

function runAdapter({ embedded, bridge } = {}) {
  const windowObject = { Aloop: {} };
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
  const sandbox = {
    window: windowObject,
    document,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setTimeout: schedule,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { window: windowObject, document, timers, auth: windowObject.Aloop.auth, ready: windowObject.Aloop.authReady };
}

describe('legacy auth adapter', () => {
  it('keeps the local debug adapter when the shell is absent (standalone reference)', async () => {
    const { auth, ready } = runAdapter({ embedded: false });
    await expect(ready).resolves.toBeUndefined();
    expect(auth.mode).toBe('local-debug');
    await expect(auth.signIn('1', '1')).resolves.toMatchObject({ ok: true });
    expect(auth.isSignedIn).toBe(true);
    await expect(auth.signIn('nope', 'nope')).resolves.toMatchObject({ ok: false, reason: 'invalid_credentials' });
    await auth.signOut();
    expect(auth.isSignedIn).toBe(false);
  });

  it('delegates to the shell bridge when embedded', async () => {
    const bridge = {
      signIn: vi.fn().mockResolvedValue({ ok: true, user: { id: 'supabase-1', email: 'a@b.c', label: 'a' } }),
      signUp: vi.fn().mockResolvedValue({ ok: true, needsConfirmation: true }),
      signOut: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { auth } = runAdapter({ embedded: true, bridge });
    expect(auth.mode).toBe('supabase');
    await expect(auth.signIn('a@b.c', 'secret')).resolves.toMatchObject({ ok: true });
    expect(bridge.signIn).toHaveBeenCalledWith('a@b.c', 'secret');
    await expect(auth.signUp('a@b.c', 'secret')).resolves.toMatchObject({ needsConfirmation: true });
    await expect(auth.signOut()).resolves.toMatchObject({ ok: true });
  });

  it('accepts the session pushed by the shell and resolves the router gate', async () => {
    const bridge = { signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() };
    const { auth, ready } = runAdapter({ embedded: true, bridge });
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
    const { timers, auth } = runAdapter({ embedded: true, bridge });
    expect(auth.user).toBeNull();
    const timeout = timers.find((timer) => timer.ms === 6000);
    expect(timeout).toBeTruthy();
    timeout.fn();
    expect(auth.user).toBeNull();
  });
});
