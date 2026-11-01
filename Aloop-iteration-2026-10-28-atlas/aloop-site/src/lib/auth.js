import { readonly, ref } from 'vue';
import { supabase, supabaseConfigError, isSupabaseConfigured } from './supabase';
import { ensureProfile } from './data';

const currentUser = ref(null);
const sessionReady = ref(false);
const listeners = new Set();
const eventListeners = new Set();
let initialized = false;

// Supabase emits PASSWORD_RECOVERY when a recovery link is opened. The shell
// listens for it so the account dialog can ask for a new password.
function emitEvent(event) {
  if (!event) return;
  eventListeners.forEach((callback) => {
    try { callback(event); } catch (error) { console.error('Aloop auth event listener failed', error); }
  });
  document.dispatchEvent(new CustomEvent('aloop:auth-event', { detail: { event } }));
}

export function toAppUser(authUser) {
  if (!authUser) return null;
  const email = authUser.email || '';
  const label = authUser.user_metadata?.display_name || email.split('@')[0] || 'account';
  return { id: authUser.id, email, label, mode: 'supabase' };
}

function emit() {
  const user = currentUser.value;
  listeners.forEach((callback) => {
    try { callback(user); } catch (error) { console.error('Aloop auth listener failed', error); }
  });
  document.dispatchEvent(new CustomEvent('aloop:auth-change', { detail: { user } }));
}

export function subscribeAuth(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function subscribeAuthEvent(callback) {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

export function getCurrentUser() {
  return currentUser.value;
}

/**
 * Restores the persisted session once per page load and subscribes to later
 * auth changes. Safe to call from multiple components: the work happens once.
 */
export async function initAuth() {
  if (initialized) {
    return { configured: isSupabaseConfigured, error: supabaseConfigError, user: currentUser.value };
  }
  initialized = true;

  if (!supabase) {
    sessionReady.value = true;
    emit();
    return { configured: false, error: supabaseConfigError, user: null };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn('Supabase session restore failed:', error.message);
    currentUser.value = toAppUser(data?.session?.user);
  } catch (error) {
    console.warn('Supabase session restore failed:', error);
  }
  sessionReady.value = true;

  supabase.auth.onAuthStateChange((event, session) => {
    currentUser.value = toAppUser(session?.user);
    if (currentUser.value) {
      ensureProfile(currentUser.value).catch((error) => console.warn('Profile sync failed:', error?.message || error));
    }
    emit();
    emitEvent(event);
  });

  if (currentUser.value) {
    ensureProfile(currentUser.value).catch((error) => console.warn('Profile sync failed:', error?.message || error));
  }
  emit();
  return { configured: true, error: null, user: currentUser.value };
}

export async function signIn(email, password) {
  if (!supabase) {
    return { ok: false, reason: 'not_configured', message: supabaseConfigError?.message };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
    if (error) return { ok: false, reason: error.code || 'auth_error', message: error.message };
    currentUser.value = toAppUser(data.user);
    emit();
    return { ok: true, user: currentUser.value };
  } catch (error) {
    return { ok: false, reason: 'network_error', message: error?.message || 'network_error' };
  }
}

export async function signUp(email, password) {
  if (!supabase) {
    return { ok: false, reason: 'not_configured', message: supabaseConfigError?.message };
  }
  try {
    const { data, error } = await supabase.auth.signUp({ email: String(email || '').trim(), password: String(password || '') });
    if (error) return { ok: false, reason: error.code || 'auth_error', message: error.message };
    // With email confirmation enabled Supabase returns a user but no session.
    const needsConfirmation = !data.session;
    currentUser.value = toAppUser(data.user);
    emit();
    return { ok: true, needsConfirmation, user: currentUser.value };
  } catch (error) {
    return { ok: false, reason: 'network_error', message: error?.message || 'network_error' };
  }
}

export async function signOut() {
  if (!supabase) {
    currentUser.value = null;
    emit();
    return { ok: true };
  }
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, reason: error.code || 'auth_error', message: error.message };
    currentUser.value = null;
    emit();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'network_error', message: error?.message || 'network_error' };
  }
}

export async function resendVerification(email) {
  if (!supabase) return { ok: false, reason: 'not_configured', message: supabaseConfigError?.message };
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: String(email || '').trim() });
    if (error) return { ok: false, reason: error.code || 'auth_error', message: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'network_error', message: error?.message || 'network_error' };
  }
}

export async function requestPasswordReset(email) {
  if (!supabase) return { ok: false, reason: 'not_configured', message: supabaseConfigError?.message };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) return { ok: false, reason: error.code || 'auth_error', message: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'network_error', message: error?.message || 'network_error' };
  }
}

export async function updatePassword(password) {
  if (!supabase) return { ok: false, reason: 'not_configured', message: supabaseConfigError?.message };
  try {
    const { error } = await supabase.auth.updateUser({ password: String(password || '') });
    if (error) return { ok: false, reason: error.code || 'auth_error', message: error.message };
    currentUser.value = toAppUser((await supabase.auth.getUser()).data?.user);
    emit();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'network_error', message: error?.message || 'network_error' };
  }
}

export const authState = {
  user: readonly(currentUser),
  ready: readonly(sessionReady),
  configError: supabaseConfigError,
  configured: isSupabaseConfigured,
};
