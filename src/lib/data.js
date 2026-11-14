import { supabase } from './supabase';

// Thin data-access layer. Every table is protected by RLS (see
// supabase/migrations): the anon key can only touch rows owned by auth.uid().
// These helpers never fabricate data; a missing client returns null so callers
// can render a real error/empty state.

function client() {
  return supabase;
}

export async function ensureProfile(user) {
  const db = client();
  if (!db || !user?.id) return null;
  const displayName = user.label || user.email?.split('@')[0] || null;
  const { data, error } = await db
    .from('profiles')
    .upsert({ id: user.id, display_name: displayName }, { onConflict: 'id' })
    .select('id, display_name, created_at, updated_at')
    .maybeSingle();
  if (error) throw new Error(`profile upsert failed: ${error.message}`);
  return data;
}

export async function listExperimentSessions() {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured', data: [] };
  const { data, error } = await db
    .from('experiment_sessions')
    .select('id, experiment_id, arm, status, phase, started_at, updated_at, completed_at')
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, reason: error.code || 'query_failed', message: error.message, data: [] };
  return { ok: true, data: data ?? [] };
}

export async function saveExperimentSession(session) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  const { data, error } = await db
    .from('experiment_sessions')
    .upsert({
      id: session.id,
      experiment_id: session.experimentId,
      arm: session.arm ?? null,
      status: session.status ?? 'in_progress',
      phase: session.phase ?? null,
      payload: session.payload ?? {},
      completed_at: session.completedAt ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id, updated_at')
    .maybeSingle();
  if (error) return { ok: false, reason: error.code || 'write_failed', message: error.message };
  return { ok: true, data };
}

export async function deleteExperimentSession(id) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  const { error } = await db.from('experiment_sessions').delete().eq('id', id);
  if (error) return { ok: false, reason: error.code || 'delete_failed', message: error.message };
  return { ok: true };
}

export async function listExperimentEvents(sessionId) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured', data: [] };
  const { data, error } = await db
    .from('experiment_events')
    .select('id, session_id, kind, payload, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, reason: error.code || 'query_failed', message: error.message, data: [] };
  return { ok: true, data: data ?? [] };
}
