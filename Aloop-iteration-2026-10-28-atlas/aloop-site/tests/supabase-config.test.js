import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateSupabaseConfig, supabaseConfigError, supabase, isSupabaseConfigured } from '../src/lib/supabase.js';

const ROOT = process.cwd();

describe('Supabase configuration', () => {
  it('reports a clear error when the environment variables are missing', () => {
    const result = validateSupabaseConfig(undefined, undefined);
    expect(result.code).toBe('missing_env');
    expect(result.message).toContain('VITE_SUPABASE_URL');
    expect(result.message).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
  });

  it('rejects a malformed project URL', () => {
    expect(validateSupabaseConfig('https://example.com', 'anon-key').code).toBe('invalid_url');
    expect(validateSupabaseConfig('http://abc.supabase.co', 'anon-key').code).toBe('invalid_url');
  });

  it('refuses to run with a service_role or sb_secret_ key', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co', 'service_role-key').code).toBe('secret_key');
    expect(validateSupabaseConfig('https://abc.supabase.co', 'sb_secret_abc').code).toBe('secret_key');
  });

  it('accepts a publishable key on a project URL', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co', 'sb_publishable_abc')).toBeNull();
    expect(validateSupabaseConfig('https://abc.supabase.co/', 'anon-key')).toBeNull();
  });

  it('exposes a single client instance (or none when unconfigured)', () => {
    expect(isSupabaseConfigured).toBe(Boolean(supabase));
    // The test environment has no VITE_SUPABASE_* values, so the client must be
    // null and the reason reported instead of throwing at import time.
    expect(supabaseConfigError?.code).toBe('missing_env');
    expect(supabase).toBeNull();
  });

  it('never hard-codes a secret key in the source tree', () => {
    for (const file of ['src/lib/supabase.js', 'src/lib/auth.js', 'src/lib/data.js']) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      expect(source, `${file} must not reference service_role`).not.toMatch(/service_role\s*[:=]\s*['"]/);
      expect(source, `${file} must not inline an sb_secret_ key`).not.toContain('sb_secret_ey');
    }
  });

  it('ships a replayable SQL migration with RLS enabled per table', () => {
    const sqlPath = join(ROOT, 'supabase/migrations/20261031090000_init_profiles_and_sessions.sql');
    expect(existsSync(sqlPath)).toBe(true);
    const sql = readFileSync(sqlPath, 'utf8');
    for (const table of ['profiles', 'experiment_sessions', 'experiment_events']) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(sql.match(/auth\.uid\(\)/g).length).toBeGreaterThanOrEqual(10);
    expect(sql).toContain('references auth.users');
    expect(sql).not.toMatch(/service_role/);
    expect(sql).toContain('on delete cascade');
  });
});
