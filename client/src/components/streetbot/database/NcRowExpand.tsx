import React, { useEffect, useRef, useState } from 'react';
import type { FieldDef, RowData } from './types';
import { NcCell } from './NcCellRenderer';
import { NcCellEditor } from './NcCellEditor';

// ---------------------------------------------------------------------------
// Row Expansion Panel — slide-out detail view with inline editing
// ---------------------------------------------------------------------------

interface RowExpandProps {
  row: RowData;
  fields: FieldDef[];
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  tableName: string;
  onClose: () => void;
  onCellEdit?: (rowId: string | number, fieldId: string, value: unknown) => void;
  onDuplicate?: (rowId: string | number) => void;
  onDelete?: (rowIds: (string | number)[]) => void;
}

export function NcRowExpand({
  row, fields, colors, isDark, tableColor, tableName, onClose,
  onCellEdit, onDuplicate, onDelete,
}: RowExpandProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryField = fields.find(f => f.primary) || fields[0];
  const primaryVal = String(row[primaryField?.id || 'title'] || row.name || row.id);
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const [editingField, setEditingField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'json'>('fields');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 999,
        backdropFilter: 'blur(4px)',
      }} />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          maxWidth: '90vw',
          background: isDark ? 'rgba(22,22,30,0.98)' : 'rgba(255,255,255,0.98)',
          borderLeft: `1px solid ${borderColor}`,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s ease',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: tableColor, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: tableColor }} />
              {tableName} Record
            </div>
            <h2 style={{
              margin: 0, fontSize: 18, fontWeight: 600,
              color: colors.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', lineHeight: 1.3,
            }}>
              {primaryVal}
            </h2>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {onDuplicate && (
              <button
                onClick={() => { onDuplicate(row.id); onClose(); }}
                title="Duplicate record"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  border: 'none', borderRadius: 3, width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: colors.textMuted, fontSize: 14,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              >
                ⎘
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { onDelete([row.id]); onClose(); }}
                title="Delete record"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  border: 'none', borderRadius: 3, width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#ef4444', fontSize: 14,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              >
                🗑
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                border: 'none', borderRadius: 3, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: colors.textMuted, fontSize: 16, fontWeight: 600,
                flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${borderColor}`,
          padding: '0 24px',
        }}>
          {(['fields', 'json'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                color: activeTab === tab ? colors.text : colors.textMuted,
                borderBottom: activeTab === tab ? `2px solid ${tableColor}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'fields' ? 'Fields' : 'JSON'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {activeTab === 'fields' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {fields.map(f => {
                const hasValue = row[f.id] != null && row[f.id] !== '';
                const isEditing = editingField === f.id;

                return (
                  <div key={f.id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '12px 0',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}`,
                    gap: 16,
                  }}>
                    {/* Field name */}
                    <div style={{
                      width: 140, minWidth: 140,
                      fontSize: 13, fontWeight: 600,
                      color: colors.textSecondary, paddingTop: 2,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 10, color: colors.textMuted }}>
                        {getFieldIcon(f.type)}
                      </span>
                      {f.title}
                    </div>

                    {/* Field value */}
                    <div
                      style={{
                        flex: 1, minWidth: 0, paddingTop: 1,
                        cursor: onCellEdit ? 'pointer' : 'default',
                        borderRadius: 6,
                        padding: isEditing ? 0 : '2px 4px',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => {
                        if (onCellEdit && !isEditing) setEditingField(f.id);
                      }}
                      onMouseEnter={e => {
                        if (onCellEdit && !isEditing) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                      }}
                      onMouseLeave={e => {
                        if (!isEditing) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {isEditing ? (
                        <NcCellEditor
                          field={f}
                          row={row}
                          value={row[f.id]}
                          onSave={(val) => {
                            onCellEdit?.(row.id, f.id, val);
                            setEditingField(null);
                          }}
                          onCancel={() => setEditingField(null)}
                          colors={colors}
                          isDark={isDark}
                          tableColor={tableColor}
                        />
                      ) : hasValue ? (
                        f.type === 'longText' ? (
                          <div style={{
                            color: colors.text, fontSize: 14,
                            lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}>
                            {String(row[f.id])}
                          </div>
                        ) : (
                          <NcCell field={f} row={row} colors={colors} />
                        )
                      ) : (
                        <span style={{ color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>
                          {onCellEdit ? 'Click to edit' : 'Empty'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Extra fields from API */}
              {(() => {
                const knownFields = new Set(fields.map(f => f.id));
                const extraKeys = Object.keys(row).filter(k => !knownFields.has(k) && k !== 'id');
                if (extraKeys.length === 0) return null;

                return (
                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: colors.textMuted,
                      marginBottom: 8,
                    }}>
                      Additional Fields ({extraKeys.length})
                    </div>
                    {extraKeys.map(k => {
                      const val = row[k];
                      if (val == null || val === '') return null;
                      return (
                        <div key={k} style={{
                          display: 'flex', alignItems: 'flex-start',
                          padding: '8px 0',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}`,
                          gap: 16,
                        }}>
                          <div style={{
                            width: 140, minWidth: 140,
                            fontSize: 13, fontWeight: 600, color: colors.textMuted,
                          }}>
                            {k}
                          </div>
                          <div style={{
                            flex: 1, fontSize: 13, color: colors.textSecondary,
                            wordBreak: 'break-word',
                          }}>
                            {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* JSON tab */
            <pre style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              padding: 16, borderRadius: 4,
              fontSize: 12, color: colors.textSecondary,
              overflow: 'auto', fontFamily: 'SF Mono, Consolas, monospace',
              lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(row, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: `1px solid ${borderColor}`,
          fontSize: 12, color: colors.textMuted,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>ID: {String(row.id)}</span>
          <span>Press Esc to close · Click fields to edit</span>
        </div>
      </div>
    </>
  );
}

function getFieldIcon(type: string): string {
  switch (type) {
    case 'text': return 'Aa';
    case 'longText': return '¶';
    case 'number': return '#';
    case 'date': return '📅';
    case 'email': return '✉';
    case 'url': return '🔗';
    case 'phone': return '☎';
    case 'singleSelect': return '◉';
    case 'multiSelect': return '◎';
    case 'checkbox': return '☑';
    case 'currency': return '$';
    case 'rating': return '★';
    case 'percent': return '%';
    case 'duration': return '⏱';
    default: return '·';
  }
}
