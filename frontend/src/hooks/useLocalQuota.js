import { useEffect, useRef, useState } from 'react';

export const QUOTA_KEY = 'chaowan:demo-quota:v1';
export const FREE_LIMIT = 10;

function readQuota() {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    const value = raw === null ? 0 : JSON.parse(raw);
    return {
      used: Number.isInteger(value) && value >= 0 ? Math.min(value, FREE_LIMIT) : 0,
      available: true,
    };
  } catch {
    return { used: 0, available: false };
  }
}

export default function useLocalQuota() {
  const [initial] = useState(readQuota);
  const [used, setUsed] = useState(initial.used);
  const [storageAvailable, setStorageAvailable] = useState(initial.available);
  const current = useRef(initial.used);

  function sync() {
    const stored = readQuota();
    if (!stored.available) setStorageAvailable(false);
    current.current = Math.max(current.current, stored.used);
    setUsed(current.current);
    return current.current;
  }

  function recordSuccess() {
    const next = Math.min(sync() + 1, FREE_LIMIT);
    current.current = next;
    setUsed(next);
    try {
      localStorage.setItem(QUOTA_KEY, JSON.stringify(next));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }

  useEffect(() => {
    function onStorage(event) {
      if (event.key === QUOTA_KEY || event.key === null) sync();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // sync only reads the stable ref and React setters.
  }, []);

  return { used, remaining: FREE_LIMIT - used, limit: FREE_LIMIT, storageAvailable, sync, recordSuccess };
}
