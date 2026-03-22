import React from 'react';
import type { FieldDef, RowData } from './types';

// ---------------------------------------------------------------------------
// NocoDB-style cell renderer — read-only display with search highlighting
// ---------------------------------------------------------------------------

interface CellProps {
  field: FieldDef;
  row: RowData;
  colors: Record<string, string>;
  highlightText?: (text: string) => React.ReactNode;
}

export function NcCell({ field, row, colors, highlightText }: CellProps) {
  const raw = row[field.id];
  const hl = highlightText || ((t: string) => t);

  if (raw == null || raw === '') {
    return <span style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>—</span>;
  }

  // Handle arrays displayed as text (e.g., category_names)
  if (Array.isArray(raw) && field.type === 'text') {
    const joined = raw.join(', ');
    return (
      <span style={{ color: colors.textSecondary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {hl(joined)}
      </span>
    );
  }

  // Handle plain objects — skip rendering (e.g., contact_structured)
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return <span style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>—</span>;
  }

  const val = String(raw);

  switch (field.type) {
    case 'singleSelect': {
      const opt = field.options?.find(o => o.value === val || o.label === val);
      const bg = opt?.color || '#6b7280';
      return (
        <span style={{
          display: 'inline-block',
          padding: '1px 8px',
          borderRadius: 3,
          fontSize: 12,
          fontWeight: 500,
          background: `${bg}18`,
          color: bg,
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {opt?.label || val}
        </span>
      );
    }

    case 'multiSelect': {
      const values = Array.isArray(raw) ? raw : val.split(',').map(s => s.trim());
      return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {values.map((v: string, i: number) => {
            const opt = field.options?.find(o => o.value === v || o.label === v);
            const bg = opt?.color || '#6b7280';
            return (
              <span key={i} style={{
                padding: '1px 6px',
                borderRadius: 3,
                fontSize: 11,
                fontWeight: 500,
                background: `${bg}18`,
                color: bg,
              }}>
                {opt?.label || v}
              </span>
            );
          })}
        </div>
      );
    }

    case 'date': {
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return <span style={{ color: colors.text, fontSize: 13 }}>{hl(val)}</span>;
        const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <span style={{ color: colors.textSecondary, fontSize: 13, whiteSpace: 'nowrap' }}>
            {hl(formatted)}
          </span>
        );
      } catch {
        return <span style={{ color: colors.text, fontSize: 13 }}>{hl(val)}</span>;
      }
    }

    case 'url': {
      return (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: '#3b82f6',
            fontSize: 13,
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {hl(val.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}
        </a>
      );
    }

    case 'email': {
      return (
        <a
          href={`mailto:${val}`}
          onClick={e => e.stopPropagation()}
          style={{ color: '#3b82f6', fontSize: 13, textDecoration: 'none' }}
        >
          {hl(val)}
        </a>
      );
    }

    case 'phone': {
      return (
        <span style={{ color: colors.text, fontSize: 13, whiteSpace: 'nowrap' }}>{hl(val)}</span>
      );
    }

    case 'currency': {
      const num = parseFloat(val);
      if (isNaN(num)) return <span style={{ color: colors.text, fontSize: 13 }}>{hl(val)}</span>;
      return (
        <span style={{ color: colors.text, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </span>
      );
    }

    case 'number': {
      return (
        <span style={{ color: colors.text, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {Number(val).toLocaleString()}
        </span>
      );
    }

    case 'percent': {
      const pct = parseFloat(val);
      if (isNaN(pct)) return <span style={{ color: colors.text, fontSize: 13 }}>{val}</span>;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <div style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: 'rgba(128,128,128,0.15)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, pct))}%`,
              height: '100%',
              borderRadius: 3,
              background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: colors.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>
            {pct}%
          </span>
        </div>
      );
    }

    case 'checkbox': {
      const checked = val === 'true' || val === '1';
      return (
        <span style={{
          fontSize: 16,
          width: 20,
          height: 20,
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: checked ? '#10b981' : 'transparent',
          border: checked ? 'none' : '2px solid rgba(128,128,128,0.3)',
          color: '#fff',
          fontWeight: 700,
        }}>
          {checked ? '✓' : ''}
        </span>
      );
    }

    case 'rating': {
      const n = Math.min(5, Math.max(0, parseInt(val) || 0));
      return (
        <span style={{ fontSize: 14, letterSpacing: 2 }}>
          {'★'.repeat(n)}
          <span style={{ opacity: 0.2 }}>{'★'.repeat(5 - n)}</span>
        </span>
      );
    }

    case 'longText': {
      return (
        <span style={{
          color: colors.text,
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}>
          {hl(val.slice(0, 80))}{val.length > 80 ? '…' : ''}
        </span>
      );
    }

    case 'image': {
      if (!val) return <span style={{ color: colors.textMuted, fontSize: 11 }}>—</span>;
      return (
        <img
          src={String(val)}
          alt=""
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            objectFit: 'cover',
            display: 'block',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }

    case 'attachment': {
      if (!val) return <span style={{ color: colors.textMuted, fontSize: 11 }}>—</span>;
      const urls = Array.isArray(val) ? val : [val];
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {urls.slice(0, 3).map((u, i) => (
            <img
              key={i}
              src={String(u)}
              alt=""
              style={{
                width: 28,
                height: 28,
                borderRadius: 3,
                objectFit: 'cover',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
          {urls.length > 3 && (
            <span style={{ color: colors.textMuted, fontSize: 11, alignSelf: 'center' }}>
              +{urls.length - 3}
            </span>
          )}
        </div>
      );
    }

    default: {
      return (
        <span style={{
          color: field.primary ? colors.text : colors.textSecondary,
          fontSize: 13,
          fontWeight: field.primary ? 600 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}>
          {hl(val)}
        </span>
      );
    }
  }
}
