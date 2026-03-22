import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { FieldDef, FieldType, RowData, CellEdit, AggType } from './types';
import { NcCell } from './NcCellRenderer';
import { NcCellEditor } from './NcCellEditor';
import { NcColumnMenu, NcAggRow } from './NcColumnMenu';
import type { RowHeight } from './NcToolbar';

// ---------------------------------------------------------------------------
// NocoDB-style Grid View — full Airtable feature set
// Inline editing, row selection, column menus, aggregation, keyboard nav,
// search highlighting, frozen columns, add row
// ---------------------------------------------------------------------------

const ROW_PADDING: Record<RowHeight, number> = { short: 6, medium: 10, tall: 18 };

interface GridProps {
  fields: FieldDef[];
  rows: RowData[];
  loading: boolean;
  totalCount: number;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  rowHeight: RowHeight;
  search: string;
  onRowClick: (rowId: string | number) => void;
  // Editing
  onCellEdit?: (rowId: string | number, fieldId: string, value: unknown) => void;
  // Selection
  selectedRowIds: Set<string | number>;
  onToggleRowSelection: (rowId: string | number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  // Column actions
  onSort?: (fieldId: string, dir: 'asc' | 'desc') => void;
  onHideField?: (fieldId: string) => void;
  // Row operations
  onAddRow?: () => void;
  onDuplicateRow?: (rowId: string | number) => void;
  onDeleteRows?: (rowIds: (string | number)[]) => void;
  onAddField?: (field: FieldDef) => void;
}

const ADD_FIELD_WIDTH = 120;

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Single line text', icon: 'Aa' },
  { value: 'longText', label: 'Long text', icon: '¶' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'email', label: 'Email', icon: '✉' },
  { value: 'url', label: 'URL', icon: '🔗' },
  { value: 'phone', label: 'Phone', icon: '☎' },
  { value: 'singleSelect', label: 'Single select', icon: '◉' },
  { value: 'multiSelect', label: 'Multi select', icon: '◎' },
  { value: 'checkbox', label: 'Checkbox', icon: '☑' },
  { value: 'currency', label: 'Currency', icon: '$' },
  { value: 'rating', label: 'Rating', icon: '★' },
  { value: 'percent', label: 'Percent', icon: '%' },
  { value: 'duration', label: 'Duration', icon: '⏱' },
  { value: 'image', label: 'Image', icon: '🖼' },
  { value: 'attachment', label: 'Attachment', icon: '📎' },
];

export function NcGrid({
  fields, rows, loading, totalCount, colors, isDark, tableColor, rowHeight, search,
  onRowClick, onCellEdit, selectedRowIds, onToggleRowSelection, onSelectAll, onClearSelection,
  onSort, onHideField, onAddRow, onDuplicateRow, onDeleteRows, onAddField,
}: GridProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<CellEdit | null>(null);
  const [contextMenu, setContextMenu] = useState<{ field: FieldDef; x: number; y: number } | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [frozenFieldIds, setFrozenFieldIds] = useState<Set<string>>(new Set());
  const [aggTypes, setAggTypes] = useState<Record<string, AggType>>({});
  const [resizing, setResizing] = useState<string | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const gridRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startW = useRef(0);

  // Reset widths when fields change
  const fieldsKey = fields.map(f => f.id).join(',');
  useEffect(() => {
    setColumnWidths({});
    setEditingCell(null);
    setContextMenu(null);
    setActiveCell(null);
  }, [fieldsKey]);

  const getWidth = useCallback((f: FieldDef) => columnWidths[f.id] || f.width, [columnWidths]);

  const handleResizeStart = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(fieldId);
    startX.current = e.clientX;
    startW.current = columnWidths[fieldId] || fields.find(f => f.id === fieldId)?.width || 150;

    const handleMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      setColumnWidths(prev => ({ ...prev, [fieldId]: Math.max(60, startW.current + diff) }));
    };
    const handleUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [columnWidths, fields]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (editingCell) return; // let editor handle keys
      if (!activeCell) return;

      const { row, col } = activeCell;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (row < rows.length - 1) setActiveCell({ row: row + 1, col });
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) setActiveCell({ row: row - 1, col });
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (col < fields.length - 1) setActiveCell({ row, col: col + 1 });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (col > 0) setActiveCell({ row, col: col - 1 });
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            if (col > 0) setActiveCell({ row, col: col - 1 });
            else if (row > 0) setActiveCell({ row: row - 1, col: fields.length - 1 });
          } else {
            if (col < fields.length - 1) setActiveCell({ row, col: col + 1 });
            else if (row < rows.length - 1) setActiveCell({ row: row + 1, col: 0 });
          }
          break;
        case 'Enter':
          e.preventDefault();
          // Start editing
          if (rows[row] && fields[col]) {
            setEditingCell({ rowId: rows[row].id, fieldId: fields[col].id });
          }
          break;
        case 'Escape':
          setActiveCell(null);
          break;
        case ' ':
          e.preventDefault();
          // Toggle row selection
          if (rows[row]) onToggleRowSelection(rows[row].id);
          break;
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeCell, editingCell, rows, fields, onToggleRowSelection]);

  // Search highlighting helper
  const highlightText = useCallback((text: string) => {
    if (!search.trim()) return text;
    const q = search.trim();
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;

    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} style={{
              background: `${tableColor}40`,
              color: 'inherit',
              borderRadius: 2,
              padding: '0 1px',
            }}>
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </>
    );
  }, [search, tableColor]);

  const checkboxWidth = 36;
  const rowNumWidth = 48;
  const expandWidth = 32;
  const totalWidth = checkboxWidth + rowNumWidth + expandWidth + fields.reduce((s, f) => s + getWidth(f), 0) + (onAddField ? ADD_FIELD_WIDTH : 0);

  const headerBg = isDark ? '#22222e' : '#f5f5f5';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5';
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : '#f8f8f8';
  const selectedBg = isDark ? 'rgba(45,127,249,0.1)' : 'rgba(45,127,249,0.06)';
  const activeCellBorder = '#2d7ff9';

  const allSelected = rows.length > 0 && selectedRowIds.size === rows.length;
  const someSelected = selectedRowIds.size > 0 && selectedRowIds.size < rows.length;

  return (
    <div ref={gridRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <div style={{ minWidth: totalWidth }}>
        {/* Bulk action bar */}
        {selectedRowIds.size > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            background: `${tableColor}15`,
            borderBottom: `1px solid ${tableColor}30`,
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2d7ff9' }}>
              {selectedRowIds.size} selected
            </span>
            <button
              onClick={onClearSelection}
              style={{
                padding: '3px 8px', borderRadius: 3, border: '1px solid #2d7ff940',
                background: 'transparent', color: '#2d7ff9', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Deselect
            </button>
            {onDuplicateRow && selectedRowIds.size === 1 && (
              <button
                onClick={() => onDuplicateRow([...selectedRowIds][0])}
                style={{
                  padding: '3px 8px', borderRadius: 3, border: '1px solid #2d7ff940',
                  background: 'transparent', color: '#2d7ff9', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Duplicate
              </button>
            )}
            {onDeleteRows && (
              <button
                onClick={() => onDeleteRows([...selectedRowIds])}
                style={{
                  padding: '3px 8px', borderRadius: 3, border: '1px solid #ef444440',
                  background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex',
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          position: 'sticky',
          top: selectedRowIds.size > 0 ? 40 : 0,
          zIndex: 10,
        }}>
          {/* Checkbox header */}
          <div style={{
            width: checkboxWidth,
            minWidth: checkboxWidth,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: `1px solid ${borderColor}`,
            position: 'sticky',
            left: 0,
            background: headerBg,
            zIndex: 11,
          }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected; }}
              onChange={() => allSelected ? onClearSelection() : onSelectAll()}
              style={{ cursor: 'pointer', accentColor: tableColor }}
            />
          </div>

          {/* Row number */}
          <div style={{
            width: rowNumWidth,
            minWidth: rowNumWidth,
            padding: '8px 4px',
            fontSize: 11,
            fontWeight: 700,
            color: colors.textMuted,
            borderRight: `1px solid ${borderColor}`,
            textAlign: 'center',
            position: 'sticky',
            left: checkboxWidth,
            background: headerBg,
            zIndex: 11,
          }}>
            #
          </div>

          {/* Expand col */}
          <div style={{
            width: expandWidth,
            minWidth: expandWidth,
            borderRight: `1px solid ${borderColor}`,
          }} />

          {/* Field headers */}
          {fields.map((f) => (
            <div
              key={f.id}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ field: f, x: e.clientX, y: e.clientY });
              }}
              onClick={(e) => {
                // Left-click on header also opens menu
                if (e.detail === 1) {
                  setContextMenu({ field: f, x: e.clientX, y: e.clientY + 10 });
                }
              }}
              style={{
                width: getWidth(f),
                minWidth: getWidth(f),
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: 500,
                color: colors.textMuted,
                borderRight: `1px solid ${borderColor}`,
                position: 'relative',
                userSelect: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                background: frozenFieldIds.has(f.id) ? (isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)') : undefined,
                transition: 'background 0.15s',
              }}
            >
              {f.primary && (
                <span style={{
                  width: 3, height: 3, borderRadius: 2,
                  background: '#2d7ff9', flexShrink: 0,
                }} />
              )}
              {frozenFieldIds.has(f.id) && (
                <span style={{ fontSize: 9, opacity: 0.5 }}>❄</span>
              )}
              {f.title}
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                opacity: 0.4,
                transition: 'opacity 0.15s',
              }}>
                ▾
              </span>

              {/* Resize handle */}
              <div
                onMouseDown={(e) => handleResizeStart(e, f.id)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  background: resizing === f.id ? tableColor : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!resizing) (e.currentTarget as HTMLElement).style.background = `${tableColor}60`;
                }}
                onMouseLeave={(e) => {
                  if (!resizing) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              />
            </div>
          ))}

          {/* Add field (+) column */}
          {onAddField && (
            <div
              onClick={() => setShowAddField(!showAddField)}
              style={{
                width: ADD_FIELD_WIDTH,
                minWidth: ADD_FIELD_WIDTH,
                padding: '8px 12px',
                fontSize: 13,
                color: colors.textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                e.currentTarget.style.color = '#2d7ff9';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = colors.textMuted;
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 300 }}>+</span>
            </div>
          )}
        </div>

        {/* Add field dropdown */}
        {showAddField && onAddField && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: selectedRowIds.size > 0 ? 80 : 40,
            width: 260,
            background: isDark ? '#2a2a38' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e5e5'}`,
            borderRadius: 4,
            padding: 12,
            zIndex: 100,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Add field
            </div>
            <input
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              placeholder="Field name..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && newFieldName.trim()) {
                  const id = newFieldName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                  onAddField({
                    id: `${id}_${Date.now()}`,
                    title: newFieldName.trim(),
                    type: newFieldType,
                    width: 150,
                    visible: true,
                  });
                  setNewFieldName('');
                  setNewFieldType('text');
                  setShowAddField(false);
                }
                if (e.key === 'Escape') setShowAddField(false);
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 3,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e5e5'}`,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                color: colors.text,
                fontSize: 13,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                outline: 'none',
                marginBottom: 8,
                boxSizing: 'border-box' as const,
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 4 }}>
              Field type
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflow: 'auto' }}>
              {FIELD_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewFieldType(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 8px',
                    borderRadius: 3,
                    border: 'none',
                    width: '100%',
                    textAlign: 'left' as const,
                    cursor: 'pointer',
                    background: newFieldType === opt.value
                      ? (isDark ? 'rgba(45,127,249,0.15)' : 'rgba(45,127,249,0.08)')
                      : 'transparent',
                    color: newFieldType === opt.value ? '#2d7ff9' : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: newFieldType === opt.value ? 600 : 400,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center' as const, fontSize: 12, opacity: 0.7 }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button
                onClick={() => {
                  if (newFieldName.trim()) {
                    const id = newFieldName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    onAddField({
                      id: `${id}_${Date.now()}`,
                      title: newFieldName.trim(),
                      type: newFieldType,
                      width: 150,
                      visible: true,
                    });
                    setNewFieldName('');
                    setNewFieldType('text');
                    setShowAddField(false);
                  }
                }}
                disabled={!newFieldName.trim()}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: 3,
                  border: 'none',
                  background: newFieldName.trim() ? '#2d7ff9' : (isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'),
                  color: newFieldName.trim() ? '#fff' : colors.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: newFieldName.trim() ? 'pointer' : 'default',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                Add field
              </button>
              <button
                onClick={() => setShowAddField(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 3,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e5e5'}`,
                  background: 'transparent',
                  color: colors.textMuted,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted, fontSize: 14 }}>
            <div style={{
              display: 'inline-block',
              width: 20, height: 20,
              border: `2px solid ${borderColor}`,
              borderTopColor: tableColor,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginRight: 10,
              verticalAlign: 'middle',
            }} />
            Loading records…
          </div>
        )}

        {/* Rows */}
        {!loading && rows.map((row, idx) => {
          const isSelected = selectedRowIds.has(row.id);
          const isActiveRow = activeCell?.row === idx;

          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                borderBottom: `1px solid ${borderColor}`,
                cursor: 'pointer',
                transition: 'background 0.1s',
                background: isSelected ? selectedBg : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = hoverBg;
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: checkboxWidth,
                  minWidth: checkboxWidth,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: `1px solid ${borderColor}`,
                  position: 'sticky',
                  left: 0,
                  background: isSelected
                    ? (isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)')
                    : (isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)'),
                  zIndex: 5,
                }}
                onClick={(e) => { e.stopPropagation(); onToggleRowSelection(row.id); }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ cursor: 'pointer', accentColor: tableColor }}
                />
              </div>

              {/* Row number */}
              <div style={{
                width: rowNumWidth,
                minWidth: rowNumWidth,
                padding: `${ROW_PADDING[rowHeight]}px 4px`,
                fontSize: 12,
                color: colors.textMuted,
                borderRight: `1px solid ${borderColor}`,
                textAlign: 'center',
                position: 'sticky',
                left: checkboxWidth,
                background: isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)',
                zIndex: 5,
              }}>
                {idx + 1}
              </div>

              {/* Expand button */}
              <div
                style={{
                  width: expandWidth,
                  minWidth: expandWidth,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: `1px solid ${borderColor}`,
                  fontSize: 14,
                  color: colors.textMuted,
                }}
                onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
              >
                ↗
              </div>

              {/* Cells */}
              {fields.map((f, colIdx) => {
                const isEditing = editingCell?.rowId === row.id && editingCell?.fieldId === f.id;
                const isActive = activeCell?.row === idx && activeCell?.col === colIdx;

                return (
                  <div
                    key={f.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCell({ row: idx, col: colIdx });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingCell({ rowId: row.id, fieldId: f.id });
                    }}
                    style={{
                      width: getWidth(f),
                      minWidth: getWidth(f),
                      padding: isEditing ? '2px 4px' : `${ROW_PADDING[rowHeight]}px 12px`,
                      borderRight: `1px solid ${borderColor}`,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      outline: isActive ? `2px solid ${activeCellBorder}` : 'none',
                      outlineOffset: -2,
                      borderRadius: isActive ? 1 : 0,
                      background: isEditing
                        ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)')
                        : frozenFieldIds.has(f.id)
                          ? (isDark ? 'rgba(59,130,246,0.03)' : 'rgba(59,130,246,0.02)')
                          : undefined,
                    }}
                  >
                    {isEditing ? (
                      <NcCellEditor
                        field={f}
                        row={row}
                        value={row[f.id]}
                        onSave={(val) => {
                          onCellEdit?.(row.id, f.id, val);
                          setEditingCell(null);
                        }}
                        onCancel={() => setEditingCell(null)}
                        colors={colors}
                        isDark={isDark}
                        tableColor={tableColor}
                      />
                    ) : (
                      <NcCell field={f} row={row} colors={colors} highlightText={highlightText} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Add row button */}
        {!loading && onAddRow && (
          <div
            onClick={onAddRow}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              cursor: 'pointer',
              color: colors.textMuted,
              fontSize: 13,
              fontWeight: 500,
              borderBottom: `1px solid ${borderColor}`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = hoverBg;
              e.currentTarget.style.color = tableColor;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.textMuted;
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 300 }}>+</span>
            New row
          </div>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⊞</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
              No records found
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              Try adjusting your filters or search query
            </div>
          </div>
        )}

        {/* Aggregation footer */}
        {!loading && rows.length > 0 && (
          <NcAggRow
            fields={fields}
            rows={rows}
            aggTypes={aggTypes}
            setAggType={(fieldId, agg) => setAggTypes(prev => ({ ...prev, [fieldId]: agg }))}
            getWidth={getWidth}
            rowNumWidth={rowNumWidth}
            expandWidth={expandWidth}
            checkboxWidth={checkboxWidth}
            colors={colors}
            isDark={isDark}
            tableColor={tableColor}
            borderColor={borderColor}
          />
        )}

        {/* Footer */}
        {!loading && rows.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: headerBg,
            borderTop: `1px solid ${borderColor}`,
            position: 'sticky',
            bottom: 0,
            fontSize: 12,
            color: colors.textMuted,
          }}>
            <span>{rows.length} of {totalCount} records</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span>{fields.length} fields</span>
              <span style={{ fontSize: 10, color: colors.textMuted }}>
                Double-click to edit · Arrow keys to navigate
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Column context menu */}
      {contextMenu && (
        <NcColumnMenu
          field={contextMenu.field}
          rows={rows}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onSort={(fieldId, dir) => onSort?.(fieldId, dir)}
          onHide={(fieldId) => onHideField?.(fieldId)}
          onFreeze={(fieldId) => {
            setFrozenFieldIds(prev => {
              const next = new Set(prev);
              if (next.has(fieldId)) next.delete(fieldId);
              else next.add(fieldId);
              return next;
            });
          }}
          frozenFieldIds={frozenFieldIds}
          colors={colors}
          isDark={isDark}
          tableColor={tableColor}
        />
      )}
    </div>
  );
}
