/* `useLocalStorage`
 *
 * Features:
 *  - JSON Serializing
 *  - Also value will be updated everywhere, when value updated (via `storage` event)
 */

import { useEffect, useState, useCallback } from 'react';

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

export default function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  globalSetState?: (value: T) => void,
  storageCondition?: (value: T, rawCurrentValue?: string | null) => boolean,
): [T, (value: T) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const item = localStorage.getItem(key);
    const shouldResetStoredValue = !item || item === 'undefined' || item === 'null';

    if (shouldResetStoredValue && !storageCondition) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
    } else if (shouldResetStoredValue && storageCondition && storageCondition(defaultValue)) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
    }

    const initialValue = parseStoredValue(item, defaultValue);
    setValue(initialValue);
    if (globalSetState) {
      globalSetState(initialValue);
    }

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
  }, [key, globalSetState]);

  const setValueWrap = useCallback(
    (value: T) => {
      try {
        setValue(value);
        const storeLocal = () => {
          localStorage.setItem(key, JSON.stringify(value));
          window?.dispatchEvent(new StorageEvent('storage', { key }));
        };
        if (!storageCondition) {
          storeLocal();
        } else if (storageCondition(value, localStorage.getItem(key))) {
          storeLocal();
        }
        globalSetState?.(value);
      } catch (e) {
        console.error(e);
      }
    },
    [key, globalSetState, storageCondition],
  );

  return [value, setValueWrap];
}
