import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, FolderOpen, Folder,
  LayoutGrid, Bot, Plus, MoreHorizontal, ListTodo, X,
  Pencil, Trash2, Star, Link2, Palette, Zap, Settings2,
  Info, Copy, Archive, FolderInput, CircleDot, Mail,
  FileText, MoreVertical, Layers, Timer, Hash, Target,
  Heart, Flame, Bookmark, Flag, Shield, Globe, Music,
  Camera, Coffee, Cpu, Database, Gift, Home, Key,
  Map, Package, Phone, Search, Send, Tag, Users,
  Briefcase, Calendar,
} from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';
import type { ClickUpSpace, ClickUpFolder, ClickUpList } from './types';

const C = DEFAULT_COLORS;

// ── Color palette for Color & Icon submenu ──
const COLOR_SWATCHES = [
  '#808080', '#D9534F', '#E8833A', '#F0AD4E', '#FFD600',
  '#5CB85C', '#49B6D6', '#5A9AEF', '#7B68EE', '#D980FA',
  '#FF6B81', '#2ED8A3', '#17A2B8', '#6F42C1', '#E83E8C',
  '#FD7E14', '#20C997', '#6610F2', '#E74C3C', '#1ABC9C',
];

// ── Icons for the icon picker ──
const ICON_OPTIONS: { icon: React.ReactNode; name: string }[] = [
  { icon: <ListTodo size={16} />, name: 'list' },
  { icon: <Target size={16} />, name: 'target' },
  { icon: <Star size={16} />, name: 'star' },
  { icon: <Heart size={16} />, name: 'heart' },
  { icon: <Flame size={16} />, name: 'flame' },
  { icon: <Bookmark size={16} />, name: 'bookmark' },
  { icon: <Flag size={16} />, name: 'flag' },
  { icon: <Shield size={16} />, name: 'shield' },
  { icon: <Globe size={16} />, name: 'globe' },
  { icon: <Music size={16} />, name: 'music' },
  { icon: <Camera size={16} />, name: 'camera' },
  { icon: <Coffee size={16} />, name: 'coffee' },
  { icon: <Cpu size={16} />, name: 'cpu' },
  { icon: <Database size={16} />, name: 'database' },
  { icon: <Gift size={16} />, name: 'gift' },
  { icon: <Home size={16} />, name: 'home' },
  { icon: <Key size={16} />, name: 'key' },
  { icon: <Map size={16} />, name: 'map' },
  { icon: <Package size={16} />, name: 'package' },
  { icon: <Phone size={16} />, name: 'phone' },
  { icon: <Send size={16} />, name: 'send' },
  { icon: <Tag size={16} />, name: 'tag' },
  { icon: <Users size={16} />, name: 'users' },
  { icon: <Briefcase size={16} />, name: 'briefcase' },
];

// ── Inline name input ──

function InlineNameInput({ placeholder, initialValue, onSubmit, onCancel }: {
  placeholder: string;
  initialValue?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue || '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    if (initialValue) ref.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
    else if (e.key === 'Escape') onCancel();
  };

  return (
    <div style={{ padding: '3px 12px 3px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        ref={ref} type="text" placeholder={placeholder} value={value}
        onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => { if (!value.trim()) onCancel(); }, 150)}
        style={{
          flex: 1, padding: '5px 8px', borderRadius: 4, fontSize: '0.75rem',
          background: C.surface, border: `1px solid ${C.accent}`, color: C.text,
          outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button onMouseDown={e => e.preventDefault()} onClick={() => { if (value.trim()) onSubmit(value.trim()); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: value.trim() ? C.accent : C.textMuted }}>
        <Plus size={14} />
      </button>
      <button onMouseDown={e => e.preventDefault()} onClick={onCancel}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: C.textMuted }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ── Small icon buttons ──

function IconButton({ onClick, title, children }: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(e); }}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 2, borderRadius: 4, display: 'flex',
        color: C.textMuted, transition: 'color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.sidebarHover; }}
      onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'none'; }}
    >
      {children}
    </button>
  );
}

// ── Menu item types ──

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hasSubmenu?: boolean;
  footer?: boolean; // renders as a styled footer button
  onClick: () => void;
}

type MenuEntry = MenuItem | 'divider';

// ── Color & Icon Submenu ──

function ColorIconSubmenu({ position, onClose, onSelectColor, onSelectIcon, currentColor, currentIcon }: {
  position: { x: number; y: number };
  onClose: () => void;
  onSelectColor: (color: string) => void;
  onSelectIcon: (icon: string) => void;
  currentColor?: string;
  currentIcon?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const [adj, setAdj] = useState(position);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - 8) x = position.x - rect.width - 200;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setAdj({ x, y });
  }, [position]);

  return (
    <div ref={ref} style={{
      position: 'fixed', top: adj.y, left: adj.x, zIndex: 10000,
      width: 240, padding: '12px', borderRadius: 10,
      background: '#1e1e2a', border: `1px solid ${C.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
    }}>
      {/* Color section */}
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Color
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
        {COLOR_SWATCHES.map(color => (
          <button
            key={color}
            onClick={() => { onSelectColor(color); onClose(); }}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: color,
              outline: currentColor === color ? `2px solid ${C.text}` : 'none',
              outlineOffset: 2,
              transition: 'transform 0.1s, outline 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          />
        ))}
      </div>

      <div style={{ height: 1, background: C.border, margin: '4px 0 12px' }} />

      {/* Icon section */}
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Icon
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
        {ICON_OPTIONS.map(opt => (
          <button
            key={opt.name}
            onClick={() => { onSelectIcon(opt.name); onClose(); }}
            style={{
              width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: currentIcon === opt.name ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: currentIcon === opt.name ? C.accent : C.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = currentIcon === opt.name ? 'rgba(255,255,255,0.1)' : 'transparent'; e.currentTarget.style.color = currentIcon === opt.name ? C.accent : C.textSecondary; }}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Context menu with sections, dividers, and submenu arrows ──

function ContextMenu({ items, position, onClose, onOpenColorIcon }: {
  items: MenuEntry[];
  position: { x: number; y: number };
  onClose: () => void;
  onOpenColorIcon?: (pos: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const [adjusted, setAdjusted] = useState({ x: position.x, y: position.y });
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setAdjusted({ x, y });
  }, [position]);

  return (
    <div ref={ref} style={{
      position: 'fixed', top: adjusted.y, left: adjusted.x, zIndex: 9999,
      minWidth: 220, padding: '4px 0', borderRadius: 10,
      background: '#1e1e2a', border: `1px solid ${C.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
    }}>
      {items.map((item, i) => {
        if (item === 'divider') {
          return <div key={`d-${i}`} style={{ height: 1, background: C.border, margin: '4px 8px' }} />;
        }

        // Footer button (e.g. "Sharing & Permissions")
        if (item.footer) {
          return (
            <div key={i} style={{ padding: '6px 10px 6px' }}>
              <button
                onClick={() => { item.onClick(); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: C.text, fontSize: '0.78rem', fontWeight: 600,
                  cursor: item.disabled ? 'default' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  transition: 'background 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => {
                  if (!item.disabled) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          );
        }

        const isColorIcon = item.label === 'Color & Icon' || item.label === 'Folder color';
        return (
          <button
            key={i}
            onClick={(e) => {
              if (item.disabled && !isColorIcon) return;
              if (isColorIcon && onOpenColorIcon) {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenColorIcon({ x: rect.right + 4, y: rect.top });
                return;
              }
              item.onClick();
              onClose();
            }}
            onMouseEnter={(e) => {
              if (!item.disabled || isColorIcon) {
                e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)';
              }
              if (isColorIcon && onOpenColorIcon) {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenColorIcon({ x: rect.right + 4, y: rect.top });
              }
            }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 14px', border: 'none',
              cursor: (item.disabled && !isColorIcon) ? 'default' : 'pointer',
              background: 'transparent',
              color: item.danger ? '#ef4444' : (item.disabled && !isColorIcon) ? 'rgba(255,255,255,0.3)' : C.text,
              fontSize: '0.78rem', fontWeight: 500,
              opacity: (item.disabled && !isColorIcon) ? 0.5 : 1,
              transition: 'background 0.1s',
            }}
          >
            <span style={{ display: 'flex', width: 16, justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.hasSubmenu && (
              <ChevronRight size={12} color={C.textMuted} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Custom style storage ──

interface ListStyle {
  color?: string;
  icon?: string;
}

function loadStyles(): Record<string, ListStyle> {
  try { return JSON.parse(localStorage.getItem('sv-list-styles') || '{}'); }
  catch { return {}; }
}

function saveStyles(styles: Record<string, ListStyle>) {
  localStorage.setItem('sv-list-styles', JSON.stringify(styles));
}

// ── Main Sidebar ──

interface Props {
  hierarchy: ClickUpSpace | null;
  selectedListId: string | null;
  onSelectList: (listId: string | null) => void;
  onCreateTask: () => void;
  loading: boolean;
}

export default function ClickUpSidebar({ hierarchy, selectedListId, onSelectList, onCreateTask, loading }: Props) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({ 'all-members': true });
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingListInFolder, setCreatingListInFolder] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    items: MenuEntry[];
    position: { x: number; y: number };
    targetId?: string;
  } | null>(null);
  const [colorIconMenu, setColorIconMenu] = useState<{
    position: { x: number; y: number };
    targetId: string;
  } | null>(null);
  const [listStyles, setListStyles] = useState<Record<string, ListStyle>>(loadStyles);
  const [customFolders, setCustomFolders] = useState<ClickUpFolder[]>(() => {
    try { return JSON.parse(localStorage.getItem('sv-custom-folders') || '[]'); }
    catch { return []; }
  });

  useEffect(() => { localStorage.setItem('sv-custom-folders', JSON.stringify(customFolders)); }, [customFolders]);
  useEffect(() => { saveStyles(listStyles); }, [listStyles]);

  const toggleFolder = (id: string) =>
    setCollapsedFolders(prev => ({ ...prev, [id]: !prev[id] }));

  const isActive = (id: string | null) => selectedListId === id;

  const updateStyle = useCallback((id: string, patch: Partial<ListStyle>) => {
    setListStyles(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  // ── CRUD ──

  const handleCreateFolder = useCallback((name: string) => {
    setCustomFolders(prev => [...prev, { id: `custom-folder-${Date.now()}`, name, lists: [], taskCount: 0 }]);
    setCreatingFolder(false);
  }, []);

  const handleCreateList = useCallback((folderId: string, name: string) => {
    setCustomFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, lists: [...f.lists, { id: `custom-list-${Date.now()}`, name, taskCount: 0 }] } : f
    ));
    setCreatingListInFolder(null);
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = customFolders.find(f => f.id === folderId);
    if (folder && selectedListId && folder.lists.some(l => l.id === selectedListId)) onSelectList(null);
    setCustomFolders(prev => prev.filter(f => f.id !== folderId));
  }, [customFolders, selectedListId, onSelectList]);

  const handleDeleteList = useCallback((folderId: string, listId: string) => {
    if (selectedListId === listId) onSelectList(null);
    setCustomFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, lists: f.lists.filter(l => l.id !== listId) } : f
    ));
  }, [selectedListId, onSelectList]);

  const handleDuplicateList = useCallback((folderId: string, list: ClickUpList) => {
    setCustomFolders(prev => prev.map(f => {
      if (f.id !== folderId) return f;
      const idx = f.lists.findIndex(l => l.id === list.id);
      const copy: ClickUpList = { id: `custom-list-${Date.now()}`, name: `${list.name} (copy)`, taskCount: 0 };
      const newLists = [...f.lists];
      newLists.splice(idx + 1, 0, copy);
      return { ...f, lists: newLists };
    }));
  }, []);

  const handleRenameFolder = useCallback((folderId: string, newName: string) => {
    setCustomFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
    setRenamingId(null);
  }, []);

  const handleRenameList = useCallback((folderId: string, listId: string, newName: string) => {
    setCustomFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, lists: f.lists.map(l => l.id === listId ? { ...l, name: newName } : l) } : f
    ));
    setRenamingId(null);
  }, []);

  // ── Context menu builders ──

  const openFolderMenu = useCallback((e: React.MouseEvent, folder: ClickUpFolder) => {
    const isCustom = folder.id.startsWith('custom-');
    const items: MenuEntry[] = [];

    // Section 1: Favorite, Rename, Copy link
    items.push({ label: 'Favorite', icon: <Star size={14} />, hasSubmenu: true, onClick: () => {} });
    items.push({ label: 'Rename', icon: <Pencil size={14} />, disabled: !isCustom, onClick: () => { if (isCustom) setRenamingId(folder.id); } });
    items.push({ label: 'Copy link', icon: <Link2 size={14} />, onClick: () => {
      navigator.clipboard?.writeText(`${window.location.origin}/tasks?folder=${folder.id}`);
    }});

    items.push('divider');

    // Section 2: Create new, Folder color, Automations, Custom Fields, Task statuses, More
    items.push({ label: 'Create new', icon: <Plus size={14} />, hasSubmenu: true, onClick: () => {
      setCreatingListInFolder(folder.id);
      if (collapsedFolders[folder.id]) toggleFolder(folder.id);
    }});
    items.push({ label: 'Folder color', icon: <Palette size={14} />, hasSubmenu: true, onClick: () => {} });
    items.push({ label: 'Automations', icon: <Zap size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Custom Fields', icon: <Hash size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Task statuses', icon: <CircleDot size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'More', icon: <MoreHorizontal size={14} />, hasSubmenu: true, disabled: true, onClick: () => {} });

    items.push('divider');

    // Section 3: Templates
    items.push({ label: 'Templates', icon: <Layers size={14} />, hasSubmenu: true, disabled: true, onClick: () => {} });

    items.push('divider');

    // Section 4: Move, Duplicate, Archive, Delete
    items.push({ label: 'Move', icon: <FolderInput size={14} />, hasSubmenu: true, disabled: !isCustom, onClick: () => {} });
    items.push({ label: 'Duplicate', icon: <Copy size={14} />, disabled: !isCustom, onClick: () => {
      if (!isCustom) return;
      const copy: ClickUpFolder = { id: `custom-folder-${Date.now()}`, name: `${folder.name} (copy)`, lists: [], taskCount: 0 };
      setCustomFolders(prev => {
        const idx = prev.findIndex(f => f.id === folder.id);
        const n = [...prev]; n.splice(idx + 1, 0, copy); return n;
      });
    }});
    items.push({ label: 'Archive', icon: <Archive size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Delete', icon: <Trash2 size={14} />, danger: true, disabled: !isCustom, onClick: () => { if (isCustom) handleDeleteFolder(folder.id); } });

    items.push('divider');

    // Footer: Sharing & Permissions
    items.push({ label: 'Sharing & Permissions', icon: <Users size={14} />, footer: true, disabled: true, onClick: () => {} });

    setContextMenu({ items, position: { x: e.clientX, y: e.clientY }, targetId: folder.id });
  }, [collapsedFolders, handleDeleteFolder, customFolders]);

  const openListMenu = useCallback((e: React.MouseEvent, folderId: string, list: ClickUpList) => {
    const isCustom = list.id.startsWith('custom-') && folderId.startsWith('custom-');
    const items: MenuEntry[] = [];

    // Section 1: Favorite, Rename, Copy link
    items.push({ label: 'Favorite', icon: <Star size={14} />, onClick: () => {} });
    items.push({ label: 'Rename', icon: <Pencil size={14} />, disabled: !isCustom, onClick: () => { if (isCustom) setRenamingId(list.id); } });
    items.push({ label: 'Copy link', icon: <Link2 size={14} />, onClick: () => {
      navigator.clipboard?.writeText(`${window.location.origin}/tasks?list=${list.id}`);
    }});

    items.push('divider');

    // Section 2: Create new, Convert, Color & Icon, Automations, Custom Fields, Task statuses, More
    items.push({ label: 'Create new', icon: <Plus size={14} />, hasSubmenu: true, onClick: () => {
      onSelectList(list.id);
      onCreateTask();
    }});
    items.push({ label: 'Convert List to Sprint', icon: <Timer size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Color & Icon', icon: <Palette size={14} />, hasSubmenu: true, onClick: () => {} });
    items.push({ label: 'Automations', icon: <Zap size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Custom Fields', icon: <Hash size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Task statuses', icon: <CircleDot size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'More', icon: <MoreHorizontal size={14} />, hasSubmenu: true, disabled: true, onClick: () => {} });

    items.push('divider');

    // Section 3: List Info, Default task type, Email to List
    items.push({ label: 'List Info', icon: <Info size={14} />, onClick: () => { onSelectList(list.id); } });
    items.push({ label: 'Default task type', icon: <FileText size={14} />, hasSubmenu: true, disabled: true, onClick: () => {} });
    items.push({ label: 'Email to List', icon: <Mail size={14} />, disabled: true, onClick: () => {} });

    items.push('divider');

    // Section 4: Templates
    items.push({ label: 'Templates', icon: <Layers size={14} />, hasSubmenu: true, disabled: true, onClick: () => {} });

    items.push('divider');

    // Section 5: Move, Duplicate, Archive, Delete
    items.push({ label: 'Move', icon: <FolderInput size={14} />, hasSubmenu: true, disabled: !isCustom, onClick: () => {} });
    items.push({ label: 'Duplicate', icon: <Copy size={14} />, disabled: !isCustom, onClick: () => { if (isCustom) handleDuplicateList(folderId, list); } });
    items.push({ label: 'Archive', icon: <Archive size={14} />, disabled: true, onClick: () => {} });
    items.push({ label: 'Delete', icon: <Trash2 size={14} />, danger: true, disabled: !isCustom, onClick: () => { if (isCustom) handleDeleteList(folderId, list.id); } });

    setContextMenu({ items, position: { x: e.clientX, y: e.clientY }, targetId: list.id });
  }, [handleDeleteList, handleDuplicateList, onSelectList, onCreateTask]);

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
    width: '100%', textAlign: 'left', fontSize: '0.8rem',
    background: active ? C.sidebarActive : 'transparent',
    color: active ? C.text : C.textSecondary,
    fontWeight: active ? 600 : 400,
    transition: 'background 0.12s, color 0.12s',
  });

  const allFolders = [...(hierarchy?.folders || []), ...customFolders];

  // Resolve icon for a list/folder
  const getListIcon = (id: string, fallback: React.ReactNode, activeColor: string) => {
    const style = listStyles[id];
    if (style?.icon) {
      const found = ICON_OPTIONS.find(o => o.name === style.icon);
      if (found) return React.cloneElement(found.icon as React.ReactElement, { size: 12, color: style.color || activeColor });
    }
    if (style?.color) {
      return <div style={{ width: 8, height: 8, borderRadius: '50%', background: style.color, flexShrink: 0 }} />;
    }
    return fallback;
  };

  return (
    <div style={{
      width: 240, minWidth: 240, height: '100%',
      background: C.sidebar,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Space header */}
      <div style={{
        padding: '16px 14px 10px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #FFD600 0%, #FF9800 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: '#000', flexShrink: 0,
        }}>SV</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>
            {hierarchy?.name || 'Street Voices'}
          </div>
          <div style={{ fontSize: '0.6rem', color: C.textMuted }}>
            {hierarchy?.totalTasks || 0} tasks
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <IconButton onClick={e => {
            setContextMenu({
              items: [
                { label: 'New Folder', icon: <FolderOpen size={14} />, onClick: () => setCreatingFolder(true) },
                { label: 'New List', icon: <ListTodo size={14} />, disabled: true, onClick: () => {} },
              ],
              position: { x: e.clientX, y: e.clientY },
            });
          }} title="More options"><MoreHorizontal size={16} /></IconButton>
          <IconButton onClick={() => setCreatingFolder(true)} title="New folder"><Plus size={16} /></IconButton>
        </div>
      </div>

      {/* All Tasks */}
      <div style={{ padding: '8px 8px 0' }}>
        <button
          onClick={() => onSelectList(null)}
          onMouseEnter={e => { if (!isActive(null)) e.currentTarget.style.background = C.sidebarHover; }}
          onMouseLeave={e => { if (!isActive(null)) e.currentTarget.style.background = 'transparent'; }}
          style={rowStyle(isActive(null))}
        >
          <LayoutGrid size={14} />
          <span style={{ flex: 1 }}>All Tasks</span>
          <span style={{ fontSize: '0.65rem', color: C.textMuted, fontWeight: 500 }}>
            {hierarchy?.totalTasks || 0}
          </span>
        </button>
      </div>

      {/* Folders */}
      <div style={{ padding: '6px 8px', flex: 1 }}>
        {loading && !hierarchy && (
          <div style={{ padding: '20px 12px', color: C.textMuted, fontSize: '0.75rem' }}>Loading...</div>
        )}

        {allFolders.map(folder => {
          const isCollapsed = collapsedFolders[folder.id];
          const hasTasks = folder.taskCount > 0;
          const isCustom = folder.id.startsWith('custom-');
          const folderStyle = listStyles[folder.id];

          if (renamingId === folder.id) {
            return (
              <div key={folder.id} style={{ marginBottom: 2 }}>
                <InlineNameInput placeholder="Folder name..." initialValue={folder.name}
                  onSubmit={name => handleRenameFolder(folder.id, name)} onCancel={() => setRenamingId(null)} />
              </div>
            );
          }

          return (
            <div key={folder.id} style={{ marginBottom: 2 }}>
              <div
                style={{ position: 'relative' }}
                onMouseEnter={e => {
                  const a = e.currentTarget.querySelector('.sb-hov') as HTMLElement;
                  if (a) a.style.opacity = '1';
                  const b = e.currentTarget.querySelector('.sb-fbtn') as HTMLElement;
                  if (b) b.style.background = C.sidebarHover;
                }}
                onMouseLeave={e => {
                  const a = e.currentTarget.querySelector('.sb-hov') as HTMLElement;
                  if (a) a.style.opacity = '0';
                  const b = e.currentTarget.querySelector('.sb-fbtn') as HTMLElement;
                  if (b) b.style.background = 'transparent';
                }}
              >
                <button
                  className="sb-fbtn"
                  onClick={() => toggleFolder(folder.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '5px 12px', paddingRight: 56, borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: C.textSecondary, fontSize: '0.75rem',
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px',
                    transition: 'background 0.12s',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={12} color={C.textMuted} /> : <ChevronDown size={12} color={C.textMuted} />}
                  {isCollapsed
                    ? <Folder size={13} color={folderStyle?.color || C.textMuted} />
                    : <FolderOpen size={13} color={folderStyle?.color || C.accent} />
                  }
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {folder.name}
                  </span>
                  {hasTasks && <span style={{ fontSize: '0.6rem', color: C.textMuted, fontWeight: 400 }}>{folder.taskCount}</span>}
                </button>

                <div className="sb-hov" style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s',
                }}>
                  <IconButton onClick={e => openFolderMenu(e, folder)} title="Folder settings"><MoreHorizontal size={13} /></IconButton>
                  <IconButton onClick={() => {
                    setCreatingListInFolder(folder.id);
                    if (isCollapsed) toggleFolder(folder.id);
                  }} title="New list"><Plus size={13} /></IconButton>
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ paddingLeft: 16, marginTop: 1 }}>
                  {folder.lists.map(list => {
                    if (renamingId === list.id) {
                      return (
                        <InlineNameInput key={list.id} placeholder="List name..." initialValue={list.name}
                          onSubmit={name => handleRenameList(folder.id, list.id, name)} onCancel={() => setRenamingId(null)} />
                      );
                    }

                    const listColor = listStyles[list.id]?.color;

                    return (
                      <div
                        key={list.id}
                        style={{ position: 'relative' }}
                        onMouseEnter={e => {
                          const a = e.currentTarget.querySelector('.sb-lhov') as HTMLElement;
                          if (a) a.style.opacity = '1';
                        }}
                        onMouseLeave={e => {
                          const a = e.currentTarget.querySelector('.sb-lhov') as HTMLElement;
                          if (a) a.style.opacity = '0';
                        }}
                      >
                        <button
                          onClick={() => onSelectList(list.id)}
                          onMouseEnter={e => { if (!isActive(list.id)) e.currentTarget.style.background = C.sidebarHover; }}
                          onMouseLeave={e => { if (!isActive(list.id)) e.currentTarget.style.background = 'transparent'; }}
                          style={{ ...rowStyle(isActive(list.id)), paddingRight: 48 }}
                        >
                          {getListIcon(
                            list.id,
                            list.agentId
                              ? <Bot size={12} color={isActive(list.id) ? C.accent : C.textMuted} />
                              : <ListTodo size={12} color={isActive(list.id) ? C.accent : C.textMuted} />,
                            C.accent,
                          )}
                          <span style={{
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            color: listColor && isActive(list.id) ? listColor : undefined,
                          }}>
                            {list.name}
                          </span>
                          {list.taskCount > 0 && (
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 500,
                              color: isActive(list.id) ? C.accent : C.textMuted,
                              minWidth: 16, textAlign: 'right',
                            }}>{list.taskCount}</span>
                          )}
                        </button>

                        <div className="sb-lhov" style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s',
                        }}>
                          <IconButton onClick={e => openListMenu(e, folder.id, list)} title="List settings">
                            <MoreHorizontal size={12} />
                          </IconButton>
                        </div>
                      </div>
                    );
                  })}

                  {creatingListInFolder === folder.id && (
                    <InlineNameInput placeholder="List name..."
                      onSubmit={name => handleCreateList(folder.id, name)} onCancel={() => setCreatingListInFolder(null)} />
                  )}

                  {creatingListInFolder !== folder.id && isCustom && (
                    <button
                      onClick={() => setCreatingListInFolder(folder.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: 'transparent', color: C.textMuted, fontSize: '0.7rem',
                        width: '100%', textAlign: 'left', transition: 'color 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.text; }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
                    >
                      <Plus size={11} /><span>Add list</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {creatingFolder && (
          <InlineNameInput placeholder="Folder name..." onSubmit={handleCreateFolder} onCancel={() => setCreatingFolder(false)} />
        )}

        {!creatingFolder && (
          <button
            onClick={() => setCreatingFolder(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', marginTop: 4, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'transparent', color: C.textMuted, fontSize: '0.7rem',
              width: '100%', textAlign: 'left', transition: 'color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
          >
            <Plus size={12} /><span>New Folder</span>
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={() => { setContextMenu(null); setColorIconMenu(null); }}
          onOpenColorIcon={contextMenu.targetId ? (pos) => {
            setColorIconMenu({ position: pos, targetId: contextMenu.targetId! });
          } : undefined}
        />
      )}

      {/* Color & Icon submenu */}
      {colorIconMenu && (
        <ColorIconSubmenu
          position={colorIconMenu.position}
          currentColor={listStyles[colorIconMenu.targetId]?.color}
          currentIcon={listStyles[colorIconMenu.targetId]?.icon}
          onClose={() => setColorIconMenu(null)}
          onSelectColor={color => {
            updateStyle(colorIconMenu.targetId, { color });
            setColorIconMenu(null);
            setContextMenu(null);
          }}
          onSelectIcon={icon => {
            updateStyle(colorIconMenu.targetId, { icon });
            setColorIconMenu(null);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}
