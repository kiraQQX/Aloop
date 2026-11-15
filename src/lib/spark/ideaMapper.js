// Maps between the in-app Idea Capsule and the spark_ideas row shape.

export const INPUT_MODES = Object.freeze(['imagery', 'voice', 'fragments', 'image', 'mixed']);

export function ideaToRow(idea, userId) {
  return {
    id: idea.id,
    user_id: userId,
    title: idea.title || '',
    raw_input: idea.rawInput || '',
    input_mode: INPUT_MODES.includes(idea.inputMode) ? idea.inputMode : 'mixed',
    sensory_profile: idea.sensoryProfile || {},
    visual_description: idea.visualDescription || '',
    generation_prompt: idea.generationPrompt || '',
    tags: Array.isArray(idea.tags) ? idea.tags.slice(0, 20) : [],
    asset_path: idea.assetPath || null,
    result_meta: {
      provenance: idea.provenance || 'demo',
      composition: idea.composition || '',
      palette: idea.palette || [],
      style: idea.style || 'luminous',
      fragments: idea.fragments || {},
      imageUrl: idea.imageUrl || null,
    },
    created_at: idea.createdAt,
    updated_at: idea.updatedAt,
  };
}

export function rowToIdea(row) {
  const meta = row.result_meta || {};
  return {
    id: row.id,
    title: row.title || '',
    rawInput: row.raw_input || '',
    inputMode: row.input_mode || 'mixed',
    sensoryProfile: row.sensory_profile || {},
    visualDescription: row.visual_description || '',
    generationPrompt: row.generation_prompt || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    assetPath: row.asset_path || null,
    provenance: meta.provenance || 'demo',
    composition: meta.composition || '',
    palette: Array.isArray(meta.palette) ? meta.palette : [],
    style: meta.style || 'luminous',
    fragments: meta.fragments || {},
    visualSvg: null,
    imageUrl: typeof meta.imageUrl === 'string' && /^https:\/\//i.test(meta.imageUrl) ? meta.imageUrl : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState: 'synced',
    inCloud: true,
    history: [],
  };
}
