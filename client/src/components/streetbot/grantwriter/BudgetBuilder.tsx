import React, { useState, useCallback } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';

// ── OTF Budget Format ──
// Categories: Administrative Support, Capacity Building, Staffing, Project Expenses
// Columns: Category | Expense Item | Budget Notes | Year 1 | Year 2 | Year 3 | Total

export interface BudgetRow {
  id: string;
  category: string;
  expenseItem: string;
  budgetNotes: string;
  year1: number;
  year2: number;
  year3: number;
}

const OTF_CATEGORIES = [
  'Administrative Support',
  'Capacity Building',
  'Staffing',
  'Project Expenses',
];

let rowCounter = 0;
function newRowId() { return `br-${++rowCounter}`; }

function fmt(n: number): string {
  if (!n) return '';
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  if (!n) return '$0';
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Pre-populated with Street Voices' previous OTF budget
const DEFAULT_ROWS: BudgetRow[] = [
  { id: newRowId(), category: 'Administrative Support', expenseItem: 'Administration Costs (organizational mentor)', budgetNotes: 'Required — 15% of total budget', year1: 22500, year2: 22500, year3: 22500 },
  { id: newRowId(), category: 'Capacity Building', expenseItem: 'Capacity Building', budgetNotes: 'Media professionals as consultants to train team', year1: 4000, year2: 4000, year3: 4000 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Executive Director (Full Time)', budgetNotes: '$2,500/mo — $21.43/hr × 7hrs × 5 days/week', year1: 30000, year2: 30000, year3: 30000 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Administrative Assistant (Part Time)', budgetNotes: '$1,041.70/mo — $21.70/hr × 4hrs × 3 days/week', year1: 12500, year2: 12500, year3: 12500 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Social Media Marketing (Part Time)', budgetNotes: '$1,041.70/mo — $21.70/hr × 4hrs × 3 days/week', year1: 12500, year2: 12500, year3: 12500 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Project Manager (Part Time)', budgetNotes: '$1,041.70/mo — $21.70/hr × 4hrs × 3 days/week', year1: 12500, year2: 12500, year3: 12500 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Graphic Designer (Part Time)', budgetNotes: '$1,041.70/mo — $21.70/hr × 4hrs × 3 days/week', year1: 12500, year2: 12500, year3: 12500 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Digital Marketing Facilitator (Part Time)', budgetNotes: '$2,000/session × 2 sessions/year', year1: 4000, year2: 4000, year3: 4000 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Introduction to Videography Facilitator (Part Time)', budgetNotes: '$2,000/session × 2 sessions/year', year1: 4000, year2: 4000, year3: 4000 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Podcasting Facilitator (Full Time)', budgetNotes: '$2,000/session × 2 sessions/year', year1: 4000, year2: 4000, year3: 4000 },
  { id: newRowId(), category: 'Staffing', expenseItem: 'Networking Facilitator (Full Time)', budgetNotes: '$2,000/session × 2 sessions/year', year1: 4000, year2: 4000, year3: 4000 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Honorariums (youth & volunteers)', budgetNotes: 'Participation and peer support', year1: 4000, year2: 4000, year3: 4000 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Transportation', budgetNotes: '$6.70/round trip × participants × sessions × cohorts', year1: 4500, year2: 5000, year3: 5000 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Media Equipment & Workshop Supplies', budgetNotes: 'Cameras, printing, rental equipment, materials', year1: 13000, year2: 12000, year3: 12000 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Certificates (design & printing)', budgetNotes: 'For participants', year1: 400, year2: 700, year3: 700 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Food', budgetNotes: '$45-50/week × 20 weeks × 2 cohorts', year1: 1800, year2: 2000, year3: 2000 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Guest Speakers', budgetNotes: '3 speakers/cohort × $300 each', year1: 1800, year2: 1800, year3: 1800 },
  { id: newRowId(), category: 'Project Expenses', expenseItem: 'Software & Digital Tools', budgetNotes: 'Project management, ClickUp, etc.', year1: 2000, year2: 2000, year3: 2000 },
];

interface Props {
  rows: BudgetRow[];
  onChange: (rows: BudgetRow[]) => void;
}

const cellBase: React.CSSProperties = {
  padding: '8px 10px', fontSize: '0.75rem', color: C.text,
  borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
  fontFamily: 'inherit', verticalAlign: 'top',
};
const headerCell: React.CSSProperties = {
  ...cellBase, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase',
  letterSpacing: '0.04em', color: '#fff',
  background: '#2d2d3d', position: 'sticky' as const, top: 0, zIndex: 2,
  borderBottom: `2px solid ${PURPLE}`,
};
const numCell: React.CSSProperties = {
  ...cellBase, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.73rem',
};
const totalRow: React.CSSProperties = {
  ...cellBase, fontWeight: 700, background: 'rgba(139,92,246,0.08)',
};
const inputBase: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  color: C.text, fontSize: '0.75rem', fontFamily: 'inherit',
  width: '100%', padding: 0,
};
const numInput: React.CSSProperties = {
  ...inputBase, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.73rem',
};

export default function BudgetBuilder({ rows, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateRow = useCallback((id: string, field: keyof BudgetRow, value: string | number) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, [rows, onChange]);

  const addRow = useCallback((category: string) => {
    onChange([...rows, { id: newRowId(), category, expenseItem: '', budgetNotes: '', year1: 0, year2: 0, year3: 0 }]);
  }, [rows, onChange]);

  const removeRow = useCallback((id: string) => {
    onChange(rows.filter(r => r.id !== id));
  }, [rows, onChange]);

  // Group by category
  const grouped = OTF_CATEGORIES.map(cat => ({
    category: cat,
    rows: rows.filter(r => r.category === cat),
  }));

  const catTotal = (catRows: BudgetRow[], year: 'year1' | 'year2' | 'year3') =>
    catRows.reduce((sum, r) => sum + (r[year] || 0), 0);

  const grandTotal = (year: 'year1' | 'year2' | 'year3') =>
    rows.reduce((sum, r) => sum + (r[year] || 0), 0);

  const gt1 = grandTotal('year1');
  const gt2 = grandTotal('year2');
  const gt3 = grandTotal('year3');
  const gtAll = gt1 + gt2 + gt3;

  return (
    <div>
      {/* Summary strip */}
      <div style={{
        display: 'flex', gap: 0, padding: '0', background: '#1e1e2a',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {[
          { label: 'Year 1', value: gt1, warn: gt1 > 150000 },
          { label: 'Year 2', value: gt2, warn: gt2 > 150000 },
          { label: 'Year 3', value: gt3, warn: gt3 > 150000 },
          { label: 'Total', value: gtAll, warn: false },
          { label: 'Max/Year', value: 150000, warn: false },
        ].map((col, i) => (
          <div key={i} style={{
            flex: 1, padding: '10px 14px', textAlign: 'center',
            borderRight: i < 4 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{ fontSize: '0.55rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>{col.label}</div>
            <div style={{
              fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace',
              color: col.warn ? '#ef4444' : i === 3 ? '#22c55e' : C.text,
            }}>
              {fmtShort(col.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Spreadsheet table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', minWidth: 800,
          tableLayout: 'fixed',
        }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={headerCell}>Budget Category</th>
              <th style={headerCell}>Expense Item</th>
              <th style={headerCell}>Budget Notes</th>
              <th style={{ ...headerCell, textAlign: 'right' }}>Year 1</th>
              <th style={{ ...headerCell, textAlign: 'right' }}>Year 2</th>
              <th style={{ ...headerCell, textAlign: 'right' }}>Year 3</th>
              <th style={{ ...headerCell, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => {
              const ct1 = catTotal(group.rows, 'year1');
              const ct2 = catTotal(group.rows, 'year2');
              const ct3 = catTotal(group.rows, 'year3');
              return (
                <React.Fragment key={group.category}>
                  {/* Category header row */}
                  <tr>
                    <td colSpan={7} style={{
                      ...cellBase, fontWeight: 700, fontSize: '0.72rem',
                      background: 'rgba(139,92,246,0.06)', color: PURPLE,
                      borderRight: 'none', padding: '6px 10px',
                    }}>
                      {group.category}
                      <button
                        onClick={() => addRow(group.category)}
                        style={{
                          marginLeft: 10, background: 'none', border: 'none',
                          color: PURPLE, fontSize: '0.65rem', cursor: 'pointer',
                          fontFamily: 'inherit', fontWeight: 600,
                        }}
                      >+ Add row</button>
                    </td>
                  </tr>

                  {/* Data rows */}
                  {group.rows.map(row => {
                    const rowTotal = (row.year1 || 0) + (row.year2 || 0) + (row.year3 || 0);
                    const isEditing = editingId === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setEditingId(row.id)}
                        style={{
                          cursor: 'pointer',
                          background: isEditing ? 'rgba(139,92,246,0.04)' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isEditing) (e.currentTarget.style.background = 'rgba(255,255,255,0.02)'); }}
                        onMouseLeave={e => { if (!isEditing) (e.currentTarget.style.background = 'transparent'); }}
                      >
                        <td style={{ ...cellBase, fontSize: '0.68rem', color: C.textMuted }}>{row.category}</td>
                        <td style={cellBase}>
                          {isEditing ? (
                            <input value={row.expenseItem} onChange={e => updateRow(row.id, 'expenseItem', e.target.value)} style={inputBase} autoFocus />
                          ) : (
                            row.expenseItem || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Click to edit...</span>
                          )}
                        </td>
                        <td style={{ ...cellBase, fontSize: '0.7rem', color: C.textMuted }}>
                          {isEditing ? (
                            <input value={row.budgetNotes} onChange={e => updateRow(row.id, 'budgetNotes', e.target.value)} style={{ ...inputBase, color: C.textMuted }} />
                          ) : (
                            row.budgetNotes
                          )}
                        </td>
                        <td style={numCell}>
                          {isEditing ? (
                            <input type="number" value={row.year1 || ''} onChange={e => updateRow(row.id, 'year1', Number(e.target.value) || 0)} style={numInput} />
                          ) : (
                            fmt(row.year1)
                          )}
                        </td>
                        <td style={numCell}>
                          {isEditing ? (
                            <input type="number" value={row.year2 || ''} onChange={e => updateRow(row.id, 'year2', Number(e.target.value) || 0)} style={numInput} />
                          ) : (
                            fmt(row.year2)
                          )}
                        </td>
                        <td style={numCell}>
                          {isEditing ? (
                            <input type="number" value={row.year3 || ''} onChange={e => updateRow(row.id, 'year3', Number(e.target.value) || 0)} style={numInput} />
                          ) : (
                            fmt(row.year3)
                          )}
                        </td>
                        <td style={{ ...numCell, fontWeight: 600, color: PURPLE }}>{fmt(rowTotal)}</td>
                      </tr>
                    );
                  })}

                  {/* Category subtotal */}
                  {group.rows.length > 0 && (
                    <tr>
                      <td style={totalRow} />
                      <td style={{ ...totalRow, textAlign: 'right' }} colSpan={2}>Subtotal — {group.category}</td>
                      <td style={{ ...totalRow, ...numCell, fontWeight: 700 }}>{fmt(ct1)}</td>
                      <td style={{ ...totalRow, ...numCell, fontWeight: 700 }}>{fmt(ct2)}</td>
                      <td style={{ ...totalRow, ...numCell, fontWeight: 700 }}>{fmt(ct3)}</td>
                      <td style={{ ...totalRow, ...numCell, fontWeight: 700, color: PURPLE }}>{fmt(ct1 + ct2 + ct3)}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Grand total */}
            <tr>
              <td style={{ ...totalRow, background: 'rgba(34,197,94,0.1)' }} />
              <td style={{ ...totalRow, textAlign: 'right', background: 'rgba(34,197,94,0.1)', fontSize: '0.8rem' }} colSpan={2}>
                TOTAL EXPENSES
              </td>
              <td style={{ ...totalRow, ...numCell, fontWeight: 800, background: 'rgba(34,197,94,0.1)', color: gt1 > 150000 ? '#ef4444' : '#22c55e' }}>{fmt(gt1)}</td>
              <td style={{ ...totalRow, ...numCell, fontWeight: 800, background: 'rgba(34,197,94,0.1)', color: gt2 > 150000 ? '#ef4444' : '#22c55e' }}>{fmt(gt2)}</td>
              <td style={{ ...totalRow, ...numCell, fontWeight: 800, background: 'rgba(34,197,94,0.1)', color: gt3 > 150000 ? '#ef4444' : '#22c55e' }}>{fmt(gt3)}</td>
              <td style={{ ...totalRow, ...numCell, fontWeight: 800, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.85rem' }}>{fmt(gtAll)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DEFAULT_ROWS };
