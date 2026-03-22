import React from 'react';
import type { FieldDef, RowData } from './types';

// ---------------------------------------------------------------------------
// NocoDB-style Kanban View — columns grouped by a select field
// ---------------------------------------------------------------------------

interface KanbanProps {
  fields: FieldDef[];
  rows: RowData[];
  groupedRows: Record<string, RowData[]> | null;
  groupByFieldId: string | null;
  loading: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  onRowClick: (rowId: string | number) => void;
}

export function NcKanban({ fields, rows, groupedRows, groupByFieldId, loading, colors, isDark, tableColor, onRowClick }: KanbanProps) {
  const primaryField = fields.find(f => f.primary) || fields[0];
  const groupField = fields.find(f => f.id === groupByFieldId);
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const colBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: colors.textMuted }}>Loading…</div>
    );
  }

  // If no group by selected, show a message
  if (!groupByFieldId || !groupedRows) {
    // Auto-group by status if available
    const statusField = fields.find(f => f.id === 'status');
    if (!statusField) {
      return (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>▥</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
            Select a Group By field
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            Use the toolbar to pick a single-select field to group by
          </div>
        </div>
      );
    }

    // Build groups from status field manually
    const groups: Record<string, RowData[]> = {};
    for (const r of rows) {
      const key = String(r.status || '(empty)');
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    return (
      <KanbanColumns
        groups={groups}
        groupField={statusField}
        primaryField={primaryField}
        colors={colors}
        isDark={isDark}
        tableColor={tableColor}
        borderColor={borderColor}
        colBg={colBg}
        onRowClick={onRowClick}
      />
    );
  }

  return (
    <KanbanColumns
      groups={groupedRows}
      groupField={groupField || null}
      primaryField={primaryField}
      colors={colors}
      isDark={isDark}
      tableColor={tableColor}
      borderColor={borderColor}
      colBg={colBg}
      onRowClick={onRowClick}
    />
  );
}

function KanbanColumns({
  groups, groupField, primaryField, colors, isDark, tableColor, borderColor, colBg, onRowClick,
}: {
  groups: Record<string, RowData[]>;
  groupField: FieldDef | null;
  primaryField: FieldDef | undefined;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  borderColor: string;
  colBg: string;
  onRowClick: (rowId: string | number) => void;
}) {
  const entries = Object.entries(groups);

  if (entries.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>▥</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>No records</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      padding: 20,
      overflow: 'auto',
      flex: 1,
      alignItems: 'flex-start',
    }}>
      {entries.map(([groupKey, groupRows]) => {
        const opt = groupField?.options?.find(o => o.value === groupKey || o.label === groupKey);
        const headerColor = opt?.color || tableColor;

        return (
          <div key={groupKey} style={{
            minWidth: 280,
            maxWidth: 320,
            flex: '0 0 300px',
            background: colBg,
            borderRadius: 4,
            border: `1px solid ${borderColor}`,
            overflow: 'hidden',
          }}>
            {/* Column header */}
            <div style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${borderColor}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: headerColor,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.text,
                  textTransform: 'capitalize',
                }}>
                  {opt?.label || groupKey}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.textMuted,
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                padding: '2px 8px',
                borderRadius: 3,
              }}>
                {groupRows.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflow: 'auto' }}>
              {groupRows.map(row => {
                const title = String(row[primaryField?.id || 'title'] || row.name || row.id);
                return (
                  <div
                    key={row.id}
                    onClick={() => onRowClick(row.id)}
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderRadius: 3,
                      padding: '12px 14px',
                      border: `1px solid ${borderColor}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = headerColor;
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.01)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = borderColor;
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#fff';
                    }}
                  >
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.text,
                      lineHeight: 1.3,
                      marginBottom: 6,
                    }}>
                      {title}
                    </div>
                    {/* Metadata line */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {row.category && (
                        <span style={{
                          fontSize: 11,
                          padding: '1px 8px',
                          borderRadius: 3,
                          background: `${tableColor}18`,
                          color: tableColor,
                          fontWeight: 500,
                        }}>
                          {String(row.category)}
                        </span>
                      )}
                      {row.created_at && (
                        <span style={{ fontSize: 11, color: colors.textMuted }}>
                          {new Date(String(row.created_at)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
