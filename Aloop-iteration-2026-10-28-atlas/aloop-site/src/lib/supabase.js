import { createClient } from '@supabase/supabase-js';

// The publishable key is injected at build time by Cloudflare Workers builds.
// It is safe to ship in the bundle; a service_role / sb_secret_ key never is.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function validateSupabaseConfig(urlValue, keyValue) {
  if (!urlValue || !keyValue) {
    return {
      code: 'missing_env',
      message: '缺少 Supabase 环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY。登录注册不可用，其余页面仍可浏览。',
    };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(urlValue)) {
    return {
      code: 'invalid_url',
      message: 'VITE_SUPABASE_URL 不是有效的 Supabase 项目地址（应形如 https://<ref>.supabase.co）。',
    };
  }
  if (/service_role|sb_secret_/i.test(keyValue)) {
    return {
      code: 'secret_key',
      message: '检测到 service_role / sb_secret_ 密钥。前端只允许使用 publishable（anon）密钥。',
    };
  }
  return null;
}

export const supabaseConfigError = validateSupabaseConfig(url, publishableKey);

// One client per page load. `persistSession` restores the session after a
// refresh; `autoRefreshToken` keeps it valid while the tab stays open.
export const supabase = supabaseConfigError
  ? null
  : createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'aloop_supabase_auth',
      },
    });

export const isSupabaseConfigured = Boolean(supabase);
