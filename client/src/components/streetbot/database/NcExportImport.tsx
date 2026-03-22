import React, { useRef } from 'react';
import type { FieldDef, RowData } from './types';

// ---------------------------------------------------------------------------
// Export & Import — CSV / JSON download and CSV upload
// ---------------------------------------------------------------------------

interface ExportImportProps {
  tableName: string;
  fields: FieldDef[];
  rows: RowData[];
  allRows: RowData[];
  onImport: (rows: RowData[]) => void;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  onClose: () => void;
}

export function NcExportImport({
  tableName, fields, rows, allRows, onImport, colors, isDark, tableColor, onClose,
}: ExportImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV export
  const exportCSV = (filtered: boolean) => {
    const data = filtered ? rows : allRows;
    const headers = fields.map(f => f.title);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = fields.map(f => {
        const v = row[f.id];
        if (v == null) return '';
        const str = String(v);
        // Escape commas and quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(','));
    }

    download(csvRows.join('\n'), `${tableName}.csv`, 'text/csv');
  };

  // JSON export
  const exportJSON = (filtered: boolean) => {
    const data = filtered ? rows : allRows;
    const exported = data.map(row => {
      const obj: Record<string, unknown> = {};
      fields.forEach(f => { obj[f.id] = row[f.id] ?? null; });
      obj.id = row.id;
      return obj;
    });
    download(JSON.stringify(exported, null, 2), `${tableName}.json`, 'application/json');
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const headers = parseCSVLine(lines[0]);
      const imported: RowData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: RowData = { id: `import-${Date.now()}-${i}` };
        headers.forEach((h, j) => {
          // Match header to field
          const field = fields.find(f => f.title.toLowerCase() === h.toLowerCase() || f.id === h);
          if (field) {
            row[field.id] = values[j] || '';
          }
        });
        imported.push(row);
      }

      onImport(imported);
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: colors.text,
    fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: 3,
    transition: 'background 0.1s',
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 12 }}>
        Export & Import
      </div>

      {/* Export section */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: colors.textMuted,
        /* clean label */
        padding: '4px 14px', marginTop: 4,
      }}>
        Export
      </div>

      <button
        style={btnStyle}
        onClick={() => { exportCSV(true); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 16 }}>📄</span>
        CSV (filtered — {rows.length} records)
      </button>
      <button
        style={btnStyle}
        onClick={() => { exportCSV(false); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        CSV (all — {allRows.length} records)
      </button>
      <button
        style={btnStyle}
        onClick={() => { exportJSON(true); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 16 }}>{'{ }'}</span>
        JSON (filtered — {rows.length} records)
      </button>
      <button
        style={btnStyle}
        onClick={() => { exportJSON(false); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 16 }}>{'{ }'}</span>
        JSON (all — {allRows.length} records)
      </button>

      <div style={{
        height: 1,
        background: borderColor,
        margin: '8px 0',
      }} />

      {/* Import section */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: colors.textMuted,
        /* clean label */
        padding: '4px 14px',
      }}>
        Import
      </div>
      <button
        style={btnStyle}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 16 }}>📂</span>
        Import CSV file
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImport}
        style={{ display: 'none' }}
      />
    </div>
  );
}
