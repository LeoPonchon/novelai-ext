async function readError(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toErrorMessage(details) {
  if (!details) return 'Request failed';
  if (typeof details === 'string') return details;
  // Prefer common fields but keep full JSON for debugging.
  const headline = details?.error || details?.message || 'Request failed';
  const extra = JSON.stringify(details, null, 2);
  return extra && extra !== '{}' ? `${headline}\n\n${extra}` : headline;
}

export async function novelaiChat({ token, baseUrl, model, messages, temperature, max_tokens }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, baseUrl, model, messages, temperature, max_tokens }),
  });

  if (!res.ok) {
    const details = await readError(res);
    throw new Error(toErrorMessage(details));
  }

  return await res.json();
}

export async function novelaiGenerateImage({
  token,
  baseUrl,
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
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      baseUrl,
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
    }),
  });

  if (!res.ok) {
    const details = await readError(res);
    throw new Error(toErrorMessage(details));
  }

  const blob = await res.blob();
  const meta = {
    seed: res.headers.get('x-novelai-seed') || '',
    model: res.headers.get('x-novelai-model') || '',
    file: res.headers.get('x-novelai-file') || '',
    contentType: blob.type || res.headers.get('content-type') || '',
  };

  return { blob, meta };
}
