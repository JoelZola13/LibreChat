/* `useLocalStorage`
 *
 * Features:
 *  - JSON Serializing
 *  - Also value will be updated everywhere, when value updated (via `storage` event)
 */

import { useEffect, useState } from 'react';

function parseStoredValue<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === '' || raw === 'undefined' || raw === 'null') {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const item = localStorage.getItem(key);

    if (!item || item === 'undefined' || item === 'null') {
      localStorage.setItem(key, JSON.stringify(defaultValue));
    }

    setValue(parseStoredValue(item, defaultValue));

    function handler(e: StorageEvent) {
      if (e.key !== key) {
        return;
      }

      const lsi = localStorage.getItem(key);
      setValue(parseStoredValue(lsi, defaultValue));
    }

    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener('storage', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValueWrap = (value: T) => {
    try {
      setValue(value);

      localStorage.setItem(key, JSON.stringify(value));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new StorageEvent('storage', { key }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return [value, setValueWrap];
}
