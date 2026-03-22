import React, { useMemo, useState } from 'react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useTableData } from './useTableData';
import { NcSidebar } from './NcSidebar';
import { NcToolbar } from './NcToolbar';
import type { RowHeight } from './NcToolbar';
import { NcGrid } from './NcGrid';
import { NcGallery } from './NcGallery';
import { NcKanban } from './NcKanban';
import { NcFormView } from './NcFormView';
import { NcCalendarView } from './NcCalendarView';
import { NcRowExpand } from './NcRowExpand';
import { NcToastContainer, useToasts } from './NcToast';
import type { FieldDef } from './types';

// ---------------------------------------------------------------------------
// Full-featured Airtable-style Database Page
// Table tabs at top, view sidebar on left, grid/gallery/kanban content
// ---------------------------------------------------------------------------

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function DatabasePage() {
  const { isDark, colors } = useGlassStyles();
  const data = useTableData();
  const [rowHeight, setRowHeight] = useState<RowHeight>('medium');
  const { toasts, addToast, removeToast } = useToasts();
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5';

  // Find the expanded row
  const expandedRow = useMemo(() => {
    if (data.expandedRowId == null) return null;
    return data.rawRows.find(r => r.id === data.expandedRowId) || null;
  }, [data.expandedRowId, data.rawRows]);

  // Wrapped handlers with toast feedback
  const handleCellEdit = (rowId: string | number, fieldId: string, value: unknown) => {
    data.editCell(rowId, fieldId, value);
    addToast('Cell updated', 'success', 2000);
  };

  const handleAddRow = () => {
    data.addRow();
    addToast('New row added', 'success');
  };

  const handleDuplicateRow = (rowId: string | number) => {
    data.duplicateRow(rowId);
    addToast('Row duplicated', 'success');
  };

  const handleDeleteRows = (rowIds: (string | number)[]) => {
    data.deleteRows(rowIds);
    addToast(`${rowIds.length} row${rowIds.length > 1 ? 's' : ''} deleted`, 'warning');
  };

  const handleImport = (rows: typeof data.rows) => {
    data.importRows(rows);
    addToast(`${rows.length} rows imported`, 'success');
  };

  const handleAddField = (field: FieldDef) => {
    data.addField(field);
    addToast(`Field "${field.title}" added`, 'success');
  };

  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    const icons = ['📋', '📊', '📁', '📝', '📌', '🗂', '📑', '🔖'];
    const tableColors = ['#3b82f6', '#a855f7', '#06b6d4', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#6366f1'];
    const idx = data.tables.length % icons.length;
    data.addTable(newTableName.trim(), icons[idx], tableColors[idx]);
    setNewTableName('');
    setShowAddTable(false);
    addToast(`Table "${newTableName.trim()}" created`, 'success');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      fontFamily: FONT,
      position: 'relative',
      overflow: 'hidden',
      background: isDark ? '#1a1a24' : '#fff',
    }}>
      {/* Database selector bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${borderColor}`,
        background: isDark ? '#16161e' : '#eee',
        flexShrink: 0,
        padding: '0 4px',
        gap: 2,
        overflow: 'auto',
        scrollbarWidth: 'none',
      }}>
        {data.databases.map(db => {
          const isActive = db.id === data.activeDatabaseId;
          return (
            <button
              key={db.id}
              onClick={() => data.switchDatabase(db.id)}
              title={db.description}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                border: 'none',
                borderBottom: isActive ? `2px solid ${db.color}` : '2px solid transparent',
                background: isActive
                  ? (isDark ? 'rgba(255,255,255,0.08)' : '#fff')
                  : 'transparent',
                color: isActive ? colors.text : colors.textMuted,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                fontFamily: FONT,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s',
                borderRadius: '4px 4px 0 0',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 13 }}>{db.icon}</span>
              {db.name}
            </button>
          );
        })}
      </div>

      {/* Table tabs bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${borderColor}`,
        background: isDark ? '#1e1e2a' : '#f5f5f5',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'auto',
          flex: 1,
          gap: 0,
          scrollbarWidth: 'none',
        }}>
          {data.tables.map(t => {
            const isActive = t.id === data.activeTableId;
            const count = data.tableCounts[t.id] ?? 0;
            return (
              <button
                key={t.id}
                onClick={() => data.switchTable(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${t.color}` : '2px solid transparent',
                  background: isActive
                    ? (isDark ? 'rgba(255,255,255,0.06)' : '#fff')
                    : 'transparent',
                  color: isActive ? colors.text : colors.textMuted,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: FONT,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.1s',
                  marginBottom: isActive ? -1 : 0,
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.name}
                {count > 0 && (
                  <span style={{
                    fontSize: 10,
                    color: colors.textMuted,
                    fontWeight: 400,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add table button */}
        <div style={{ padding: '0 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          {showAddTable ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="Table name..."
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddTable();
                  if (e.key === 'Escape') { setShowAddTable(false); setNewTableName(''); }
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 3,
                  border: `1px solid ${borderColor}`,
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  color: colors.text,
                  fontSize: 12,
                  fontFamily: FONT,
                  outline: 'none',
                  width: 120,
                }}
              />
              <button
                onClick={handleAddTable}
                disabled={!newTableName.trim()}
                style={{
                  padding: '4px 8px', borderRadius: 3, border: 'none',
                  background: newTableName.trim() ? '#2d7ff9' : (isDark ? 'rgba(255,255,255,0.08)' : '#ddd'),
                  color: newTableName.trim() ? '#fff' : colors.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: newTableName.trim() ? 'pointer' : 'default',
                  fontFamily: FONT,
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddTable(false); setNewTableName(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.textMuted, fontSize: 14, padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowAddTable(true)}
                title="Add table"
                style={{
                  width: 28, height: 28,
                  borderRadius: 3,
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: colors.textMuted,
                  fontSize: 16,
                  fontWeight: 300,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                +
              </button>
              <span style={{
                fontSize: 11,
                color: colors.textMuted,
                padding: '0 4px',
              }}>
                {data.tables.length} table{data.tables.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main area: sidebar + content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* View sidebar */}
        <NcSidebar
          viewType={data.viewType}
          setViewType={data.setViewType}
          savedViews={data.savedViews}
          onLoadView={data.loadView}
          onSaveView={data.saveCurrentView}
          onDeleteView={data.deleteView}
          onRenameView={data.renameView}
          colors={colors}
          isDark={isDark}
          tableColor={data.activeTable.color}
        />

        {/* Content area */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Toolbar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <NcToolbar
              viewType={data.viewType}
              setViewType={data.setViewType}
              search={data.search}
              setSearch={data.setSearch}
              fields={data.visibleFields}
              allFields={data.activeTable.fields}
              hiddenFieldIds={data.hiddenFieldIds}
              toggleFieldVisibility={data.toggleFieldVisibility}
              filters={data.filters}
              addFilter={data.addFilter}
              removeFilter={data.removeFilter}
              clearFilters={data.clearFilters}
              sorts={data.sorts}
              addSort={data.addSort}
              removeSort={data.removeSort}
              clearSorts={data.clearSorts}
              groupByFieldId={data.groupByFieldId}
              setGroupByFieldId={data.setGroupByFieldId}
              rowHeight={rowHeight}
              setRowHeight={setRowHeight}
              colors={colors}
              isDark={isDark}
              tableColor={data.activeTable.color}
              tableName={data.activeTable.name}
              rowCount={data.rows.length}
              onRefresh={data.refresh}
              savedViews={data.savedViews}
              onSaveView={data.saveCurrentView}
              onLoadView={data.loadView}
              onDeleteView={data.deleteView}
              onRenameView={data.renameView}
              canUndo={data.undoStack.length > 0}
              canRedo={data.redoStack.length > 0}
              onUndo={data.undo}
              onRedo={data.redo}
              rows={data.rows}
              allRows={data.rawRows}
              onImport={handleImport}
            />
          </div>

          {/* View content */}
          {data.viewType === 'grid' && (
            <NcGrid
              fields={data.visibleFields}
              rows={data.rows}
              loading={data.loading}
              totalCount={data.totalCount}
              colors={colors}
              isDark={isDark}
              tableColor={data.activeTable.color}
              rowHeight={rowHeight}
              search={data.search}
              onRowClick={data.setExpandedRowId}
              onCellEdit={handleCellEdit}
              selectedRowIds={data.selectedRowIds}
              onToggleRowSelection={data.toggleRowSelection}
              onSelectAll={data.selectAll}
              onClearSelection={data.clearSelection}
              onSort={data.sortByField}
              onHideField={data.toggleFieldVisibility}
              onAddRow={handleAddRow}
              onDuplicateRow={handleDuplicateRow}
              onDeleteRows={handleDeleteRows}
              onAddField={handleAddField}
            />
          )}

          {data.viewType === 'gallery' && (
            <NcGallery
              fields={data.visibleFields}
              rows={data.rows}
              loading={data.loading}
              colors={colors}
              isDark={isDark}
              tableColor={data.activeTable.color}
              onRowClick={data.setExpandedRowId}
            />
          )}

          {data.viewType === 'kanban' && (
            <NcKanban
              fields={data.visibleFields}
              rows={data.rows}
              groupedRows={data.groupedRows}
              groupByFieldId={data.groupByFieldId || 'status'}
              loading={data.loading}
              colors={colors}
              isDark={isDark}
              tableColor={data.activeTable.color}
              onRowClick={data.setExpandedRowId}
            />
          )}

          {data.viewType === 'calendar' && (
            <NcCalendarView
              fields={data.activeTable.fields}
              rows={data.rows}
              loading={data.loading}
              colors={colors}
              isDark={isDark}
              tableColor={data.activeTable.color}
              onRowClick={data.setExpandedRowId}
            />
          )}

          {data.viewType === 'form' && (
            <NcFormView
              fields={data.activeTable.fields}
              tableName={data.activeTable.name}
              colors={colors}
              isDark={isDark}
              tableColor={data.activeTable.color}
            />
          )}
        </div>
      </div>

      {/* Row expansion panel */}
      {expandedRow && (
        <NcRowExpand
          row={expandedRow}
          fields={data.activeTable.fields}
          colors={colors}
          isDark={isDark}
          tableColor={data.activeTable.color}
          tableName={data.activeTable.name}
          onClose={() => data.setExpandedRowId(null)}
          onCellEdit={handleCellEdit}
          onDuplicate={handleDuplicateRow}
          onDelete={handleDeleteRows}
        />
      )}

      {/* Toast notifications */}
      <NcToastContainer toasts={toasts} removeToast={removeToast} isDark={isDark} />

      {/* CSS animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100px); opacity: 0; }
        }
        /* Hide scrollbar on table tabs */
        div::-webkit-scrollbar { height: 0; }
      `}</style>
    </div>
  );
}
