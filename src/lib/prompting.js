function clean(s) {
  return String(s || '').trim();
}

function truncate(s, max = 900) {
  const t = clean(s);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildChatMessages({ character, messages }) {
  const parts = [];
  const name = clean(character?.name);
  const description = clean(character?.description);
  const appearance = clean(character?.appearance);
  const personality = clean(character?.personality);
  const rules = clean(character?.rules);

  parts.push('Tu es un assistant de jeu de rôle et d’écriture (en français).');
  if (name) parts.push(`Le personnage principal s’appelle : ${name}.`);
  if (description) parts.push(`Description :\n${description}`);
  if (appearance) parts.push(`Apparence :\n${appearance}`);
  if (personality) parts.push(`Personnalité :\n${personality}`);
  if (rules) parts.push(`Règles :\n${rules}`);
  parts.push(
    'Consignes: réponds naturellement, garde la cohérence, et fais avancer la scène. Évite les digressions.'
  );

  const system = { role: 'system', content: parts.join('\n\n') };
  const chat = (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: String(m.content || '') }));

  return [system, ...chat];
}

export function buildImagePromptMessages({ character, lastUser, lastAssistant }) {
  const appearance = clean(character?.appearance);
  const description = clean(character?.description);
  const personality = clean(character?.personality);

  const system = {
    role: 'system',
    content: [
      'You write NovelAI image prompts.',
      'Output ONLY a single line prompt (no markdown), comma+space separated tags/phrases.',
      'Style must be anime illustration; DO NOT include any readable text, letters, captions, speech bubbles, watermarks, logos.',
      'Do not include dialogue lines or quoted text.',
      'Prefer concise, visual, tag-like descriptors (Danbooru-style when applicable).',
      'Always include: "anime style, absurdres, incredibly absurdres, no text".',
    ].join('\n'),
  };

  const context = [
    appearance ? `Character appearance tags: ${appearance}` : '',
    !appearance && description ? `Character description: ${truncate(description, 500)}` : '',
    personality ? `Character vibe: ${truncate(personality, 220)}` : '',
    lastUser ? `Latest user message (for scene context only): ${truncate(lastUser, 240)}` : '',
    lastAssistant ? `Latest assistant scene: ${truncate(lastAssistant, 650)}` : '',
    '',
    'Return the final image prompt now:',
  ]
    .filter(Boolean)
    .join('\n');

  return [{ role: 'system', content: system.content }, { role: 'user', content: context }];
}

export function buildScenePrompt({ character, lastUser, lastAssistant }) {
  const appearance = clean(character?.appearance);
  const description = clean(character?.description);

  const sceneBits = [];
  if (appearance) sceneBits.push(`appearance: ${truncate(appearance, 400)}`);
  if (!appearance && description) sceneBits.push(`description: ${truncate(description, 400)}`);

  const prompt = [
    'anime style, absurdres, incredibly absurdres, no text',
    'cinematic lighting, detailed background, high detail',
    sceneBits.length ? `(${sceneBits.join(', ')})` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return prompt;
}
