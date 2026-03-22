import React, { useState, useRef, useEffect } from 'react';
import type { FieldDef, RowData } from './types';

// ---------------------------------------------------------------------------
// Inline Cell Editor — type-aware editors for each field type
// ---------------------------------------------------------------------------

interface CellEditorProps {
  field: FieldDef;
  row: RowData;
  value: unknown;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
}

export function NcCellEditor({ field, row, value, onSave, onCancel, colors, isDark, tableColor }: CellEditorProps) {
  const [editVal, setEditVal] = useState<string>(value == null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    // Auto-focus and select on mount
    const el = inputRef.current;
    if (el) {
      el.focus();
      if ('select' in el && el instanceof HTMLInputElement) el.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onCancel(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitValue();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitValue();
    }
  };

  const commitValue = () => {
    // Convert back to appropriate type
    let final: unknown = editVal;
    if (field.type === 'number' || field.type === 'currency' || field.type === 'percent' || field.type === 'rating') {
      const n = parseFloat(editVal);
      final = isNaN(n) ? editVal : n;
    } else if (field.type === 'checkbox') {
      final = editVal === 'true';
    }
    onSave(final);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
    border: `2px solid ${tableColor}`,
    borderRadius: 3,
    color: colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  };

  switch (field.type) {
    case 'longText':
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
        />
      );

    case 'singleSelect':
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editVal}
          onChange={e => { setEditVal(e.target.value); onSave(e.target.value); }}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          style={inputStyle}
        >
          <option value="">-- Select --</option>
          {field.options?.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );

    case 'checkbox':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <button
            onClick={() => { const next = editVal !== 'true'; onSave(next); }}
            style={{
              width: 24, height: 24,
              borderRadius: 3,
              border: `2px solid ${editVal === 'true' ? tableColor : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)')}`,
              background: editVal === 'true' ? tableColor : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              transition: 'all 0.15s',
            }}
          >
            {editVal === 'true' ? '✓' : ''}
          </button>
        </div>
      );

    case 'date':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={editVal ? editVal.split('T')[0] : ''}
          onChange={e => { setEditVal(e.target.value); }}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          style={inputStyle}
        />
      );

    case 'rating': {
      const n = Math.min(5, Math.max(0, parseInt(editVal) || 0));
      return (
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onClick={() => { onSave(i === n ? 0 : i); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: i <= n ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                padding: '0 2px',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              ★
            </button>
          ))}
        </div>
      );
    }

    case 'number':
    case 'currency':
    case 'percent':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          style={inputStyle}
          step="any"
        />
      );

    case 'email':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="email"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          style={inputStyle}
        />
      );

    case 'url':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="url"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          style={inputStyle}
          placeholder="https://"
        />
      );

    default:
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          style={inputStyle}
        />
      );
  }
}
