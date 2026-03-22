import React, { useState, useMemo } from 'react';
import type { FieldDef, RowData } from './types';

// ---------------------------------------------------------------------------
// Calendar View — month grid showing records on their date fields
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  fields: FieldDef[];
  rows: RowData[];
  loading: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  onRowClick: (rowId: string | number) => void;
}

export function NcCalendarView({ fields, rows, loading, colors, isDark, tableColor, onRowClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Find date fields in schema
  const dateFields = useMemo(
    () => fields.filter(f => f.type === 'date'),
    [fields],
  );

  const [activeDateField, setActiveDateField] = useState<string>(
    dateFields[0]?.id || 'created_at',
  );

  const primaryField = fields.find(f => f.primary) || fields[0];

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Build calendar grid (6 rows x 7 cols max)
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  // Map rows to dates
  const rowsByDate = useMemo(() => {
    const map: Record<number, RowData[]> = {};
    for (const row of rows) {
      const dateVal = row[activeDateField];
      if (dateVal == null) continue;
      try {
        const d = new Date(String(dateVal));
        if (isNaN(d.getTime())) continue;
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(row);
        }
      } catch {
        continue;
      }
    }
    return map;
  }, [rows, activeDateField, year, month]);

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
      {/* Calendar header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={prevMonth}
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: 'none', borderRadius: 3, padding: '6px 12px',
              color: colors.text, cursor: 'pointer', fontSize: 16,
            }}
          >
            ‹
          </button>
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 600,
            color: colors.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            minWidth: 200, textAlign: 'center',
          }}>
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: 'none', borderRadius: 3, padding: '6px 12px',
              color: colors.text, cursor: 'pointer', fontSize: 16,
            }}
          >
            ›
          </button>
          <button
            onClick={goToday}
            style={{
              background: `${tableColor}15`,
              border: `1px solid ${tableColor}40`,
              borderRadius: 3, padding: '6px 16px',
              color: tableColor, cursor: 'pointer', fontSize: 12,
              fontWeight: 700, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          >
            Today
          </button>
        </div>

        {/* Date field selector */}
        {dateFields.length > 0 && (
          <select
            value={activeDateField}
            onChange={e => setActiveDateField(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 3,
              border: `1px solid ${borderColor}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              color: colors.text,
              fontSize: 12,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              outline: 'none',
            }}
          >
            {dateFields.map(f => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Day names header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: `1px solid ${borderColor}`,
        marginBottom: 0,
      }}>
        {dayNames.map(d => (
          <div key={d} style={{
            padding: '10px 8px',
            fontSize: 12,
            fontWeight: 700,
            color: colors.textMuted,
            textAlign: 'center',
            /* no transform */
            /* clean label */
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        border: `1px solid ${borderColor}`,
        borderTop: 'none',
      }}>
        {calendarDays.map((day, idx) => {
          const dayRows = day ? (rowsByDate[day] || []) : [];
          const isT = day ? isToday(day) : false;

          return (
            <div
              key={idx}
              style={{
                minHeight: 100,
                padding: 6,
                borderRight: (idx + 1) % 7 !== 0 ? `1px solid ${borderColor}` : 'none',
                borderBottom: `1px solid ${borderColor}`,
                background: day === null
                  ? (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)')
                  : isT
                    ? `${tableColor}08`
                    : 'transparent',
              }}
            >
              {day !== null && (
                <>
                  <div style={{
                    fontSize: 13,
                    fontWeight: isT ? 800 : 500,
                    color: isT ? tableColor : colors.textMuted,
                    marginBottom: 4,
                    width: 28,
                    height: 28,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isT ? `${tableColor}20` : 'transparent',
                  }}>
                    {day}
                  </div>

                  {/* Events / records */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayRows.slice(0, 3).map(row => (
                      <div
                        key={String(row.id)}
                        onClick={() => onRowClick(row.id)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${tableColor}15`,
                          color: tableColor,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s',
                          borderLeft: `2px solid ${tableColor}`,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${tableColor}25`}
                        onMouseLeave={e => e.currentTarget.style.background = `${tableColor}15`}
                      >
                        {String(row[primaryField?.id || 'title'] || row.name || row.id)}
                      </div>
                    ))}
                    {dayRows.length > 3 && (
                      <span style={{ fontSize: 10, color: colors.textMuted, paddingLeft: 6 }}>
                        +{dayRows.length - 3} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginTop: 16,
        fontSize: 12,
        color: colors.textMuted,
      }}>
        <span>
          {Object.values(rowsByDate).reduce((sum, arr) => sum + arr.length, 0)} records visible in {monthNames[month]}
        </span>
        {dateFields.length === 0 && (
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>
            ⚠ No date fields found — showing by created_at
          </span>
        )}
      </div>
    </div>
  );
}
