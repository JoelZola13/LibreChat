'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { WorkItemType } from '@/lib/api/modules';
import TypeIcon from './TypeIcon';

interface TypeSelectorProps {
  types: WorkItemType[];
  selectedTypeId?: string;
  onSelect: (typeId: string) => void;
  disabled?: boolean;
}

export default function TypeSelector({
  types,
  selectedTypeId,
  onSelect,
  disabled = false,
}: TypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedType = types.find((t) => t.id === selectedTypeId) || types.find((t) => t.is_default);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}
                  ${isOpen ? 'bg-white/10' : ''}`}
      >
        {selectedType ? (
          <>
            <TypeIcon type={selectedType} size="sm" />
            <span className="text-sm text-white">{selectedType.name}</span>
          </>
        ) : (
          <span className="text-sm text-white/60">Select type</span>
        )}
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 glass-card rounded-lg shadow-xl border border-white/10 py-1">
          {types.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                onSelect(type.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10
                        transition-colors ${selectedTypeId === type.id ? 'bg-white/5' : ''}`}
            >
              <TypeIcon type={type} size="sm" />
              <span className="flex-1 text-sm text-white">{type.name}</span>
              {selectedTypeId === type.id && (
                <Check className="w-4 h-4 text-indigo-400" />
              )}
              {type.is_default && selectedTypeId !== type.id && (
                <span className="text-xs text-white/40">default</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
