import { useEffect, useState } from 'react';

function safeParse(json) {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch {
    return { ok: false, value: null };
  }
}

export function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initialValue;
      const parsed = safeParse(raw);
      return parsed.ok ? parsed.value : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota / disabled storage
    }
  }, [key, state]);

  return [state, setState];
}

