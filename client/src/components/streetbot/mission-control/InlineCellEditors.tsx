import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, ChevronDown, Search, Bot } from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';

const C = DEFAULT_COLORS;

// ── Local storage for custom field values ──

const STORE_KEY = 'sv-field-values';

export function getFieldValue(taskId: string, fieldId: string): string {
  try {
    const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return store[`${taskId}::${fieldId}`] || '';
  } catch { return ''; }
}

export function setFieldValue(taskId: string, fieldId: string, value: string) {
  try {
    const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (value) {
      store[`${taskId}::${fieldId}`] = value;
    } else {
      delete store[`${taskId}::${fieldId}`];
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

// ── Shared popover wrapper ──

function CellPopover({ children, onClose, width = 200 }: {
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 9999,
      width, marginTop: 4, borderRadius: 10,
      background: '#1e1e2a', border: `1px solid ${C.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
      padding: '8px 0',
    }}
    onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// ── Text field editor ──

export function TextCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={220}>
      <div style={{ padding: '4px 8px' }}>
        <input
          ref={ref} type="text" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="Enter text..."
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Number field editor ──

export function NumberCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={160}>
      <div style={{ padding: '4px 8px' }}>
        <input
          ref={ref} type="number" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="0"
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Custom calendar for date picker ──
// We build our own calendar instead of using <input type="date"> because
// the browser's native date-picker popup lives outside the DOM tree,
// causing click-outside handlers to close the editor prematurely.

function MiniCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectedDay = value ? new Date(value + 'T00:00:00') : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px' }}>
        <button onClick={prevMonth} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted,
          padding: '2px 6px', borderRadius: 4, fontSize: '0.85rem',
        }}>‹</button>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text }}>{monthName}</span>
        <button onClick={nextMonth} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted,
          padding: '2px 6px', borderRadius: 4, fontSize: '0.85rem',
        }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 2 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <span key={d} style={{ fontSize: '0.6rem', color: C.textMuted, fontWeight: 600, padding: '2px 0' }}>{d}</span>
        ))}
      </div>
      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {days.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDay && selectedDay.getFullYear() === viewYear && selectedDay.getMonth() === viewMonth && selectedDay.getDate() === day;
          const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
          return (
            <button
              key={day}
              onClick={() => onChange(dateStr)}
              style={{
                width: '100%', aspectRatio: '1', border: 'none', cursor: 'pointer',
                borderRadius: '50%', fontSize: '0.68rem', fontWeight: isSelected ? 700 : 400,
                background: isSelected ? C.accent : 'transparent',
                color: isSelected ? '#000' : isToday ? C.accent : C.text,
                outline: isToday && !isSelected ? `1px solid ${C.accent}` : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Date field editor ──

export function DateCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const current = getFieldValue(taskId, fieldId);
  const [value, setValue] = useState(current);

  return (
    <CellPopover onClose={() => { setFieldValue(taskId, fieldId, value); onClose(); }} width={230}>
      <div style={{ padding: '6px 10px' }}>
        <MiniCalendar value={value} onChange={v => {
          setValue(v);
          setFieldValue(taskId, fieldId, v);
          onClose();
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
          {value && (
            <button onClick={() => { setValue(''); setFieldValue(taskId, fieldId, ''); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#ef4444', fontSize: '0.68rem',
              }}>
              <X size={11} /> Clear
            </button>
          )}
          <button onClick={() => {
            const t = new Date();
            const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
            setValue(todayStr);
            setFieldValue(taskId, fieldId, todayStr);
            onClose();
          }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.accent, fontSize: '0.68rem', fontWeight: 600,
            }}>
            Today
          </button>
        </div>
      </div>
    </CellPopover>
  );
}

// ── Checkbox field ──

export function CheckboxCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const current = getFieldValue(taskId, fieldId) === 'true';
  setFieldValue(taskId, fieldId, (!current).toString());
  onClose();
  return null;
}

// ── Dropdown field editor ──

const DEFAULT_OPTIONS = ['Option 1', 'Option 2', 'Option 3'];

export function DropdownCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const current = getFieldValue(taskId, fieldId);
  // Load custom options from localStorage
  const optionsKey = `sv-dropdown-options-${fieldId}`;
  const [options, setOptions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(optionsKey) || 'null') || DEFAULT_OPTIONS; }
    catch { return DEFAULT_OPTIONS; }
  });
  const [newOpt, setNewOpt] = useState('');

  const select = (opt: string) => {
    setFieldValue(taskId, fieldId, opt === current ? '' : opt);
    onClose();
  };

  const addOption = () => {
    if (!newOpt.trim() || options.includes(newOpt.trim())) return;
    const updated = [...options, newOpt.trim()];
    setOptions(updated);
    localStorage.setItem(optionsKey, JSON.stringify(updated));
    setFieldValue(taskId, fieldId, newOpt.trim());
    setNewOpt('');
    onClose();
  };

  return (
    <CellPopover onClose={onClose} width={180}>
      {options.map(opt => (
        <button key={opt} onClick={() => select(opt)} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 12px', border: 'none', cursor: 'pointer',
          background: opt === current ? 'rgba(255,214,0,0.08)' : 'transparent',
          color: opt === current ? C.accent : C.text,
          fontSize: '0.78rem', fontWeight: opt === current ? 600 : 400,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = opt === current ? 'rgba(255,214,0,0.08)' : 'transparent'; }}
        >
          {opt === current && <Check size={12} />}
          <span>{opt}</span>
        </button>
      ))}
      <div style={{ height: 1, background: C.border, margin: '4px 8px' }} />
      <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
        <input
          type="text" value={newOpt} onChange={e => setNewOpt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addOption(); }}
          placeholder="Add option..."
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 4, fontSize: '0.72rem',
            background: C.surface, border: `1px solid ${C.border}`, color: C.text,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Labels field editor ──

const DEFAULT_LABELS = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#22c55e' },
  { name: 'Enhancement', color: '#5A9AEF' },
  { name: 'Urgent', color: '#f97316' },
  { name: 'Design', color: '#D980FA' },
];

export function LabelsCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const current = getFieldValue(taskId, fieldId);
  const selected = current ? current.split(',') : [];

  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name];
    setFieldValue(taskId, fieldId, next.join(','));
  };

  return (
    <CellPopover onClose={onClose} width={180}>
      {DEFAULT_LABELS.map(label => {
        const active = selected.includes(label.name);
        return (
          <button key={label.name} onClick={() => toggle(label.name)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '6px 12px', border: 'none', cursor: 'pointer',
            background: 'transparent', color: C.text, fontSize: '0.78rem',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: 14, height: 14, borderRadius: 3,
              background: active ? label.color : 'transparent',
              border: `2px solid ${label.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <Check size={9} color="#fff" />}
            </div>
            <span>{label.name}</span>
          </button>
        );
      })}
    </CellPopover>
  );
}

// ── Email field editor ──

export function EmailCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={240}>
      <div style={{ padding: '4px 8px' }}>
        <input
          ref={ref} type="email" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="email@example.com"
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Rating field (stars) ──

export function RatingCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const current = parseInt(getFieldValue(taskId, fieldId) || '0');

  return (
    <CellPopover onClose={onClose} width={160}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => {
            setFieldValue(taskId, fieldId, (n === current ? 0 : n).toString());
            onClose();
          }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.2rem', padding: 2,
            color: n <= current ? '#eab308' : C.textMuted,
          }}>★</button>
        ))}
      </div>
    </CellPopover>
  );
}

// ── Money field ──

export function MoneyCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={160}>
      <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: C.textMuted, fontSize: '0.85rem', fontWeight: 600 }}>$</span>
        <input
          ref={ref} type="number" step="0.01" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="0.00"
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Percent field ──

export function PercentCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={140}>
      <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          ref={ref} type="number" min="0" max="100" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="0"
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <span style={{ color: C.textMuted, fontSize: '0.85rem', fontWeight: 600 }}>%</span>
      </div>
    </CellPopover>
  );
}

// ── Website field ──

export function WebsiteCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={260}>
      <div style={{ padding: '4px 8px' }}>
        <input
          ref={ref} type="url" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="https://example.com"
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Phone field ──

export function PhoneCellEditor({ taskId, fieldId, onClose }: {
  taskId: string; fieldId: string; onClose: () => void;
}) {
  const [value, setValue] = useState(getFieldValue(taskId, fieldId));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => { setFieldValue(taskId, fieldId, value); onClose(); };

  return (
    <CellPopover onClose={() => { save(); }} width={200}>
      <div style={{ padding: '4px 8px' }}>
        <input
          ref={ref} type="tel" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="+1 (555) 000-0000"
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </CellPopover>
  );
}

// ── Assignee Picker ──

export function AssigneePicker({ agents, currentAssigneeId, onSelect, onClose }: {
  agents: { id: string; name: string; avatar: string; initials: string }[];
  currentAssigneeId?: string;
  onSelect: (agentId: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CellPopover onClose={onClose} width={220}>
      <div style={{ padding: '4px 8px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 6,
          background: C.surface, border: `1px solid ${C.border}`,
        }}>
          <Search size={13} color={C.textMuted} />
          <input
            ref={ref} type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontSize: '0.76rem', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Unassign option */}
      {currentAssigneeId && (
        <button onClick={() => { onSelect(null); onClose(); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 12px', border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#ef4444', fontSize: '0.78rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={13} /> Unassign
        </button>
      )}

      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {filtered.map(agent => {
          const isActive = agent.id === currentAssigneeId;
          return (
            <button key={agent.id} onClick={() => { onSelect(agent.id); onClose(); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '6px 12px', border: 'none', cursor: 'pointer',
              background: isActive ? 'rgba(255,214,0,0.08)' : 'transparent',
              color: isActive ? C.accent : C.text, fontSize: '0.78rem',
              fontWeight: isActive ? 600 : 400,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(255,214,0,0.08)' : 'transparent'; }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: agent.avatar,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.45rem', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {agent.initials}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.name}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '12px', color: C.textMuted, fontSize: '0.75rem', textAlign: 'center' }}>
            No agents found
          </div>
        )}
      </div>
    </CellPopover>
  );
}

// ── Cell display value formatters ──

export function formatCellValue(fieldId: string, taskId: string): string {
  const val = getFieldValue(taskId, fieldId);
  if (!val) return '—';

  switch (fieldId) {
    case 'checkbox':
      return val === 'true' ? '✓' : '☐';
    case 'rating':
      return '★'.repeat(parseInt(val) || 0) + '☆'.repeat(5 - (parseInt(val) || 0));
    case 'money':
      return `$${parseFloat(val).toFixed(2)}`;
    case 'percent':
      return `${val}%`;
    case 'date':
    case 'time_tracking': {
      const d = new Date(val);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    default:
      return val.length > 20 ? val.slice(0, 18) + '…' : val;
  }
}

// ── Get the right editor for a field type ──

export function getCellEditor(fieldId: string): React.FC<{ taskId: string; fieldId: string; onClose: () => void }> | null {
  switch (fieldId) {
    case 'text':
    case 'textarea':
    case 'location':
    case 'formula':
    case 'files':
    case 'relationship':
    case 'time_tracking':
    case 'button':
    case 'voting':
    case 'progress':
      return TextCellEditor;
    case 'number':
      return NumberCellEditor;
    case 'date':
      return DateCellEditor;
    case 'checkbox':
      return CheckboxCellEditor;
    case 'dropdown':
      return DropdownCellEditor;
    case 'labels':
      return LabelsCellEditor;
    case 'email':
      return EmailCellEditor;
    case 'rating':
      return RatingCellEditor;
    case 'money':
      return MoneyCellEditor;
    case 'percent':
      return PercentCellEditor;
    case 'website':
      return WebsiteCellEditor;
    case 'phone':
      return PhoneCellEditor;
    case 'people':
      return TextCellEditor;
    default:
      return TextCellEditor;
  }
}
