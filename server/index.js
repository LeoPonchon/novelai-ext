const express = require('express');
const JSZip = require('jszip');

const PORT = Number(process.env.PORT || 3001);
const DEFAULT_TEXT_BASE_URL = process.env.NOVELAI_TEXT_BASE_URL || 'https://text.novelai.net/oa/v1';
const DEFAULT_IMAGE_BASE_URL = process.env.NOVELAI_IMAGE_BASE_URL || 'https://image.novelai.net';

function normalizeBaseUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/\/+$/, '');
}

function bearer(token) {
  if (!token || typeof token !== 'string') return null;
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

async function readJson(res) {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return { ok: false, text };
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));

function extractTextFromPart(part) {
  if (!part) return '';
  if (typeof part === 'string') return part;
  if (typeof part?.text === 'string') return part.text;
  if (typeof part?.content === 'string') return part.content;
  if (typeof part?.value === 'string') return part.value;
  if (typeof part?.delta?.text === 'string') return part.delta.text;
  if (typeof part?.delta?.content === 'string') return part.delta.content;
  return '';
}

function collectTextLikeStrings(obj, maxDepth = 4) {
  const out = [];
  const seen = new Set();

  function push(s) {
    const t = String(s || '');
    if (!t.trim()) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  }

  function walk(node, depth) {
    if (!node || depth > maxDepth) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;

    for (const [k, v] of Object.entries(node)) {
      if (k === 'content' || k === 'text' || k === 'value') {
        if (typeof v === 'string') push(v);
        else if (Array.isArray(v)) {
          for (const part of v) push(extractTextFromPart(part));
          walk(v, depth + 1);
        } else if (v && typeof v === 'object') {
          // sometimes content is nested as { text: "..." } etc
          walk(v, depth + 1);
        }
      } else if (v && typeof v === 'object') {
        walk(v, depth + 1);
      }
    }
  }

  walk(obj, 0);
  return out.join('');
}

function extractTextFromChatCompletion(data) {
  const choice = Array.isArray(data?.choices) ? data.choices[0] : undefined;

  // OpenAI-ish: choices[0].message.content (string or array of parts)
  const msg = choice?.message;
  const content = msg?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(extractTextFromPart).join('');
  }

  // Completions-ish fallback: choices[0].text
  if (typeof choice?.text === 'string') return choice.text;

  // Streaming-ish: choices[0].delta.content (string or array of parts)
  const delta = choice?.delta;
  if (typeof delta?.content === 'string') return delta.content;
  if (Array.isArray(delta?.content)) return delta.content.map(extractTextFromPart).join('');
  if (typeof delta?.text === 'string') return delta.text;

  // Last resort: search for "content/text/value" strings inside the choice.
  return collectTextLikeStrings(choice);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

function parseSseEvents(bodyText) {
  // Very small SSE parser: only reads `data:` lines and joins multi-line data blocks.
  const events = [];
  let current = [];

  const lines = bodyText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('data:')) {
      current.push(line.slice(5).trimStart());
      continue;
    }
    if (line.trim() === '') {
      if (current.length) {
        events.push(current.join('\n'));
        current = [];
      }
      continue;
    }
  }
  if (current.length) events.push(current.join('\n'));

  return events;
}

app.post('/api/chat', async (req, res) => {
  try {
    const {
      token,
      model = 'glm-4-6',
      messages,
      temperature = 0.8,
      max_tokens = 400,
      baseUrl,
    } = req.body || {};

    if (!token) return res.status(400).json({ error: 'Missing token' });
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'Missing messages[]' });

    const textBaseUrl = normalizeBaseUrl(baseUrl || DEFAULT_TEXT_BASE_URL);
    if (!textBaseUrl) return res.status(400).json({ error: 'Invalid baseUrl' });

    const safeMaxTokens = Number.isFinite(Number(max_tokens)) && Number(max_tokens) > 0 ? Number(max_tokens) : 400;
    const safeTemperature =
      Number.isFinite(Number(temperature)) && Number(temperature) >= 0 ? Number(temperature) : 0.8;

    const response = await fetch(`${textBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: bearer(token),
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        Origin: 'https://novelai.net',
        Referer: 'https://novelai.net/',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: safeTemperature,
        max_tokens: safeMaxTokens,
        // NovelAI's OA endpoint may return `chat.completion.chunk` shaped objects;
        // using streaming and aggregating deltas is the most reliable way to get text.
        stream: true,
      }),
    });

    if (!response.ok) {
      const parsed = await readJson(response);
      const hint =
        response.status === 401
          ? "Unauthorized: utilise un *Persistent API Token* NovelAI (Settings → Account → Get Persistent API Token). Les tokens de session (localStorage) expirent et ne marchent pas ici."
          : undefined;
      return res.status(response.status).json({
        error: 'NovelAI text request failed',
        status: response.status,
        statusText: response.statusText,
        url: `${textBaseUrl}/chat/completions`,
        hint,
        details: parsed.ok ? parsed.json : parsed.text,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();

    // Try JSON first (non-streaming or "chunk" single object).
    try {
      const data = JSON.parse(bodyText);
      const content = extractTextFromChatCompletion(data);
      return res.json({ content, raw: data });
    } catch {
      // Fallback: SSE or newline-delimited `data:` blocks.
    }

    // SSE: aggregate deltas.
    const eventPayloads = parseSseEvents(bodyText);
    let full = '';
    let lastEvent = null;
    let eventCount = 0;

    for (const payload of eventPayloads) {
      if (!payload) continue;
      if (payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        lastEvent = evt;
        const piece = extractTextFromChatCompletion(evt);
        if (piece) full += piece;
        eventCount += 1;
      } catch {
        // ignore non-json events
      }
    }

    // If it wasn't SSE at all, give some context back.
    if (!eventCount && !full) {
      return res.status(500).json({
        error: 'Unexpected text response format',
        contentType,
        preview: bodyText.slice(0, 2000),
      });
    }

    return res.json({
      content: full,
      raw: lastEvent || { object: 'sse', contentType, events: eventCount },
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

function makeImagePayload({
  model,
  prompt,
  negativePrompt,
  width,
  height,
  steps,
  scale,
  sampler,
  seed,
  qualityToggle,
}) {
  const payload = {
    action: 'generate',
    input: prompt,
    model,
    parameters: {
      width,
      height,
      scale,
      sampler,
      steps,
      n_samples: 1,
      ucPreset: 0,
      cfg_rescale: 0,
      controlnet_strength: 1,
      dynamic_thresholding: false,
      params_version: 3,
      legacy: false,
      legacy_uc: false,
      legacy_v3_extend: false,
      negative_prompt: negativePrompt,
      noise_schedule: 'native',
      qualityToggle,
      seed,
      sm: false,
      sm_dyn: false,
      add_original_image: false,
      characterPrompts: [],
      use_coords: false,
      deliberate_euler_ancestral_bug: false,
      prefer_brownian: true,
    },
  };

  if (String(model).startsWith('nai-diffusion-4')) {
    payload.parameters.v4_prompt = {
      caption: { base_caption: prompt, char_captions: [] },
      use_coords: false,
      use_order: true,
    };
    payload.parameters.v4_negative_prompt = {
      caption: { base_caption: negativePrompt, char_captions: [] },
    };
  }

  return payload;
}

app.post('/api/image', async (req, res) => {
  try {
    const {
      token,
      model = 'nai-diffusion-4-5-curated',
      prompt,
      negativePrompt = 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, watermark, text, caption, subtitles, speech bubble, negative space, blank page, blurry, bad anatomy, bad hands, extra fingers, missing fingers',
      width = 832,
      height = 1216,
      steps = 28,
      scale = 5.5,
      sampler = 'k_euler',
      seed = Math.floor(Math.random() * 2 ** 32),
      qualityToggle = true,
      baseUrl,
    } = req.body || {};

    if (!token) return res.status(400).json({ error: 'Missing token' });
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' });

    const imageBaseUrl = normalizeBaseUrl(baseUrl || DEFAULT_IMAGE_BASE_URL);
    if (!imageBaseUrl) return res.status(400).json({ error: 'Invalid baseUrl' });

    const payload = makeImagePayload({
      model,
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      scale,
      sampler,
      seed,
      qualityToggle,
    });

    const response = await fetch(`${imageBaseUrl}/ai/generate-image`, {
      method: 'POST',
      headers: {
        Authorization: bearer(token),
        'Content-Type': 'application/json',
        Origin: 'https://novelai.net',
        Referer: 'https://novelai.net/',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const parsed = await readJson(response);
      return res.status(response.status).json({
        error: 'NovelAI image request failed',
        status: response.status,
        details: parsed.ok ? parsed.json : parsed.text,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const buf = Buffer.from(await response.arrayBuffer());

    // NovelAI returns a zip with the images.
    if (!contentType.includes('zip') && !contentType.includes('octet-stream')) {
      // Sometimes errors come as JSON with 200; try to decode as JSON.
      try {
        const asText = buf.toString('utf8');
        const asJson = JSON.parse(asText);
        return res.status(500).json({ error: 'Unexpected response', details: asJson });
      } catch {
        return res.status(500).json({ error: 'Unexpected response content-type', contentType });
      }
    }

    const zip = await JSZip.loadAsync(buf);
    const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    if (fileNames.length === 0) return res.status(500).json({ error: 'Empty zip from NovelAI' });

    const imageNames = fileNames.filter((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    });

    if (imageNames.length === 0) {
      return res.status(500).json({ error: 'No image files in zip from NovelAI', files: fileNames.slice(0, 50) });
    }

    // Prefer the largest image in the archive (NovelAI sometimes includes previews/thumbnails).
    let best = { name: imageNames[0], size: -1 };
    for (const name of imageNames) {
      const zipFile = zip.files[name];
      const size = Number(zipFile?._data?.uncompressedSize ?? zipFile?._data?.compressedSize ?? -1);
      if (size > best.size) best = { name, size };
    }

    const chosenName = best.name;
    const imageBuf = Buffer.from(await zip.files[chosenName].async('nodebuffer'));

    const lower = chosenName.toLowerCase();
    const outType = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'application/octet-stream';

    res.setHeader('Content-Type', outType);
    res.setHeader('X-NovelAI-Seed', String(seed));
    res.setHeader('X-NovelAI-Model', String(model));
    res.setHeader('X-NovelAI-File', chosenName);
    res.send(imageBuf);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[server] text base: ${DEFAULT_TEXT_BASE_URL}`);
  // eslint-disable-next-line no-console
  console.log(`[server] image base: ${DEFAULT_IMAGE_BASE_URL}`);
});
