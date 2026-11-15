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

// ---------------------------------------------------------------------------
// Spark (瞬间): Idea Capsules. Same conventions as above — RLS on spark_ideas
// and the private `spark-assets` bucket restricts every row/object to auth.uid().
// ---------------------------------------------------------------------------
const SPARK_COLUMNS = 'id, title, raw_input, input_mode, sensory_profile, visual_description, generation_prompt, tags, asset_path, result_meta, created_at, updated_at';

export async function listSparkIdeas() {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured', data: [] };
  const { data, error } = await db.from('spark_ideas').select(SPARK_COLUMNS).order('updated_at', { ascending: false });
  if (error) return { ok: false, reason: error.code || 'query_failed', message: error.message, data: [] };
  return { ok: true, data: data ?? [] };
}

export async function saveSparkIdea(row) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  const { data, error } = await db
    .from('spark_ideas')
    .upsert(row, { onConflict: 'id' })
    .select('id, updated_at')
    .maybeSingle();
  if (error) return { ok: false, reason: error.code || 'write_failed', message: error.message };
  return { ok: true, data };
}

export async function deleteSparkIdea(id) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  const { error } = await db.from('spark_ideas').delete().eq('id', id);
  if (error) return { ok: false, reason: error.code || 'delete_failed', message: error.message };
  return { ok: true };
}

export async function deleteAllSparkIdeas() {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  const { error } = await db.from('spark_ideas').delete().not('id', 'is', null);
  if (error) return { ok: false, reason: error.code || 'delete_failed', message: error.message };
  return { ok: true };
}

export async function uploadSparkAsset(userId, ideaId, blob, extension, contentType) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  const path = `${userId}/${ideaId}.${extension}`;
  const { error } = await db.storage.from('spark-assets').upload(path, blob, { upsert: true, contentType });
  if (error) return { ok: false, reason: error.statusCode || 'upload_failed', message: error.message };
  return { ok: true, path };
}

export async function getSparkAssetUrl(path, expiresInSeconds = 3600) {
  const db = client();
  if (!db || !path) return { ok: false, reason: 'not_configured' };
  const { data, error } = await db.storage.from('spark-assets').createSignedUrl(path, expiresInSeconds);
  if (error) return { ok: false, reason: 'sign_failed', message: error.message };
  return { ok: true, url: data?.signedUrl || null };
}

export async function removeSparkAssets(paths) {
  const db = client();
  if (!db) return { ok: false, reason: 'not_configured' };
  if (!paths?.length) return { ok: true };
  const { error } = await db.storage.from('spark-assets').remove(paths);
  if (error) return { ok: false, reason: 'remove_failed', message: error.message };
  return { ok: true };
}
