import React, { useState, useCallback } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';
const GREEN = '#22c55e';

// ── OTF Grassroots Project Plan Format ──
// Columns: Year | Project Deliverable | Major Activity | When | Frequency | How Many Youth | Expense Items | Other Resources

export interface ProjectPlanRow {
  id: string;
  year: number;
  deliverable: string;
  majorActivity: string;
  when: string;
  frequency: string;
  youthCount: string;
  expenseItems: string;
  otherResources: string;
}

let rowCounter = 0;
function newRowId() { return `pp-${++rowCounter}`; }

// Pre-populated with Street Voices' previous OTF project plan
const DEFAULT_ROWS: ProjectPlanRow[] = [
  {
    id: newRowId(), year: 1, deliverable: 'Project Planning | Prep Time',
    majorActivity: 'Secure venue, confirm program start dates, develop comprehensive schedule with workshop topics and facilitator assignments. Marketing strategy and promotional materials. Intake forms and registration.',
    when: 'Nov 2025 – Feb 2026', frequency: '2x weekly', youthCount: '5',
    expenseItems: 'Staff Time (Media Team, ED, Admin, PM, Social Media, Designer)', otherResources: 'Volunteer Time',
  },
  {
    id: newRowId(), year: 1, deliverable: 'Resource Development | Partnership & Networking',
    majorActivity: 'Core Media Training Team establishes partnerships with community organizations, schools, and cultural institutions. Outreach to potential guest speakers and mentors.',
    when: 'Nov 2025 – Feb 2026', frequency: 'Ongoing', youthCount: '5',
    expenseItems: 'Staff Time, Transportation', otherResources: 'Partner in-kind',
  },
  {
    id: newRowId(), year: 1, deliverable: 'Media Training Program — Cohort 1',
    majorActivity: 'Deliver 8-week media training program: workshops on videography, podcasting, digital marketing, networking, public speaking, and content creation. Hands-on projects with professional equipment.',
    when: 'Mar 2026 – May 2026', frequency: '2 sessions/week', youthCount: '16',
    expenseItems: 'Facilitator fees, Equipment, Food, Transportation, Honorariums', otherResources: 'Guest speakers',
  },
  {
    id: newRowId(), year: 1, deliverable: 'Media Training Program — Cohort 2',
    majorActivity: 'Second cohort of 8-week media training with refined curriculum based on Cohort 1 feedback.',
    when: 'Jun 2026 – Aug 2026', frequency: '2 sessions/week', youthCount: '16',
    expenseItems: 'Facilitator fees, Equipment, Food, Transportation, Honorariums', otherResources: 'Guest speakers',
  },
  {
    id: newRowId(), year: 1, deliverable: 'Showcase & Evaluation',
    majorActivity: 'End-of-year showcase event for participants to present media projects. Program evaluation surveys and data collection.',
    when: 'Sep 2026 – Oct 2026', frequency: '1 event', youthCount: '32',
    expenseItems: 'Venue, Food, Certificates, Marketing', otherResources: 'Partner venues',
  },
  {
    id: newRowId(), year: 2, deliverable: 'Year 2 — Program Scaling',
    majorActivity: 'Expand to 18 participants per cohort. Deepen curriculum with advanced modules. Additional guest speakers and industry mentors.',
    when: 'Nov 2026 – Oct 2027', frequency: '2 sessions/week', youthCount: '36',
    expenseItems: 'All staffing, equipment, food, transport, honorariums', otherResources: 'Industry partners',
  },
  {
    id: newRowId(), year: 3, deliverable: 'Year 3 — Sustainability & Legacy',
    majorActivity: 'Continued delivery with focus on alumni mentorship pipeline. Documentation of program model for replication. Final evaluation and reporting.',
    when: 'Nov 2027 – Oct 2028', frequency: '2 sessions/week', youthCount: '36',
    expenseItems: 'All staffing, equipment, food, transport, honorariums', otherResources: 'Alumni network',
  },
];

const cellBase: React.CSSProperties = {
  padding: '8px 10px', fontSize: '0.73rem', color: C.text,
  borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
  fontFamily: 'inherit', verticalAlign: 'top', lineHeight: 1.5,
};
const headerCell: React.CSSProperties = {
  ...cellBase, fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase',
  letterSpacing: '0.04em', color: '#fff',
  background: '#2d2d3d', position: 'sticky' as const, top: 0, zIndex: 2,
  borderBottom: `2px solid ${GREEN}`,
};
const inputBase: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  color: C.text, fontSize: '0.73rem', fontFamily: 'inherit',
  width: '100%', padding: 0, lineHeight: 1.5,
};
const yearBadge = (year: number): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: '50%', fontWeight: 800, fontSize: '0.7rem',
  background: year === 1 ? 'rgba(59,130,246,0.2)' : year === 2 ? 'rgba(139,92,246,0.2)' : 'rgba(34,197,94,0.2)',
  color: year === 1 ? '#3b82f6' : year === 2 ? PURPLE : GREEN,
});

interface Props {
  rows: ProjectPlanRow[];
  onChange: (rows: ProjectPlanRow[]) => void;
}

export default function ProjectPlanBuilder({ rows, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateRow = useCallback((id: string, field: keyof ProjectPlanRow, value: string | number) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, [rows, onChange]);

  const addRow = useCallback((year: number) => {
    onChange([...rows, { id: newRowId(), year, deliverable: '', majorActivity: '', when: '', frequency: '', youthCount: '', expenseItems: '', otherResources: '' }]);
  }, [rows, onChange]);

  const removeRow = useCallback((id: string) => {
    onChange(rows.filter(r => r.id !== id));
  }, [rows, onChange]);

  // Group by year
  const years = [1, 2, 3];
  const grouped = years.map(y => ({ year: y, rows: rows.filter(r => r.year === y) }));

  return (
    <div>
      {/* Summary strip */}
      <div style={{
        display: 'flex', gap: 0, padding: '0', background: '#1e1e2a',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {years.map(y => {
          const yRows = rows.filter(r => r.year === y);
          const totalYouth = yRows.reduce((sum, r) => sum + (parseInt(r.youthCount) || 0), 0);
          return (
            <div key={y} style={{
              flex: 1, padding: '10px 14px', textAlign: 'center',
              borderRight: y < 3 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Year {y}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{yRows.length} activities</div>
              <div style={{ fontSize: '0.65rem', color: C.textMuted }}>{totalYouth} youth</div>
            </div>
          );
        })}
        <div style={{ flex: 1, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.55rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Total</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: GREEN }}>{rows.length} activities</div>
          <div style={{ fontSize: '0.65rem', color: C.textMuted }}>
            {rows.reduce((sum, r) => sum + (parseInt(r.youthCount) || 0), 0)} youth
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={headerCell}>Year</th>
              <th style={headerCell}>Project Deliverable</th>
              <th style={headerCell}>Major Activity</th>
              <th style={headerCell}>When</th>
              <th style={headerCell}>Frequency</th>
              <th style={headerCell}>Youth #</th>
              <th style={headerCell}>Expense Items</th>
              <th style={headerCell}>Other Resources</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => (
              <React.Fragment key={group.year}>
                {/* Year divider */}
                <tr>
                  <td colSpan={8} style={{
                    ...cellBase, fontWeight: 700, fontSize: '0.72rem',
                    background: group.year === 1 ? 'rgba(59,130,246,0.06)' : group.year === 2 ? 'rgba(139,92,246,0.06)' : 'rgba(34,197,94,0.06)',
                    color: group.year === 1 ? '#3b82f6' : group.year === 2 ? PURPLE : GREEN,
                    borderRight: 'none', padding: '6px 10px',
                  }}>
                    Year {group.year}
                    <button
                      onClick={() => addRow(group.year)}
                      style={{
                        marginLeft: 10, background: 'none', border: 'none',
                        color: 'inherit', fontSize: '0.65rem', cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: 600,
                      }}
                    >+ Add activity</button>
                  </td>
                </tr>

                {group.rows.map(row => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setEditingId(row.id)}
                      style={{
                        cursor: 'pointer',
                        background: isEditing ? 'rgba(139,92,246,0.04)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = isEditing ? 'rgba(139,92,246,0.04)' : 'transparent'; }}
                    >
                      <td style={{ ...cellBase, textAlign: 'center' }}>
                        <div style={yearBadge(row.year)}>{row.year}</div>
                      </td>
                      <td style={{ ...cellBase, fontWeight: 600, fontSize: '0.72rem' }}>
                        {isEditing ? <input value={row.deliverable} onChange={e => updateRow(row.id, 'deliverable', e.target.value)} style={{ ...inputBase, fontWeight: 600 }} /> : row.deliverable}
                      </td>
                      <td style={{ ...cellBase, fontSize: '0.7rem', color: C.textSecondary }}>
                        {isEditing ? <textarea value={row.majorActivity} onChange={e => updateRow(row.id, 'majorActivity', e.target.value)} rows={3} style={{ ...inputBase, resize: 'vertical' }} /> : row.majorActivity}
                      </td>
                      <td style={{ ...cellBase, fontSize: '0.68rem' }}>
                        {isEditing ? <input value={row.when} onChange={e => updateRow(row.id, 'when', e.target.value)} style={inputBase} /> : row.when}
                      </td>
                      <td style={{ ...cellBase, fontSize: '0.68rem' }}>
                        {isEditing ? <input value={row.frequency} onChange={e => updateRow(row.id, 'frequency', e.target.value)} style={inputBase} /> : row.frequency}
                      </td>
                      <td style={{ ...cellBase, textAlign: 'center', fontWeight: 600, color: GREEN }}>
                        {isEditing ? <input value={row.youthCount} onChange={e => updateRow(row.id, 'youthCount', e.target.value)} style={{ ...inputBase, textAlign: 'center' }} /> : row.youthCount}
                      </td>
                      <td style={{ ...cellBase, fontSize: '0.68rem', color: C.textMuted }}>
                        {isEditing ? <input value={row.expenseItems} onChange={e => updateRow(row.id, 'expenseItems', e.target.value)} style={{ ...inputBase, color: C.textMuted }} /> : row.expenseItems}
                      </td>
                      <td style={{ ...cellBase, fontSize: '0.68rem', color: C.textMuted }}>
                        {isEditing ? <input value={row.otherResources} onChange={e => updateRow(row.id, 'otherResources', e.target.value)} style={{ ...inputBase, color: C.textMuted }} /> : row.otherResources}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DEFAULT_ROWS as DEFAULT_PLAN_ROWS };
