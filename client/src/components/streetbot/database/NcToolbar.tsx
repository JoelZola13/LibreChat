import React, { useState, useRef, useEffect } from 'react';
import type { FieldDef, ViewType, SortRule, FilterRule, FilterOp, SortDir, SavedView, RowData } from './types';
import { NcExportImport } from './NcExportImport';

// ---------------------------------------------------------------------------
// Airtable-style Toolbar — clean, compact, flat buttons
// ---------------------------------------------------------------------------

export type RowHeight = 'short' | 'medium' | 'tall';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const VIEW_DEFS: { type: ViewType; name: string; icon: string }[] = [
  { type: 'grid', name: 'Grid', icon: '⊞' },
  { type: 'gallery', name: 'Gallery', icon: '▦' },
  { type: 'kanban', name: 'Kanban', icon: '▥' },
  { type: 'calendar', name: 'Calendar', icon: '📅' },
  { type: 'form', name: 'Form', icon: '☐' },
];

interface ToolbarProps {
  viewType: ViewType;
  setViewType: (v: ViewType) => void;
  search: string;
  setSearch: (s: string) => void;
  fields: FieldDef[];
  allFields: FieldDef[];
  hiddenFieldIds: Set<string>;
  toggleFieldVisibility: (id: string) => void;
  filters: FilterRule[];
  addFilter: (f: FilterRule) => void;
  removeFilter: (i: number) => void;
  clearFilters: () => void;
  sorts: SortRule[];
  addSort: (s: SortRule) => void;
  removeSort: (i: number) => void;
  clearSorts: () => void;
  groupByFieldId: string | null;
  setGroupByFieldId: (id: string | null) => void;
  rowHeight: RowHeight;
  setRowHeight: (h: RowHeight) => void;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  tableName: string;
  rowCount: number;
  onRefresh: () => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onLoadView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
  onRenameView: (viewId: string, name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  rows: RowData[];
  allRows: RowData[];
  onImport: (rows: RowData[]) => void;
}

export function NcToolbar(props: ToolbarProps) {
  const {
    viewType, setViewType, search, setSearch,
    fields, allFields, hiddenFieldIds, toggleFieldVisibility,
    filters, addFilter, removeFilter, clearFilters,
    sorts, addSort, removeSort, clearSorts,
    groupByFieldId, setGroupByFieldId,
    rowHeight, setRowHeight,
    colors, isDark, tableColor, tableName, rowCount, onRefresh,
    savedViews, onSaveView, onLoadView, onDeleteView, onRenameView,
    canUndo, canRedo, onUndo, onRedo,
    rows, allRows, onImport,
  } = props;

  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5';

  const togglePanel = (name: string) => setOpenPanel(prev => prev === name ? null : name);

  const btnStyle = (active: boolean = false): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 3,
    border: 'none',
    background: active
      ? (isDark ? 'rgba(45,127,249,0.15)' : 'rgba(45,127,249,0.08)')
      : 'transparent',
    color: active ? '#2d7ff9' : colors.textSecondary,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: FONT,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    position: 'relative',
  });

  const badge = (count: number) => (
    <span style={{
      background: '#2d7ff9',
      color: '#fff',
      borderRadius: 3,
      padding: '0 4px',
      fontSize: 10,
      fontWeight: 600,
      marginLeft: 2,
      lineHeight: '16px',
    }}>
      {count}
    </span>
  );

  return (
    <div style={{
      borderBottom: `1px solid ${borderColor}`,
      padding: 0,
      flexShrink: 0,
      fontFamily: FONT,
    }}>
      {/* Single toolbar row — matches Airtable layout */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        gap: 4,
      }}>
        {/* Hide fields */}
        <button onClick={() => togglePanel('fields')} style={btnStyle(hiddenFieldIds.size > 0)}>
          ⊟ Hide fields {hiddenFieldIds.size > 0 && badge(hiddenFieldIds.size)}
        </button>

        <button onClick={() => togglePanel('filter')} style={btnStyle(filters.length > 0)}>
          ⫏ Filter {filters.length > 0 && badge(filters.length)}
        </button>

        <button onClick={() => togglePanel('groupBy')} style={btnStyle(!!groupByFieldId)}>
          ≡ Group
        </button>

        <button onClick={() => togglePanel('sort')} style={btnStyle(sorts.length > 0)}>
          ↕ Sort {sorts.length > 0 && badge(sorts.length)}
        </button>

        {/* Row height toggle (grid only) */}
        {viewType === 'grid' && (
          <button onClick={() => {
            const heights: RowHeight[] = ['short', 'medium', 'tall'];
            const idx = heights.indexOf(rowHeight);
            setRowHeight(heights[(idx + 1) % heights.length]);
          }} style={btnStyle()} title={`Row height: ${rowHeight}`}>
            ☰ Height
          </button>
        )}

        <button onClick={() => togglePanel('export')} style={btnStyle(openPanel === 'export')}>
          ↧ Export
        </button>

        <div style={{ flex: 1 }} />

        {/* Record count */}
        <span style={{ fontSize: 12, color: colors.textMuted, padding: '0 6px' }}>
          {rowCount} {tableName.toLowerCase()}
        </span>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: 3,
          border: `1px solid ${borderColor}`,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          width: search ? 200 : 28,
          transition: 'width 0.2s',
          overflow: 'hidden',
        }}
        onClick={() => {
          if (!search) {
            const input = document.getElementById('toolbar-search') as HTMLInputElement;
            input?.focus();
          }
        }}
        >
          <span style={{ fontSize: 12, color: colors.textMuted, cursor: 'pointer', flexShrink: 0 }}>🔍</span>
          <input
            id="toolbar-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Find in view"
            onFocus={e => {
              (e.currentTarget.parentElement as HTMLElement).style.width = '200px';
            }}
            onBlur={e => {
              if (!search) (e.currentTarget.parentElement as HTMLElement).style.width = '28px';
            }}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: 12,
              fontFamily: FONT,
              width: '100%',
              minWidth: 0,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textMuted, fontSize: 12, padding: 0, flexShrink: 0,
              }}
            >✕</button>
          )}
        </div>

        {/* Undo/Redo */}
        <button
          onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)"
          style={{ ...btnStyle(), opacity: canUndo ? 1 : 0.3, fontSize: 13, padding: '4px 6px' }}
        >↩</button>
        <button
          onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)"
          style={{ ...btnStyle(), opacity: canRedo ? 1 : 0.3, fontSize: 13, padding: '4px 6px' }}
        >↪</button>

        <button onClick={onRefresh} style={btnStyle()} title="Refresh">↻</button>
      </div>

      {/* Dropdown panels */}
      {openPanel === 'filter' && (
        <DropdownPanel onClose={() => setOpenPanel(null)} isDark={isDark} borderColor={borderColor}>
          <FilterPanel fields={allFields} filters={filters} addFilter={addFilter}
            removeFilter={removeFilter} clearFilters={clearFilters}
            colors={colors} isDark={isDark} borderColor={borderColor} tableColor={tableColor} />
        </DropdownPanel>
      )}
      {openPanel === 'sort' && (
        <DropdownPanel onClose={() => setOpenPanel(null)} isDark={isDark} borderColor={borderColor}>
          <SortPanel fields={allFields} sorts={sorts} addSort={addSort}
            removeSort={removeSort} clearSorts={clearSorts}
            colors={colors} isDark={isDark} borderColor={borderColor} tableColor={tableColor} />
        </DropdownPanel>
      )}
      {openPanel === 'groupBy' && (
        <DropdownPanel onClose={() => setOpenPanel(null)} isDark={isDark} borderColor={borderColor}>
          <GroupByPanel fields={allFields} groupByFieldId={groupByFieldId}
            setGroupByFieldId={(id) => { setGroupByFieldId(id); setOpenPanel(null); }}
            colors={colors} isDark={isDark} />
        </DropdownPanel>
      )}
      {openPanel === 'fields' && (
        <DropdownPanel onClose={() => setOpenPanel(null)} isDark={isDark} borderColor={borderColor}>
          <FieldsPanel fields={allFields} hiddenFieldIds={hiddenFieldIds}
            toggleFieldVisibility={toggleFieldVisibility}
            colors={colors} isDark={isDark} tableColor={tableColor} />
        </DropdownPanel>
      )}
      {openPanel === 'export' && (
        <DropdownPanel onClose={() => setOpenPanel(null)} isDark={isDark} borderColor={borderColor}>
          <NcExportImport tableName={tableName} fields={allFields} rows={rows}
            allRows={allRows} onImport={(imported) => { onImport(imported); setOpenPanel(null); }}
            colors={colors} isDark={isDark} tableColor={tableColor} onClose={() => setOpenPanel(null)} />
        </DropdownPanel>
      )}
      {(openPanel === 'saveView' || openPanel === 'savedViews') && (
        <DropdownPanel onClose={() => setOpenPanel(null)} isDark={isDark} borderColor={borderColor}>
          <SaveViewPanel savedViews={savedViews}
            onSave={(name) => { onSaveView(name); setOpenPanel(null); }}
            onLoad={(id) => { onLoadView(id); setOpenPanel(null); }}
            onDelete={onDeleteView} onRename={onRenameView}
            colors={colors} isDark={isDark} />
        </DropdownPanel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown wrapper — Airtable-style clean popup
// ---------------------------------------------------------------------------

function DropdownPanel({ children, onClose, isDark, borderColor }: {
  children: React.ReactNode;
  onClose: () => void;
  isDark: boolean;
  borderColor: string;
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
      left: 12,
      top: '100%',
      marginTop: 2,
      background: isDark ? '#2a2a38' : '#fff',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      padding: 12,
      minWidth: 300,
      maxWidth: 420,
      zIndex: 100,
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panels — all restyled flat and compact
// ---------------------------------------------------------------------------

const selectStyle = (isDark: boolean, borderColor: string, colors: Record<string, string>): React.CSSProperties => ({
  padding: '5px 8px',
  borderRadius: 3,
  border: `1px solid ${borderColor}`,
  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
  color: colors.text,
  fontSize: 12,
  fontFamily: FONT,
  outline: 'none',
});

function FilterPanel({ fields, filters, addFilter, removeFilter, clearFilters, colors, isDark, borderColor, tableColor }: {
  fields: FieldDef[]; filters: FilterRule[]; addFilter: (f: FilterRule) => void;
  removeFilter: (i: number) => void; clearFilters: () => void;
  colors: Record<string, string>; isDark: boolean; borderColor: string; tableColor: string;
}) {
  const [newFieldId, setNewFieldId] = useState(fields[0]?.id || '');
  const [newOp, setNewOp] = useState<FilterOp>('contains');
  const [newVal, setNewVal] = useState('');

  const ops: { value: FilterOp; label: string }[] = [
    { value: 'contains', label: 'contains' }, { value: 'notContains', label: 'not contains' },
    { value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' },
    { value: 'empty', label: 'is empty' }, { value: 'notEmpty', label: 'is not empty' },
    { value: 'gt', label: '>' }, { value: 'lt', label: '<' },
  ];
  const ss = selectStyle(isDark, borderColor, colors);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Filters</span>
        {filters.length > 0 && (
          <button onClick={clearFilters} style={{
            background: 'none', border: 'none', fontSize: 11,
            color: '#2d7ff9', cursor: 'pointer', fontFamily: FONT,
          }}>Clear all</button>
        )}
      </div>
      {filters.map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          padding: '4px 8px', borderRadius: 3,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
          fontSize: 12,
        }}>
          <span style={{ fontWeight: 500, color: colors.text }}>{fields.find(fd => fd.id === f.fieldId)?.title || f.fieldId}</span>
          <span style={{ color: colors.textMuted }}>{f.op}</span>
          {f.value && <span style={{ color: '#2d7ff9' }}>"{f.value}"</span>}
          <button onClick={() => removeFilter(i)} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: colors.textMuted, cursor: 'pointer', fontSize: 12,
          }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
        <select value={newFieldId} onChange={e => setNewFieldId(e.target.value)} style={ss}>
          {fields.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <select value={newOp} onChange={e => setNewOp(e.target.value as FilterOp)} style={ss}>
          {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {newOp !== 'empty' && newOp !== 'notEmpty' && (
          <input value={newVal} onChange={e => setNewVal(e.target.value)}
            placeholder="Value…" style={{ ...ss, flex: 1, minWidth: 60 }} />
        )}
        <button
          onClick={() => { addFilter({ fieldId: newFieldId, op: newOp, value: newVal }); setNewVal(''); }}
          style={{
            padding: '5px 10px', borderRadius: 3, border: 'none',
            background: '#2d7ff9', color: '#fff', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}
        >+ Add</button>
      </div>
    </div>
  );
}

function SortPanel({ fields, sorts, addSort, removeSort, clearSorts, colors, isDark, borderColor, tableColor }: {
  fields: FieldDef[]; sorts: SortRule[]; addSort: (s: SortRule) => void;
  removeSort: (i: number) => void; clearSorts: () => void;
  colors: Record<string, string>; isDark: boolean; borderColor: string; tableColor: string;
}) {
  const [newFieldId, setNewFieldId] = useState(fields[0]?.id || '');
  const [newDir, setNewDir] = useState<SortDir>('asc');
  const ss = selectStyle(isDark, borderColor, colors);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Sort</span>
        {sorts.length > 0 && (
          <button onClick={clearSorts} style={{
            background: 'none', border: 'none', fontSize: 11,
            color: '#2d7ff9', cursor: 'pointer', fontFamily: FONT,
          }}>Clear all</button>
        )}
      </div>
      {sorts.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          padding: '4px 8px', borderRadius: 3,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5', fontSize: 12,
        }}>
          <span style={{ fontWeight: 500, color: colors.text }}>{fields.find(f => f.id === s.fieldId)?.title || s.fieldId}</span>
          <span style={{ color: colors.textMuted }}>{s.dir === 'asc' ? '↑ A→Z' : '↓ Z→A'}</span>
          <button onClick={() => removeSort(i)} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: colors.textMuted, cursor: 'pointer', fontSize: 12,
          }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
        <select value={newFieldId} onChange={e => setNewFieldId(e.target.value)} style={ss}>
          {fields.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <select value={newDir} onChange={e => setNewDir(e.target.value as SortDir)} style={ss}>
          <option value="asc">A → Z</option>
          <option value="desc">Z → A</option>
        </select>
        <button
          onClick={() => addSort({ fieldId: newFieldId, dir: newDir })}
          style={{
            padding: '5px 10px', borderRadius: 3, border: 'none',
            background: '#2d7ff9', color: '#fff', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}
        >+ Add</button>
      </div>
    </div>
  );
}

function GroupByPanel({ fields, groupByFieldId, setGroupByFieldId, colors, isDark }: {
  fields: FieldDef[]; groupByFieldId: string | null;
  setGroupByFieldId: (id: string | null) => void;
  colors: Record<string, string>; isDark: boolean;
}) {
  const selectFields = fields.filter(f => f.type === 'singleSelect' || f.type === 'text');
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>Group by</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div onClick={() => setGroupByFieldId(null)} style={{
          padding: '5px 8px', borderRadius: 3, cursor: 'pointer',
          background: !groupByFieldId ? (isDark ? 'rgba(45,127,249,0.15)' : 'rgba(45,127,249,0.08)') : 'transparent',
          color: !groupByFieldId ? '#2d7ff9' : colors.textSecondary, fontSize: 12, fontWeight: !groupByFieldId ? 600 : 400,
        }}>None</div>
        {selectFields.map(f => (
          <div key={f.id} onClick={() => setGroupByFieldId(f.id)} style={{
            padding: '5px 8px', borderRadius: 3, cursor: 'pointer',
            background: groupByFieldId === f.id ? (isDark ? 'rgba(45,127,249,0.15)' : 'rgba(45,127,249,0.08)') : 'transparent',
            color: groupByFieldId === f.id ? '#2d7ff9' : colors.textSecondary, fontSize: 12, fontWeight: groupByFieldId === f.id ? 600 : 400,
          }}>{f.title}</div>
        ))}
      </div>
    </div>
  );
}

function FieldsPanel({ fields, hiddenFieldIds, toggleFieldVisibility, colors, isDark, tableColor }: {
  fields: FieldDef[]; hiddenFieldIds: Set<string>; toggleFieldVisibility: (id: string) => void;
  colors: Record<string, string>; isDark: boolean; tableColor: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>Fields</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {fields.map(f => {
          const isVisible = f.visible && !hiddenFieldIds.has(f.id);
          return (
            <div key={f.id} onClick={() => !f.primary && toggleFieldVisibility(f.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px', borderRadius: 3,
              cursor: f.primary ? 'default' : 'pointer',
              opacity: f.primary ? 0.6 : 1,
            }}>
              <div style={{
                width: 28, height: 14, borderRadius: 7,
                background: isVisible ? '#2d7ff9' : (isDark ? 'rgba(255,255,255,0.15)' : '#d5d5d5'),
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 5, background: '#fff',
                  position: 'absolute', top: 2,
                  left: isVisible ? 16 : 2, transition: 'left 0.2s',
                }} />
              </div>
              <span style={{
                fontSize: 12, color: isVisible ? colors.text : colors.textMuted,
                fontWeight: isVisible ? 500 : 400,
              }}>{f.title}</span>
              {f.primary && <span style={{ fontSize: 10, color: '#2d7ff9', marginLeft: 'auto' }}>Primary</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SaveViewPanel({ savedViews, onSave, onLoad, onDelete, onRename, colors, isDark }: {
  savedViews: SavedView[]; onSave: (name: string) => void; onLoad: (viewId: string) => void;
  onDelete: (viewId: string) => void; onRename: (viewId: string, name: string) => void;
  colors: Record<string, string>; isDark: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5';

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>Saved views</div>
      {savedViews.length === 0 && (
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8, padding: '4px 0' }}>
          No saved views yet.
        </div>
      )}
      {savedViews.map(v => (
        <div key={v.id} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          padding: '5px 8px', borderRadius: 3,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
        }}>
          {editingId === v.id ? (
            <input value={editName} onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onRename(v.id, editName); setEditingId(null); } if (e.key === 'Escape') setEditingId(null); }}
              onBlur={() => { onRename(v.id, editName); setEditingId(null); }}
              autoFocus style={{
                flex: 1, padding: '3px 6px', borderRadius: 3,
                border: `1px solid #2d7ff9`, background: 'transparent',
                color: colors.text, fontSize: 12, fontFamily: FONT, outline: 'none',
              }} />
          ) : (
            <span onClick={() => onLoad(v.id)} style={{ flex: 1, fontSize: 12, fontWeight: 500, color: colors.text, cursor: 'pointer' }}>{v.name}</span>
          )}
          <span style={{ fontSize: 10, color: colors.textMuted }}>{v.filters.length}f {v.sorts.length}s</span>
          <button onClick={() => { setEditingId(v.id); setEditName(v.name); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 11 }}>✎</button>
          <button onClick={() => onDelete(v.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8, borderTop: `1px solid ${borderColor}`, paddingTop: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="View name…"
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onSave(newName.trim()); setNewName(''); } }}
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 3,
            border: `1px solid ${borderColor}`,
            background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
            color: colors.text, fontSize: 12, fontFamily: FONT, outline: 'none',
          }} />
        <button
          onClick={() => { if (newName.trim()) { onSave(newName.trim()); setNewName(''); } }}
          disabled={!newName.trim()}
          style={{
            padding: '5px 10px', borderRadius: 3, border: 'none',
            background: newName.trim() ? '#2d7ff9' : (isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'),
            color: newName.trim() ? '#fff' : colors.textMuted,
            fontSize: 12, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'default', fontFamily: FONT,
          }}
        >Save</button>
      </div>
    </div>
  );
}
