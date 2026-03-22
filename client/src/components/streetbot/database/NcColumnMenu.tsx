import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { FieldDef, RowData, AggType } from './types';

// ---------------------------------------------------------------------------
// Column Header Context Menu — sort, hide, freeze, stats
// ---------------------------------------------------------------------------

interface ColumnMenuProps {
  field: FieldDef;
  rows: RowData[];
  position: { x: number; y: number };
  onClose: () => void;
  onSort: (fieldId: string, dir: 'asc' | 'desc') => void;
  onHide: (fieldId: string) => void;
  onFreeze: (fieldId: string) => void;
  frozenFieldIds: Set<string>;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
}

export function NcColumnMenu({
  field, rows, position, onClose, onSort, onHide, onFreeze, frozenFieldIds,
  colors, isDark, tableColor,
}: ColumnMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handle); };
  }, [onClose]);

  // Compute stats
  const stats = useMemo(() => {
    const values = rows.map(r => r[field.id]);
    const filled = values.filter(v => v != null && v !== '');
    const empty = values.length - filled.length;
    const uniqueSet = new Set(filled.map(v => String(v)));

    const result: { label: string; value: string }[] = [
      { label: 'Total records', value: String(values.length) },
      { label: 'Filled', value: `${filled.length} (${values.length > 0 ? Math.round(filled.length / values.length * 100) : 0}%)` },
      { label: 'Empty', value: `${empty} (${values.length > 0 ? Math.round(empty / values.length * 100) : 0}%)` },
      { label: 'Unique', value: String(uniqueSet.size) },
    ];

    // Numeric stats
    if (['number', 'currency', 'rating', 'percent'].includes(field.type)) {
      const nums = filled.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0);
        result.push({ label: 'Sum', value: sum.toLocaleString() });
        result.push({ label: 'Average', value: (sum / nums.length).toFixed(2) });
        result.push({ label: 'Min', value: Math.min(...nums).toLocaleString() });
        result.push({ label: 'Max', value: Math.max(...nums).toLocaleString() });
        const median = [...nums].sort((a, b) => a - b);
        const mid = Math.floor(median.length / 2);
        result.push({ label: 'Median', value: (median.length % 2 ? median[mid] : (median[mid - 1] + median[mid]) / 2).toLocaleString() });
      }
    }

    // Select field distribution
    if (field.type === 'singleSelect' && field.options) {
      const dist: Record<string, number> = {};
      filled.forEach(v => { const k = String(v); dist[k] = (dist[k] || 0) + 1; });
      field.options.forEach(o => {
        const count = dist[o.value] || 0;
        result.push({ label: o.label, value: `${count} (${values.length > 0 ? Math.round(count / values.length * 100) : 0}%)` });
      });
    }

    return result;
  }, [field, rows]);

  const menuBg = isDark ? 'rgba(28,28,38,0.98)' : 'rgba(255,255,255,0.98)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const isFrozen = frozenFieldIds.has(field.id);

  const menuItem = (icon: string, label: string, onClick: () => void, danger = false) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 14px',
        border: 'none',
        background: 'transparent',
        color: danger ? '#ef4444' : colors.text,
        fontSize: 13,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: 3,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = hoverBg}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 14, width: 20, textAlign: 'center', opacity: 0.7 }}>{icon}</span>
      {label}
    </button>
  );

  const separator = () => (
    <div style={{
      height: 1,
      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      margin: '4px 8px',
    }} />
  );

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y, window.innerHeight - 300),
        background: menuBg,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 4,
        padding: 6,
        minWidth: 220,
        zIndex: 200,
        boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Field info header */}
      <div style={{
        padding: '8px 14px',
        fontSize: 11,
        fontWeight: 700,
        color: tableColor,
        /* no transform */
        /* clean label */
      }}>
        {field.title}
      </div>

      {menuItem('↑', 'Sort ascending', () => { onSort(field.id, 'asc'); onClose(); })}
      {menuItem('↓', 'Sort descending', () => { onSort(field.id, 'desc'); onClose(); })}
      {separator()}
      {menuItem(isFrozen ? '⊞' : '❄', isFrozen ? 'Unfreeze column' : 'Freeze column', () => { onFreeze(field.id); onClose(); })}
      {!field.primary && menuItem('👁', 'Hide column', () => { onHide(field.id); onClose(); })}
      {separator()}
      {menuItem('📊', showStats ? 'Hide statistics' : 'Show statistics', () => setShowStats(!showStats))}

      {/* Stats panel */}
      {showStats && (
        <div style={{
          padding: '8px 14px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          marginTop: 4,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
              fontSize: 12,
            }}>
              <span style={{ color: colors.textMuted }}>{s.label}</span>
              <span style={{ color: colors.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aggregation Row — sticky footer with per-column aggregations
// ---------------------------------------------------------------------------

interface AggRowProps {
  fields: FieldDef[];
  rows: RowData[];
  aggTypes: Record<string, AggType>;
  setAggType: (fieldId: string, agg: AggType) => void;
  getWidth: (f: FieldDef) => number;
  rowNumWidth: number;
  expandWidth: number;
  checkboxWidth: number;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  borderColor: string;
}

export function NcAggRow({
  fields, rows, aggTypes, setAggType, getWidth,
  rowNumWidth, expandWidth, checkboxWidth,
  colors, isDark, tableColor, borderColor,
}: AggRowProps) {
  const [openAgg, setOpenAgg] = useState<string | null>(null);

  const computeAgg = (fieldId: string, aggType: AggType): string => {
    if (aggType === 'none') return '';
    const values = rows.map(r => r[fieldId]);
    const filled = values.filter(v => v != null && v !== '');
    const empty = values.length - filled.length;
    const uniqueSet = new Set(filled.map(v => String(v)));

    switch (aggType) {
      case 'count': return String(values.length);
      case 'countEmpty': return String(empty);
      case 'countFilled': return String(filled.length);
      case 'countUnique': return String(uniqueSet.size);
      case 'percentEmpty': return values.length > 0 ? `${Math.round(empty / values.length * 100)}%` : '0%';
      case 'percentFilled': return values.length > 0 ? `${Math.round(filled.length / values.length * 100)}%` : '0%';
      case 'sum': case 'avg': case 'min': case 'max': {
        const nums = filled.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
        if (nums.length === 0) return '—';
        if (aggType === 'sum') return nums.reduce((a, b) => a + b, 0).toLocaleString();
        if (aggType === 'avg') return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
        if (aggType === 'min') return Math.min(...nums).toLocaleString();
        if (aggType === 'max') return Math.max(...nums).toLocaleString();
      }
      default: return '';
    }
  };

  const isNumeric = (type: string) => ['number', 'currency', 'rating', 'percent', 'duration'].includes(type);

  const aggOptions: { value: AggType; label: string; numericOnly?: boolean }[] = [
    { value: 'none', label: 'None' },
    { value: 'count', label: 'Count all' },
    { value: 'countFilled', label: 'Count filled' },
    { value: 'countEmpty', label: 'Count empty' },
    { value: 'countUnique', label: 'Count unique' },
    { value: 'percentFilled', label: '% Filled' },
    { value: 'percentEmpty', label: '% Empty' },
    { value: 'sum', label: 'Sum', numericOnly: true },
    { value: 'avg', label: 'Average', numericOnly: true },
    { value: 'min', label: 'Min', numericOnly: true },
    { value: 'max', label: 'Max', numericOnly: true },
  ];

  const headerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  return (
    <div style={{
      display: 'flex',
      borderTop: `2px solid ${borderColor}`,
      background: headerBg,
      position: 'sticky',
      bottom: 0,
      zIndex: 10,
    }}>
      {/* Row number + checkbox + expand spacers */}
      <div style={{
        width: checkboxWidth + rowNumWidth + expandWidth,
        minWidth: checkboxWidth + rowNumWidth + expandWidth,
        padding: '6px 8px',
        fontSize: 11,
        fontWeight: 700,
        color: colors.textMuted,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        left: 0,
        background: headerBg,
        zIndex: 11,
      }}>
        Σ
      </div>

      {/* Per-column aggregation cells */}
      {fields.map(f => {
        const agg = aggTypes[f.id] || 'none';
        const result = computeAgg(f.id, agg);
        const isOpen = openAgg === f.id;

        return (
          <div
            key={f.id}
            style={{
              width: getWidth(f),
              minWidth: getWidth(f),
              padding: '6px 8px',
              borderRight: `1px solid ${borderColor}`,
              position: 'relative',
              cursor: 'pointer',
            }}
            onClick={() => setOpenAgg(isOpen ? null : f.id)}
          >
            {agg === 'none' ? (
              <span style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
                —
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>
                  {agg === 'countFilled' ? 'Filled' :
                   agg === 'countEmpty' ? 'Empty' :
                   agg === 'countUnique' ? 'Unique' :
                   agg === 'percentFilled' ? '% Filled' :
                   agg === 'percentEmpty' ? '% Empty' :
                   agg.charAt(0).toUpperCase() + agg.slice(1)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: tableColor, fontVariantNumeric: 'tabular-nums' }}>
                  {result}
                </span>
              </div>
            )}

            {/* Agg type selector dropdown */}
            {isOpen && (
              <AggDropdown
                options={aggOptions.filter(o => !o.numericOnly || isNumeric(f.type))}
                selected={agg}
                onSelect={(a) => { setAggType(f.id, a); setOpenAgg(null); }}
                onClose={() => setOpenAgg(null)}
                isDark={isDark}
                colors={colors}
                tableColor={tableColor}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AggDropdown({ options, selected, onSelect, onClose, isDark, colors, tableColor }: {
  options: { value: AggType; label: string }[];
  selected: AggType;
  onSelect: (a: AggType) => void;
  onClose: () => void;
  isDark: boolean;
  colors: Record<string, string>;
  tableColor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handle); };
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      marginBottom: 4,
      background: isDark ? 'rgba(28,28,38,0.98)' : 'rgba(255,255,255,0.98)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 4,
      padding: 4,
      minWidth: 160,
      zIndex: 200,
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, padding: '4px 10px', textTransform: 'uppercase' }}>
        Summarize
      </div>
      {options.map(o => (
        <button
          key={o.value}
          onClick={(e) => { e.stopPropagation(); onSelect(o.value); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            border: 'none',
            background: selected === o.value ? `${tableColor}15` : 'transparent',
            color: selected === o.value ? tableColor : colors.text,
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontWeight: selected === o.value ? 700 : 400,
            cursor: 'pointer',
            textAlign: 'left',
            borderRadius: 3,
          }}
        >
          {selected === o.value && <span style={{ fontSize: 10 }}>✓</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}
