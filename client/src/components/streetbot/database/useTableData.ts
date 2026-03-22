import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { sbFetch } from '../shared/sbFetch';
import { DATABASES, TABLES } from './tableSchemas';
import type { TableDef, DatabaseDef, FieldDef, RowData, SortRule, FilterRule, ViewType, FilterOp, SavedView, UndoAction } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractItems(data: unknown, keys: string[]): RowData[] {
  if (Array.isArray(data)) return data as RowData[];
  if (data && typeof data === 'object') {
    for (const k of keys) {
      const arr = (data as Record<string, unknown>)[k];
      if (Array.isArray(arr)) return arr as RowData[];
    }
  }
  return [];
}

function extractTotal(data: unknown, fallback: number): number {
  if (data && typeof data === 'object' && 'total' in (data as Record<string, unknown>)) {
    return Number((data as Record<string, unknown>).total);
  }
  return fallback;
}

function getVal(row: RowData, fieldId: string): string {
  const v = row[fieldId];
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function matchFilter(row: RowData, f: FilterRule): boolean {
  const v = getVal(row, f.fieldId).toLowerCase();
  const target = f.value.toLowerCase();
  switch (f.op) {
    case 'eq': return v === target;
    case 'neq': return v !== target;
    case 'contains': return v.includes(target);
    case 'notContains': return !v.includes(target);
    case 'empty': return v === '';
    case 'notEmpty': return v !== '';
    case 'gt': return v > target;
    case 'lt': return v < target;
    default: return true;
  }
}

function compareRows(a: RowData, b: RowData, sorts: SortRule[]): number {
  for (const s of sorts) {
    const va = getVal(a, s.fieldId).toLowerCase();
    const vb = getVal(b, s.fieldId).toLowerCase();
    if (va < vb) return s.dir === 'asc' ? -1 : 1;
    if (va > vb) return s.dir === 'asc' ? 1 : -1;
  }
  return 0;
}

// LocalStorage keys
const SAVED_VIEWS_KEY = 'nanobot-db-saved-views';

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedViews(views: SavedView[]) {
  try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views)); } catch {}
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTableData() {
  // Database selection
  const [activeDatabaseId, setActiveDatabaseId] = useState<string>(DATABASES[0].id);
  const [activeTableId, setActiveTableId] = useState<string>(DATABASES[0].tables[0]?.id || TABLES[0].id);
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [rawRows, setRawRows] = useState<RowData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sorts, setSorts] = useState<SortRule[]>([]);
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [hiddenFieldIds, setHiddenFieldIds] = useState<Set<string>>(new Set());
  const [groupByFieldId, setGroupByFieldId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | number | null>(null);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});

  // Selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());

  // Undo/redo
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);

  const abortRef = useRef<AbortController | null>(null);

  // Active database
  const activeDatabase: DatabaseDef = useMemo(
    () => DATABASES.find(d => d.id === activeDatabaseId) || DATABASES[0],
    [activeDatabaseId],
  );

  // Tables for the active database (+ any custom tables added at runtime)
  const [customTables, setCustomTables] = useState<TableDef[]>([]);
  const dynamicTables = useMemo(
    () => [...activeDatabase.tables, ...customTables.filter(t => t.id.startsWith(`custom-${activeDatabaseId}`))],
    [activeDatabase, customTables, activeDatabaseId],
  );

  const activeTable: TableDef = useMemo(
    () => dynamicTables.find(t => t.id === activeTableId) || dynamicTables[0],
    [activeTableId, dynamicTables],
  );

  const visibleFields = useMemo(
    () => activeTable.fields.filter(f => f.visible && !hiddenFieldIds.has(f.id)),
    [activeTable, hiddenFieldIds],
  );

  // Apply client-side search, filters, sorts
  const rows = useMemo(() => {
    let result = [...rawRows];

    // search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        activeTable.fields.some(f => getVal(r, f.id).toLowerCase().includes(q)),
      );
    }

    // filters
    for (const f of filters) {
      result = result.filter(r => matchFilter(r, f));
    }

    // sorts
    if (sorts.length > 0) {
      result.sort((a, b) => compareRows(a, b, sorts));
    }

    return result;
  }, [rawRows, search, filters, sorts, activeTable]);

  // Grouped rows (for kanban / group-by)
  const groupedRows = useMemo(() => {
    if (!groupByFieldId) return null;
    const groups: Record<string, RowData[]> = {};
    for (const r of rows) {
      const key = getVal(r, groupByFieldId) || '(empty)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [rows, groupByFieldId]);

  // Fetch data for active table
  const fetchTable = useCallback(async (tableId?: string) => {
    const tid = tableId || activeTableId;
    const table = dynamicTables.find(t => t.id === tid);
    if (!table) return;

    // Custom tables with no endpoint — don't fetch
    if (!table.endpoint) {
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      // Paginated fetch — API caps at limit=100 per request
      const PAGE_SIZE = 100;
      let allItems: RowData[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const resp = await sbFetch(
          `${table.endpoint}?limit=${PAGE_SIZE}&offset=${offset}`,
          { signal: controller.signal },
        );
        if (!resp.ok) throw new Error(`${resp.status}`);
        const data = await resp.json();
        const items = extractItems(data, table.responseKeys);
        allItems = allItems.concat(items);
        hasMore = items.length === PAGE_SIZE;
        offset += PAGE_SIZE;
        // Safety cap at 500 records
        if (allItems.length >= 500) break;
      }

      const withIds = allItems.map((item, i) => ({
        ...item,
        id: item.id ?? i,
      }));
      setRawRows(withIds);
      setTotalCount(withIds.length);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(`Failed to fetch ${tid}:`, err);
      setRawRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeTableId, dynamicTables]);

  // Fetch counts for sidebar badges
  const fetchAllCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      dynamicTables.filter(t => t.endpoint).map(async (t) => {
        try {
          // Fetch first page to get count; paginate if full
          const resp = await sbFetch(`${t.endpoint}?limit=100`);
          if (resp.ok) {
            const data = await resp.json();
            const items = extractItems(data, t.responseKeys);
            let total = extractTotal(data, items.length);
            // If we got exactly 100, there may be more pages
            if (items.length === 100) {
              let offset = 100;
              let more = true;
              while (more && offset < 500) {
                const r2 = await sbFetch(`${t.endpoint}?limit=100&offset=${offset}`);
                if (r2.ok) {
                  const d2 = await r2.json();
                  const items2 = extractItems(d2, t.responseKeys);
                  total += items2.length;
                  more = items2.length === 100;
                  offset += 100;
                } else {
                  more = false;
                }
              }
            }
            counts[t.id] = total;
          } else {
            counts[t.id] = 0;
          }
        } catch {
          counts[t.id] = 0;
        }
      }),
    );
    setTableCounts(counts);
  }, []);

  // Switch database
  const switchDatabase = useCallback((dbId: string) => {
    const db = DATABASES.find(d => d.id === dbId);
    if (!db || db.tables.length === 0) return;
    setActiveDatabaseId(dbId);
    setActiveTableId(db.tables[0].id);
    setSearch('');
    setSorts([]);
    setFilters([]);
    setGroupByFieldId(null);
    setExpandedRowId(null);
    setHiddenFieldIds(new Set());
    setSelectedRowIds(new Set());
  }, []);

  // Switch table
  const switchTable = useCallback((tableId: string) => {
    setActiveTableId(tableId);
    setSearch('');
    setSorts([]);
    setFilters([]);
    setGroupByFieldId(null);
    setExpandedRowId(null);
    setHiddenFieldIds(new Set());
    setSelectedRowIds(new Set());
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllCounts();
  }, [fetchAllCounts]);

  useEffect(() => {
    fetchTable(activeTableId);
  }, [activeTableId, fetchTable]);

  // Toggle field visibility
  const toggleFieldVisibility = useCallback((fieldId: string) => {
    setHiddenFieldIds(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }, []);

  // Filters
  const addFilter = useCallback((f: FilterRule) => {
    setFilters(prev => [...prev, f]);
  }, []);
  const removeFilter = useCallback((idx: number) => {
    setFilters(prev => prev.filter((_, i) => i !== idx));
  }, []);
  const clearFilters = useCallback(() => setFilters([]), []);

  // Sorts
  const addSort = useCallback((s: SortRule) => {
    setSorts(prev => [...prev, s]);
  }, []);
  const removeSort = useCallback((idx: number) => {
    setSorts(prev => prev.filter((_, i) => i !== idx));
  }, []);
  const clearSorts = useCallback(() => setSorts([]), []);

  // Direct sort from column menu
  const sortByField = useCallback((fieldId: string, dir: 'asc' | 'desc') => {
    setSorts([{ fieldId, dir }]);
  }, []);

  // ----- ROW CRUD (local / optimistic) -----

  const editCell = useCallback((rowId: string | number, fieldId: string, value: unknown) => {
    setRawRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const oldVal = r[fieldId];
      // Push undo
      setUndoStack(stack => [...stack, {
        type: 'cellEdit', rowId, fieldId, oldValue: oldVal, newValue: value, timestamp: Date.now(),
      }]);
      setRedoStack([]);
      return { ...r, [fieldId]: value };
    }));
  }, []);

  const addRow = useCallback(() => {
    const newId = `new-${Date.now()}`;
    const newRow: RowData = { id: newId };
    activeTable.fields.forEach(f => {
      if (f.type === 'checkbox') newRow[f.id] = false;
      else if (f.type === 'number' || f.type === 'currency' || f.type === 'rating' || f.type === 'percent') newRow[f.id] = 0;
      else newRow[f.id] = '';
    });
    setRawRows(prev => [...prev, newRow]);
    setTotalCount(prev => prev + 1);
    setUndoStack(stack => [...stack, { type: 'rowAdd', rowId: newId, rowData: newRow, timestamp: Date.now() }]);
    setRedoStack([]);

    // Auto-expand for editing
    setExpandedRowId(newId);
  }, [activeTable]);

  const duplicateRow = useCallback((rowId: string | number) => {
    const source = rawRows.find(r => r.id === rowId);
    if (!source) return;
    const newId = `dup-${Date.now()}`;
    const newRow: RowData = { ...source, id: newId };
    const idx = rawRows.findIndex(r => r.id === rowId);
    setRawRows(prev => [...prev.slice(0, idx + 1), newRow, ...prev.slice(idx + 1)]);
    setTotalCount(prev => prev + 1);
    setUndoStack(stack => [...stack, { type: 'rowDuplicate', rowId: newId, rowData: newRow, timestamp: Date.now() }]);
    setRedoStack([]);
  }, [rawRows]);

  const deleteRows = useCallback((rowIds: (string | number)[]) => {
    const idSet = new Set(rowIds);
    const deleted = rawRows.filter(r => idSet.has(r.id));
    setRawRows(prev => prev.filter(r => !idSet.has(r.id)));
    setTotalCount(prev => prev - deleted.length);
    setSelectedRowIds(new Set());
    // Push undo for each
    deleted.forEach(row => {
      setUndoStack(stack => [...stack, { type: 'rowDelete', rowId: row.id, rowData: row, timestamp: Date.now() }]);
    });
    setRedoStack([]);
  }, [rawRows]);

  // Undo
  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack;
      const action = stack[stack.length - 1];
      const rest = stack.slice(0, -1);

      switch (action.type) {
        case 'cellEdit':
          setRawRows(prev => prev.map(r =>
            r.id === action.rowId ? { ...r, [action.fieldId!]: action.oldValue } : r
          ));
          break;
        case 'rowAdd':
        case 'rowDuplicate':
          setRawRows(prev => prev.filter(r => r.id !== action.rowId));
          setTotalCount(prev => prev - 1);
          break;
        case 'rowDelete':
          if (action.rowData) {
            setRawRows(prev => [...prev, action.rowData!]);
            setTotalCount(prev => prev + 1);
          }
          break;
      }

      setRedoStack(prev => [...prev, action]);
      return rest;
    });
  }, []);

  // Redo
  const redo = useCallback(() => {
    setRedoStack(stack => {
      if (stack.length === 0) return stack;
      const action = stack[stack.length - 1];
      const rest = stack.slice(0, -1);

      switch (action.type) {
        case 'cellEdit':
          setRawRows(prev => prev.map(r =>
            r.id === action.rowId ? { ...r, [action.fieldId!]: action.newValue } : r
          ));
          break;
        case 'rowAdd':
        case 'rowDuplicate':
          if (action.rowData) {
            setRawRows(prev => [...prev, action.rowData!]);
            setTotalCount(prev => prev + 1);
          }
          break;
        case 'rowDelete':
          setRawRows(prev => prev.filter(r => r.id !== action.rowId));
          setTotalCount(prev => prev - 1);
          break;
      }

      setUndoStack(prev => [...prev, action]);
      return rest;
    });
  }, []);

  // Global undo/redo keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ----- SELECTION -----

  const toggleRowSelection = useCallback((rowId: string | number) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedRowIds(new Set(rows.map(r => r.id)));
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  // ----- SAVED VIEWS -----

  const tableSavedViews = useMemo(
    () => savedViews.filter(v => v.tableId === activeTableId),
    [savedViews, activeTableId],
  );

  const saveCurrentView = useCallback((name: string) => {
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name,
      type: viewType,
      tableId: activeTableId,
      filters: [...filters],
      sorts: [...sorts],
      hiddenFieldIds: [...hiddenFieldIds],
      groupByFieldId,
      createdAt: Date.now(),
    };
    setSavedViews(prev => {
      const next = [...prev, view];
      persistSavedViews(next);
      return next;
    });
  }, [viewType, activeTableId, filters, sorts, hiddenFieldIds, groupByFieldId]);

  const loadView = useCallback((viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (!view) return;
    setViewType(view.type);
    setFilters(view.filters);
    setSorts(view.sorts);
    setHiddenFieldIds(new Set(view.hiddenFieldIds));
    setGroupByFieldId(view.groupByFieldId);
  }, [savedViews]);

  const deleteView = useCallback((viewId: string) => {
    setSavedViews(prev => {
      const next = prev.filter(v => v.id !== viewId);
      persistSavedViews(next);
      return next;
    });
  }, []);

  const renameView = useCallback((viewId: string, name: string) => {
    setSavedViews(prev => {
      const next = prev.map(v => v.id === viewId ? { ...v, name } : v);
      persistSavedViews(next);
      return next;
    });
  }, []);

  // ----- ADD FIELD -----

  const addField = useCallback((field: FieldDef) => {
    setCustomTables(prev => prev.map(t =>
      t.id === activeTableId ? { ...t, fields: [...t.fields, field] } : t
    ));
  }, [activeTableId]);

  // ----- ADD TABLE -----

  const addTable = useCallback((name: string, icon: string, color: string) => {
    const id = `custom-${activeDatabaseId}-${Date.now()}`;
    const newTable: TableDef = {
      id,
      name,
      icon,
      color,
      endpoint: '',
      description: 'Custom table',
      responseKeys: [],
      fields: [
        { id: 'title', title: 'Title', type: 'text', width: 280, visible: true, primary: true },
        { id: 'notes', title: 'Notes', type: 'longText', width: 300, visible: true },
        { id: 'status', title: 'Status', type: 'singleSelect', width: 120, visible: true, options: [
          { value: 'todo', label: 'To Do', color: '#6b7280' },
          { value: 'in-progress', label: 'In Progress', color: '#3b82f6' },
          { value: 'done', label: 'Done', color: '#22c55e' },
        ] },
        { id: 'created_at', title: 'Created', type: 'date', width: 130, visible: true },
      ],
    };
    setCustomTables(prev => [...prev, newTable]);
    setActiveTableId(id);
    setRawRows([]);
    setTotalCount(0);
  }, [activeDatabaseId]);

  // ----- IMPORT -----

  const importRows = useCallback((imported: RowData[]) => {
    setRawRows(prev => [...prev, ...imported]);
    setTotalCount(prev => prev + imported.length);
  }, []);

  return {
    // Database selection
    databases: DATABASES,
    activeDatabase,
    activeDatabaseId,
    switchDatabase,

    // Table selection
    tables: dynamicTables,
    activeTable,
    activeTableId,
    switchTable,
    tableCounts,

    // View
    viewType,
    setViewType,

    // Data
    rows,
    rawRows,
    totalCount,
    loading,
    groupedRows,
    refresh: () => { fetchTable(); fetchAllCounts(); },

    // Fields
    visibleFields,
    hiddenFieldIds,
    toggleFieldVisibility,

    // Search
    search,
    setSearch,

    // Filters
    filters,
    addFilter,
    removeFilter,
    clearFilters,

    // Sorts
    sorts,
    addSort,
    removeSort,
    clearSorts,
    sortByField,

    // Group by
    groupByFieldId,
    setGroupByFieldId,

    // Row expand
    expandedRowId,
    setExpandedRowId,

    // Cell editing
    editCell,

    // Row CRUD
    addRow,
    duplicateRow,
    deleteRows,

    // Selection
    selectedRowIds,
    toggleRowSelection,
    selectAll,
    clearSelection,

    // Undo/redo
    undoStack,
    redoStack,
    undo,
    redo,

    // Saved views
    savedViews: tableSavedViews,
    saveCurrentView,
    loadView,
    deleteView,
    renameView,

    // Import
    importRows,

    // Field management
    addField,

    // Table management
    addTable,
  };
}
