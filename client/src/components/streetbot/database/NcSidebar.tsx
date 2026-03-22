import React, { useState } from 'react';
import type { ViewType, SavedView } from './types';

// ---------------------------------------------------------------------------
// Airtable-style View Sidebar — shows views for the current table
// ---------------------------------------------------------------------------

interface SidebarProps {
  viewType: ViewType;
  setViewType: (v: ViewType) => void;
  savedViews: SavedView[];
  onLoadView: (viewId: string) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (viewId: string) => void;
  onRenameView: (viewId: string, name: string) => void;
  colors: Record<string, string>;
  isDark: boolean;
  tableColor: string;
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const VIEW_ICONS: Record<ViewType, string> = {
  grid: '⊞',
  gallery: '▦',
  kanban: '▥',
  calendar: '📅',
  form: '☐',
};

const VIEW_LABELS: Record<ViewType, string> = {
  grid: 'Grid view',
  gallery: 'Gallery view',
  kanban: 'Kanban view',
  calendar: 'Calendar view',
  form: 'Form view',
};

export function NcSidebar({
  viewType, setViewType, savedViews, onLoadView, onSaveView,
  onDeleteView, onRenameView, colors, isDark, tableColor,
}: SidebarProps) {
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5';
  const [viewSearch, setViewSearch] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewType, setNewViewType] = useState<ViewType>('grid');
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Default views (one per type)
  const defaultViews: { type: ViewType; label: string; icon: string }[] = [
    { type: 'grid', label: 'Grid view', icon: '⊞' },
    { type: 'gallery', label: 'Gallery view', icon: '▦' },
    { type: 'kanban', label: 'Kanban view', icon: '▥' },
    { type: 'calendar', label: 'Calendar view', icon: '📅' },
    { type: 'form', label: 'Form view', icon: '☐' },
  ];

  // Filter views by search
  const filteredDefaults = defaultViews.filter(v =>
    !viewSearch || v.label.toLowerCase().includes(viewSearch.toLowerCase())
  );
  const filteredSaved = savedViews.filter(v =>
    !viewSearch || v.name.toLowerCase().includes(viewSearch.toLowerCase())
  );

  const activeItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 3,
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'background 0.1s',
    background: isActive
      ? (isDark ? 'rgba(45,127,249,0.15)' : 'rgba(45,127,249,0.08)')
      : 'transparent',
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? (isDark ? '#5b9bf9' : '#2d7ff9') : colors.textSecondary,
  });

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      height: '100%',
      borderRight: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: isDark ? '#1b1b25' : '#f8f8f8',
      fontFamily: FONT,
    }}>
      {/* Create new button */}
      <div style={{ padding: '10px 10px 4px' }}>
        <button
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: '7px 10px',
            borderRadius: 3,
            border: `1px solid ${borderColor}`,
            background: 'transparent',
            color: colors.text,
            fontSize: 13,
            fontWeight: 500,
            fontFamily: FONT,
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 14, fontWeight: 300 }}>+</span>
          Create new...
        </button>
      </div>

      {/* Create new view panel */}
      {showCreateMenu && (
        <div style={{
          margin: '4px 10px 8px',
          padding: 10,
          borderRadius: 4,
          border: `1px solid ${borderColor}`,
          background: isDark ? '#22222e' : '#fff',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>
            New view
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {(['grid', 'gallery', 'kanban', 'calendar', 'form'] as ViewType[]).map(t => (
              <button
                key={t}
                onClick={() => setNewViewType(t)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 3,
                  border: 'none',
                  background: newViewType === t ? 'rgba(45,127,249,0.15)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'),
                  color: newViewType === t ? '#2d7ff9' : colors.textMuted,
                  fontSize: 11,
                  fontWeight: newViewType === t ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                {VIEW_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={newViewName}
              onChange={e => setNewViewName(e.target.value)}
              placeholder="View name..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && newViewName.trim()) {
                  onSaveView(newViewName.trim());
                  setNewViewName('');
                  setShowCreateMenu(false);
                }
                if (e.key === 'Escape') setShowCreateMenu(false);
              }}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: 3,
                border: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                color: colors.text,
                fontSize: 12,
                fontFamily: FONT,
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (newViewName.trim()) {
                  onSaveView(newViewName.trim());
                  setNewViewName('');
                  setShowCreateMenu(false);
                }
              }}
              disabled={!newViewName.trim()}
              style={{
                padding: '5px 10px',
                borderRadius: 3,
                border: 'none',
                background: newViewName.trim() ? '#2d7ff9' : (isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'),
                color: newViewName.trim() ? '#fff' : colors.textMuted,
                fontSize: 12,
                fontWeight: 600,
                cursor: newViewName.trim() ? 'pointer' : 'default',
                fontFamily: FONT,
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Search views */}
      <div style={{ padding: '4px 10px 8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 8px',
          borderRadius: 3,
          border: `1px solid ${borderColor}`,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        }}>
          <span style={{ fontSize: 11, color: colors.textMuted }}>🔍</span>
          <input
            type="text"
            value={viewSearch}
            onChange={e => setViewSearch(e.target.value)}
            placeholder="Find a view"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: 12,
              fontFamily: FONT,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Views list */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 8px',
      }}>
        {/* Default views */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filteredDefaults.map(v => {
            const isActive = viewType === v.type && !savedViews.some(sv => sv.type === v.type);
            return (
              <button
                key={v.type}
                onClick={() => setViewType(v.type)}
                style={activeItemStyle(isActive)}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = isDark
                    ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 13, width: 18, textAlign: 'center', opacity: 0.7 }}>
                  {v.icon}
                </span>
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Saved views */}
        {filteredSaved.length > 0 && (
          <>
            <div style={{
              height: 1,
              background: borderColor,
              margin: '8px 4px',
            }} />
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: colors.textMuted,
              padding: '4px 10px 4px',
            }}>
              Saved views
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredSaved.map(sv => (
                <div
                  key={sv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => onLoadView(sv.id)}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 12, width: 18, textAlign: 'center', opacity: 0.6 }}>
                    {VIEW_ICONS[sv.type] || '⊞'}
                  </span>
                  {editingViewId === sv.id ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRenameView(sv.id, editName); setEditingViewId(null); }
                        if (e.key === 'Escape') setEditingViewId(null);
                      }}
                      onBlur={() => { onRenameView(sv.id, editName); setEditingViewId(null); }}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      style={{
                        flex: 1, padding: '2px 6px', borderRadius: 3,
                        border: `1px solid #2d7ff9`, background: 'transparent',
                        color: colors.text, fontSize: 12, fontFamily: FONT, outline: 'none',
                      }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>{sv.name}</span>
                  )}
                  <span style={{ fontSize: 10, color: colors.textMuted }}>
                    {sv.filters.length > 0 ? `${sv.filters.length}f` : ''} {sv.sorts.length > 0 ? `${sv.sorts.length}s` : ''}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingViewId(sv.id); setEditName(sv.name); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 10, padding: '0 2px' }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteView(sv.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 10, padding: '0 2px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
