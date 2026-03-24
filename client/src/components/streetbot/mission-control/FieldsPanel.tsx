import React, { useState, useRef, useEffect } from 'react';
import {
  X, Search, ChevronDown, Hash, Type, Calendar, AlignLeft,
  Tag, Vote, MousePointerClick, CheckSquare, Mail, Paperclip,
  FunctionSquare, ListFilter, MapPin, DollarSign, Users,
  Phone, BarChart3, Star, Link2, Globe, Clock, Percent,
} from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';

const C = DEFAULT_COLORS;

// ── Field definitions ──

export interface FieldDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  category: 'popular' | 'all';
  defaultWidth?: number;
}

export const ALL_FIELDS: FieldDef[] = [
  // Popular
  { id: 'dropdown', label: 'Dropdown', icon: <ListFilter size={15} />, iconColor: '#5A9AEF', category: 'popular', defaultWidth: 120 },
  { id: 'text', label: 'Text', icon: <Type size={15} />, iconColor: '#E8833A', category: 'popular', defaultWidth: 140 },
  { id: 'date', label: 'Date', icon: <Calendar size={15} />, iconColor: '#D9534F', category: 'popular', defaultWidth: 100 },
  { id: 'textarea', label: 'Text area (Long Text)', icon: <AlignLeft size={15} />, iconColor: '#7B68EE', category: 'popular', defaultWidth: 200 },
  { id: 'labels', label: 'Labels', icon: <Tag size={15} />, iconColor: '#22c55e', category: 'popular', defaultWidth: 120 },
  { id: 'number', label: 'Number', icon: <Hash size={15} />, iconColor: '#5A9AEF', category: 'popular', defaultWidth: 80 },
  { id: 'voting', label: 'Voting', icon: <Vote size={15} />, iconColor: '#6F42C1', category: 'popular', defaultWidth: 80 },
  { id: 'button', label: 'Button', icon: <MousePointerClick size={15} />, iconColor: '#D980FA', category: 'popular', defaultWidth: 100 },
  // All
  { id: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={15} />, iconColor: '#E74C3C', category: 'all', defaultWidth: 80 },
  { id: 'email', label: 'Email', icon: <Mail size={15} />, iconColor: '#E74C3C', category: 'all', defaultWidth: 160 },
  { id: 'files', label: 'Files', icon: <Paperclip size={15} />, iconColor: '#6b7280', category: 'all', defaultWidth: 100 },
  { id: 'formula', label: 'Formula', icon: <FunctionSquare size={15} />, iconColor: '#5A9AEF', category: 'all', defaultWidth: 120 },
  { id: 'location', label: 'Location', icon: <MapPin size={15} />, iconColor: '#E74C3C', category: 'all', defaultWidth: 140 },
  { id: 'money', label: 'Money', icon: <DollarSign size={15} />, iconColor: '#22c55e', category: 'all', defaultWidth: 100 },
  { id: 'people', label: 'People', icon: <Users size={15} />, iconColor: '#5A9AEF', category: 'all', defaultWidth: 120 },
  { id: 'phone', label: 'Phone', icon: <Phone size={15} />, iconColor: '#22c55e', category: 'all', defaultWidth: 120 },
  { id: 'progress', label: 'Progress', icon: <BarChart3 size={15} />, iconColor: '#eab308', category: 'all', defaultWidth: 100 },
  { id: 'rating', label: 'Rating', icon: <Star size={15} />, iconColor: '#eab308', category: 'all', defaultWidth: 100 },
  { id: 'relationship', label: 'Relationship', icon: <Link2 size={15} />, iconColor: '#7B68EE', category: 'all', defaultWidth: 120 },
  { id: 'website', label: 'Website', icon: <Globe size={15} />, iconColor: '#5A9AEF', category: 'all', defaultWidth: 160 },
  { id: 'time_tracking', label: 'Time Tracking', icon: <Clock size={15} />, iconColor: '#5A9AEF', category: 'all', defaultWidth: 100 },
  { id: 'percent', label: 'Percent', icon: <Percent size={15} />, iconColor: '#E8833A', category: 'all', defaultWidth: 80 },
];

// ── Default visible columns (built-in, always available) ──

export const BUILT_IN_COLUMNS = ['assignee', 'due_date', 'priority'] as const;

// ── Fields Panel Component ──

interface FieldsPanelProps {
  position: { x: number; y: number };
  activeFields: string[];
  onToggleField: (fieldId: string) => void;
  onClose: () => void;
}

export default function FieldsPanel({ position, activeFields, onToggleField, onClose }: FieldsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'create' | 'existing'>('create');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Adjust position
  const [adj, setAdj] = useState(position);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setAdj({ x, y });
  }, [position]);

  const filtered = ALL_FIELDS.filter(f =>
    f.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const popular = filtered.filter(f => f.category === 'popular');
  const all = filtered.filter(f => f.category === 'all');

  return (
    <div ref={ref} style={{
      position: 'fixed', top: adj.y, left: adj.x, zIndex: 9999,
      width: 280, maxHeight: 520, borderRadius: 12,
      background: '#1e1e2a', border: `1px solid ${C.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>Fields</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.textMuted, display: 'flex', padding: 2, borderRadius: 4,
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.border}`,
        }}>
          <Search size={14} color={C.textMuted} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search for new or existing fields"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontSize: '0.78rem', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${C.border}`,
        padding: '0 12px',
      }}>
        {(['create', 'existing'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: tab === t ? C.text : C.textMuted,
              fontSize: '0.78rem', fontWeight: 600,
              borderBottom: tab === t ? `2px solid ${C.text}` : '2px solid transparent',
              transition: 'color 0.12s',
            }}
          >
            {t === 'create' ? 'Create new' : 'Add existing'}
          </button>
        ))}
      </div>

      {/* Field list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {tab === 'create' ? (
          <>
            {popular.length > 0 && (
              <>
                <div style={{
                  padding: '8px 16px 4px', fontSize: '0.65rem', fontWeight: 600,
                  color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  Popular
                </div>
                {popular.map(field => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    isActive={activeFields.includes(field.id)}
                    onToggle={() => onToggleField(field.id)}
                  />
                ))}
              </>
            )}
            {all.length > 0 && (
              <>
                <div style={{
                  padding: '12px 16px 4px', fontSize: '0.65rem', fontWeight: 600,
                  color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  All
                </div>
                {all.map(field => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    isActive={activeFields.includes(field.id)}
                    onToggle={() => onToggleField(field.id)}
                  />
                ))}
              </>
            )}
            {popular.length === 0 && all.length === 0 && (
              <div style={{ padding: '20px 16px', color: C.textMuted, fontSize: '0.78rem', textAlign: 'center' }}>
                No fields match your search
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '20px 16px', color: C.textMuted, fontSize: '0.78rem', textAlign: 'center' }}>
            {activeFields.length > 0 ? (
              <>
                <div style={{ marginBottom: 8, fontWeight: 600, color: C.text }}>Active custom fields</div>
                {activeFields.map(id => {
                  const field = ALL_FIELDS.find(f => f.id === id);
                  if (!field) return null;
                  return (
                    <FieldRow
                      key={id}
                      field={field}
                      isActive={true}
                      onToggle={() => onToggleField(id)}
                    />
                  );
                })}
              </>
            ) : (
              'No custom fields added yet. Use "Create new" to add fields.'
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Field row ──

function FieldRow({ field, isActive, onToggle }: {
  field: FieldDef;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 16px', border: 'none', cursor: 'pointer',
        background: 'transparent', color: C.text,
        fontSize: '0.8rem', fontWeight: 500,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'flex', color: field.iconColor }}>{field.icon}</span>
      <span style={{ flex: 1, textAlign: 'left' }}>{field.label}</span>
      {isActive ? (
        <span style={{
          fontSize: '0.65rem', fontWeight: 600, color: '#ef4444',
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(239,68,68,0.1)',
        }}>
          Remove
        </span>
      ) : (
        <span style={{
          fontSize: '0.65rem', fontWeight: 600, color: C.accent,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(255,214,0,0.1)',
        }}>
          Create
        </span>
      )}
    </button>
  );
}
