import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const file = readdirSync(dir).find((name) => name.includes('spark_ideas'));
const sql = file ? readFileSync(join(dir, file), 'utf8') : '';

describe('spark_ideas migration', () => {
  it('exists as its own migration', () => {
    expect(file).toBeTruthy();
  });

  it('declares the planned columns', () => {
    for (const column of ['id uuid', 'user_id uuid', 'title', 'raw_input', 'input_mode', 'sensory_profile jsonb', 'visual_description', 'generation_prompt', 'tags text[]', 'asset_path', 'created_at', 'updated_at']) {
      expect(sql, column).toContain(column);
    }
  });

  it('enables RLS and scopes every table policy to auth.uid()', () => {
    expect(sql).toContain('alter table public.spark_ideas enable row level security');
    for (const action of ['select', 'insert', 'update', 'delete']) {
      expect(sql, action).toContain(`spark_ideas_${action}_own`);
    }
    expect(sql).toMatch(/auth\.uid\(\) = user_id/);
  });

  it('uses a private bucket with per-user folder policies', () => {
    expect(sql).toMatch(/'spark-assets', 'spark-assets', false/);
    expect(sql).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(sql).not.toMatch(/public\s*=\s*true/);
  });

  it('never stores raw EEG or audio columns', () => {
    const code = sql.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\b(eeg|audio_|recording|raw_signal)\b/i);
  });
});
