// ---------------------------------------------------------------------------
// NocoDB / Airtable-style Database Types — Full Feature Set
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'longText'
  | 'number'
  | 'date'
  | 'email'
  | 'url'
  | 'phone'
  | 'singleSelect'
  | 'multiSelect'
  | 'checkbox'
  | 'currency'
  | 'rating'
  | 'percent'
  | 'duration'
  | 'attachment'
  | 'image'
  | 'user';

export interface SelectOption {
  value: string;
  label: string;
  color: string;
}

export interface FieldDef {
  id: string;
  title: string;
  type: FieldType;
  width: number;           // column width in px
  visible: boolean;
  primary?: boolean;       // primary display field (like NocoDB's display column)
  options?: SelectOption[]; // for singleSelect / multiSelect
  editable?: boolean;
  description?: string;    // field tooltip / description
}

export interface TableDef {
  id: string;
  name: string;
  icon: string;            // emoji or icon key
  color: string;
  endpoint: string;
  description: string;
  fields: FieldDef[];
  // keys in API response that may hold items array
  responseKeys: string[];
}

export interface DatabaseDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  tables: TableDef[];
}

export type ViewType = 'grid' | 'gallery' | 'kanban' | 'form' | 'calendar';

export interface ViewDef {
  id: string;
  type: ViewType;
  name: string;
  icon: string;
}

// Saved view configuration — persists filters/sorts/hidden fields
export interface SavedView {
  id: string;
  name: string;
  type: ViewType;
  tableId: string;
  filters: FilterRule[];
  sorts: SortRule[];
  hiddenFieldIds: string[];
  groupByFieldId: string | null;
  columnWidths?: Record<string, number>;
  createdAt: number;
}

// A generic row from the API
export type RowData = Record<string, unknown> & { id: string | number };

export type SortDir = 'asc' | 'desc';
export interface SortRule {
  fieldId: string;
  dir: SortDir;
}

export type FilterOp = 'eq' | 'neq' | 'contains' | 'notContains' | 'empty' | 'notEmpty' | 'gt' | 'lt';
export interface FilterRule {
  fieldId: string;
  op: FilterOp;
  value: string;
}

// Inline editing
export interface CellEdit {
  rowId: string | number;
  fieldId: string;
}

// Aggregation types per column
export type AggType = 'none' | 'count' | 'countEmpty' | 'countFilled' | 'countUnique'
  | 'sum' | 'avg' | 'min' | 'max' | 'percentEmpty' | 'percentFilled';

// Column header menu actions
export type ColumnAction = 'sortAsc' | 'sortDesc' | 'hide' | 'freeze' | 'duplicate'
  | 'rename' | 'editDescription' | 'stats';

// Undo/redo
export interface UndoAction {
  type: 'cellEdit' | 'rowAdd' | 'rowDelete' | 'rowDuplicate';
  rowId: string | number;
  fieldId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  rowData?: RowData;
  timestamp: number;
}

export interface TableState {
  tableId: string;
  viewType: ViewType;
  search: string;
  sorts: SortRule[];
  filters: FilterRule[];
  hiddenFields: Set<string>;
  groupByFieldId: string | null;
  expandedRowId: string | number | null;
}
