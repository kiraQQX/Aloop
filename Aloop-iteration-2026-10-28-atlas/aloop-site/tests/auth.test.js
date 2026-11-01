import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const CONFIG = { supabaseUrl: 'https://project.supabase.test', supabaseAnonKey: 'public-anon-key', siteUrl: 'https://aloop.space' };

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function loadAuth(config = CONFIG) {
  vi.resetModules();
  window.Aloop = {};
  window.ALOOP_CONFIG = config;
  await import('../assets/js/core/store.js');
  await import('../assets/js/core/auth.js');
  return window.Aloop.auth;
}

const SESSION_BODY = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3600,
  user: { id: 'user-1', email: 'ada.lovelace@example.com' },
};

describe('email authentication client', () => {
  let fetchMock;
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });

  it('runs in standalone mode when no shell bridge is present', async () => {
    const auth = await loadAuth();
    expect(auth.mode).toBe('standalone');
    expect(auth.configured).toBe(true);
  });

  it('refuses to run, without any network call, when the project is not configured', async () => {
    const auth = await loadAuth({ supabaseUrl: '', supabaseAnonKey: '' });
    expect(auth.configured).toBe(false);
    await expect(auth.signUp('a@b.co', 'password-1')).resolves.toMatchObject({ ok: false, reason: 'not_configured' });
    await expect(auth.signIn('a@b.co', 'password-1')).resolves.toMatchObject({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs up through /auth/v1/signup and waits for email verification instead of logging in', async () => {
    fetchMock.mockResolvedValue(reply(200, { id: 'user-1', email: 'ada@example.com', identities: [{}] }));
    const auth = await loadAuth();
    const result = await auth.signUp('ada@example.com', 'correct-horse-1');
    expect(result).toEqual({ ok: true, needsConfirmation: true });
    expect(auth.user).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://project.supabase.test/auth/v1/signup');
    expect(url).toContain('redirect_to=https%3A%2F%2Faloop.space%2F');
    expect(JSON.parse(init.body)).toMatchObject({ email: 'ada@example.com', password: 'correct-horse-1' });
    expect(init.headers.apikey).toBe('public-anon-key');
  });

  it('forwards the CAPTCHA token to Supabase when one is supplied', async () => {
    fetchMock.mockResolvedValue(reply(200, { id: 'user-1', email: 'ada@example.com' }));
    const auth = await loadAuth();
    await auth.signUp('ada@example.com', 'correct-horse-1', { captchaToken: 'turnstile-token' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).gotrue_meta_security).toEqual({ captcha_token: 'turnstile-token' });
  });

  it('logs in with the password grant, stores the session and restores it on the next load', async () => {
    fetchMock.mockResolvedValue(reply(200, SESSION_BODY));
    const auth = await loadAuth();
    const result = await auth.signIn('ada.lovelace@example.com', 'correct-horse-1');
    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=password');
    expect(auth.user).toEqual({ id: 'user-1', email: 'ada.lovelace@example.com', label: 'ada.lovelace' });
    expect(auth.isSignedIn).toBe(true);

    const reloaded = await loadAuth();
    expect(reloaded.user?.id).toBe('user-1');
  });

  it('maps Supabase errors to stable reasons', async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValueOnce(reply(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }));
    await expect(auth.signIn('a@b.co', 'x')).resolves.toMatchObject({ ok: false, reason: 'invalid_credentials' });
    fetchMock.mockResolvedValueOnce(reply(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' }));
    await expect(auth.signIn('a@b.co', 'x')).resolves.toMatchObject({ ok: false, reason: 'email_not_confirmed' });
    fetchMock.mockResolvedValueOnce(reply(429, { error_code: 'over_email_send_rate_limit' }));
    await expect(auth.signUp('a@b.co', 'password-1')).resolves.toMatchObject({ ok: false, reason: 'rate_limit' });
    fetchMock.mockResolvedValueOnce(reply(422, { error_code: 'weak_password', msg: 'Password should be at least 8 characters' }));
    await expect(auth.signUp('a@b.co', 'short')).resolves.toMatchObject({ ok: false, reason: 'weak_password' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(auth.signIn('a@b.co', 'x')).resolves.toMatchObject({ ok: false, reason: 'network' });
  });

  it('clears the local session on sign-out and tells Supabase', async () => {
    fetchMock.mockResolvedValue(reply(200, SESSION_BODY));
    const auth = await loadAuth();
    await auth.signIn('ada.lovelace@example.com', 'correct-horse-1');
    fetchMock.mockResolvedValue(reply(204, null));
    auth.signOut();
    expect(auth.user).toBeNull();
    expect(window.localStorage.getItem('aloop_session_v2')).toBeNull();
    const logoutCall = fetchMock.mock.calls.at(-1);
    expect(logoutCall[0]).toContain('/auth/v1/logout');
    expect(logoutCall[1].headers.Authorization).toBe('Bearer access-1');
  });

  it('discards a leftover local debug login from older builds', async () => {
    window.localStorage.setItem('aloop_auth_v1', JSON.stringify({ id: 'debug-local', email: '1' }));
    const auth = await loadAuth();
    expect(auth.user).toBeNull();
    expect(window.localStorage.getItem('aloop_auth_v1')).toBeNull();
  });

  it('requests a password reset email through GoTrue', async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    const auth = await loadAuth();
    await expect(auth.requestPasswordReset('ada@example.com')).resolves.toMatchObject({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/v1/recover');
    expect(url).toContain('redirect_to=https%3A%2F%2Faloop.space%2F');
    expect(JSON.parse(init.body)).toMatchObject({ email: 'ada@example.com' });
  });

  it('updates the password with the recovery token from the URL', async () => {
    window.location.hash = '#access_token=recovery-token&refresh_token=refresh-1&type=recovery';
    const auth = await loadAuth();
    expect(auth.recoveryPending).toBe(true);
    fetchMock.mockResolvedValue(reply(200, { id: 'user-1', email: 'ada@example.com' }));
    await expect(auth.updatePassword('new-password-1')).resolves.toMatchObject({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/v1/user');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer recovery-token');
    expect(JSON.parse(init.body)).toEqual({ password: 'new-password-1' });
    expect(auth.recoveryPending).toBe(false);
  });

  it('refuses to update a password without a recovery token or session', async () => {
    const auth = await loadAuth();
    await expect(auth.updatePassword('new-password-1')).resolves.toMatchObject({ ok: false, reason: 'no_session' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('account dialog contract', () => {
  it('ships no debug-account hint or debug credentials in production sources', () => {
    const shipped = [
      read('legacy.html'),
      read('assets/js/core/auth.js'),
      read('assets/js/ui/authmodal.js'),
      read('assets/i18n/site.js'),
      read('src/App.vue'),
    ].join('\n');
    expect(shipped).not.toMatch(/调试账号|authDebugHint|auth-debug-hint|debug-local|Local debug account/);
    expect(shipped).not.toContain('使用邮箱和密码登录 Aloop 账号');
  });

  it('collects a real email address and loads the public config before the auth client', () => {
    const html = read('legacy.html');
    expect(html).toMatch(/id="authEmail"[^>]*type="email"/);
    expect(html.indexOf('assets/js/core/config.js')).toBeGreaterThan(-1);
    expect(html.indexOf('assets/js/core/config.js')).toBeLessThan(html.indexOf('assets/js/core/auth.js'));
  });

  it('keeps secrets out of the browser config', () => {
    const config = read('assets/js/core/config.js');
    expect(config).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{16,}/);
  });
});
