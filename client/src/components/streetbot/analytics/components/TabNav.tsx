import * as React from 'react';

export interface Tab { key: string; label: string; }

interface Props {
  tabs:    Tab[];
  active:  string;
  onChange:(key: string) => void;
}

export function TabNav({ tabs, active, onChange }: Props) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border-light">
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={[
              'px-4 py-2 text-sm whitespace-nowrap',
              selected
                ? 'border-b-2 border-text-primary text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
