import React, { useMemo } from 'react';
import type { FieldDef, RowData } from './types';
import { NcCell } from './NcCellRenderer';

// ---------------------------------------------------------------------------
// Airtable-style Gallery View — image-forward card grid
// ---------------------------------------------------------------------------

interface GalleryProps {
  fields: FieldDef[];
  rows: RowData[];
  loading: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
  onRowClick: (rowId: string | number) => void;
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Find the first image field that has a value in this row */
function findImageUrl(row: RowData, fields: FieldDef[]): string | null {
  // Check explicit image fields first
  for (const f of fields) {
    if (f.type === 'image' && row[f.id]) return String(row[f.id]);
  }
  // Fallback: check common image key patterns in the raw row data
  const imgKeys = ['image_url', 'feature_image_url', 'logo_url', 'avatar_url', 'cover_image',
    'cover_image_url', 'thumbnail_url', 'photo_url', 'banner_url', 'og_image_url'];
  for (const k of imgKeys) {
    if (row[k] && typeof row[k] === 'string') return row[k] as string;
  }
  return null;
}

export function NcGallery({ fields, rows, loading, colors, isDark, tableColor, onRowClick }: GalleryProps) {
  const primaryField = fields.find(f => f.primary) || fields[0];
  // Non-primary, non-image fields for card body
  const displayFields = useMemo(() =>
    fields.filter(f => !f.primary && f.type !== 'image').slice(0, 6),
    [fields],
  );
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  // Check if any rows have images to determine card layout
  const hasImages = useMemo(() =>
    rows.some(r => findImageUrl(r, fields) !== null),
    [rows, fields],
  );

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: colors.textMuted, fontFamily: FONT }}>
        Loading records…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: FONT }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>▦</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>No records</div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>Try adjusting filters</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasImages
          ? 'repeat(auto-fill, minmax(300px, 1fr))'
          : 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        padding: 20,
        fontFamily: FONT,
      }}>
        {rows.map((row) => {
          const primaryVal = String(row[primaryField?.id || 'title'] || row.name || row.id);
          const imageUrl = findImageUrl(row, fields);

          return (
            <div
              key={row.id}
              onClick={() => onRowClick(row.id)}
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = tableColor;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = isDark
                  ? `0 8px 32px rgba(0,0,0,0.4)`
                  : `0 8px 24px rgba(0,0,0,0.1)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = borderColor;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Hero image */}
              {imageUrl ? (
                <div style={{
                  width: '100%',
                  height: 180,
                  overflow: 'hidden',
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  <img
                    src={imageUrl}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                /* Color accent bar when no image */
                <div style={{
                  height: 4,
                  background: `linear-gradient(90deg, ${tableColor}, ${tableColor}60)`,
                  flexShrink: 0,
                }} />
              )}

              {/* Card content */}
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Primary field as title */}
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: colors.text,
                  marginBottom: 12,
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {primaryVal}
                </div>

                {/* Field rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {displayFields.map(f => {
                    const val = row[f.id];
                    if (val === undefined || val === null || val === '') return null;
                    return (
                      <div key={f.id} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        minHeight: 20,
                      }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: colors.textMuted,
                          minWidth: 72,
                          flexShrink: 0,
                          lineHeight: '20px',
                        }}>
                          {f.title}
                        </span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <NcCell field={f} row={row} colors={colors} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Record count footer */}
      <div style={{
        padding: '12px 20px 20px',
        fontSize: 12,
        color: colors.textMuted,
        fontFamily: FONT,
      }}>
        {rows.length} record{rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
