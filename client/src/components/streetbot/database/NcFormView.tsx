import React, { useState } from 'react';
import type { FieldDef } from './types';

// ---------------------------------------------------------------------------
// NocoDB-style Form View — for record creation (read-only submit disabled
// since the API may not support POST on all endpoints)
// ---------------------------------------------------------------------------

interface FormViewProps {
  fields: FieldDef[];
  tableName: string;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
}

export function NcFormView({ fields, tableName, colors, isDark, tableColor }: FormViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  const set = (id: string, val: string) => setValues(prev => ({ ...prev, [id]: val }));

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 600,
      }}>
        {/* Form header */}
        <div style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
          border: `1px solid ${borderColor}`,
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <div style={{
            height: 6,
            background: `linear-gradient(90deg, ${tableColor}, ${tableColor}60)`,
          }} />
          <div style={{ padding: '28px 32px' }}>
            <h2 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: colors.text,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}>
              New {tableName} Record
            </h2>
            <p style={{
              margin: '8px 0 0',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              Fill in the fields below to create a new record
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
          border: `1px solid ${borderColor}`,
          borderRadius: 6,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          {fields.filter(f => f.type !== 'date' || !f.id.includes('created')).map(f => (
            <div key={f.id}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 700,
                color: colors.text,
                marginBottom: 8,
                /* no transform */
                /* clean label */
              }}>
                {f.title}
                {f.primary && <span style={{ color: tableColor, marginLeft: 4 }}>*</span>}
              </label>

              {f.type === 'longText' ? (
                <textarea
                  value={values[f.id] || ''}
                  onChange={e => set(f.id, e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 3,
                    border: `1px solid ${borderColor}`,
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                    color: colors.text,
                    fontSize: 14,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = tableColor}
                  onBlur={e => e.currentTarget.style.borderColor = borderColor}
                />
              ) : f.type === 'singleSelect' ? (
                <select
                  value={values[f.id] || ''}
                  onChange={e => set(f.id, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 3,
                    border: `1px solid ${borderColor}`,
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                    color: colors.text,
                    fontSize: 14,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Select…</option>
                  {f.options?.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'checkbox' ? (
                <div
                  onClick={() => set(f.id, values[f.id] === 'true' ? 'false' : 'true')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    padding: '6px 0',
                  }}
                >
                  <div style={{
                    width: 22, height: 22,
                    borderRadius: 6,
                    border: `2px solid ${values[f.id] === 'true' ? tableColor : borderColor}`,
                    background: values[f.id] === 'true' ? tableColor : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    {values[f.id] === 'true' ? '✓' : ''}
                  </div>
                  <span style={{ fontSize: 14, color: colors.textSecondary }}>
                    {values[f.id] === 'true' ? 'Yes' : 'No'}
                  </span>
                </div>
              ) : (
                <input
                  type={f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'number' || f.type === 'currency' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={values[f.id] || ''}
                  onChange={e => set(f.id, e.target.value)}
                  placeholder={`Enter ${f.title.toLowerCase()}…`}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 3,
                    border: `1px solid ${borderColor}`,
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                    color: colors.text,
                    fontSize: 14,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = tableColor}
                  onBlur={e => e.currentTarget.style.borderColor = borderColor}
                />
              )}
            </div>
          ))}

          {/* Submit button (disabled — API may not support POST) */}
          <div style={{ paddingTop: 8 }}>
            <button
              type="button"
              disabled
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: 3,
                border: 'none',
                background: `${tableColor}40`,
                color: tableColor,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                cursor: 'not-allowed',
                opacity: 0.6,
              }}
            >
              Submit (Read-Only Mode)
            </button>
            <p style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 10 }}>
              Record creation via form is coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
