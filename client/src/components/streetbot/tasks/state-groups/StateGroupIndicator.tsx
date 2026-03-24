'use client';

import type { StateGroup } from '@/lib/api/modules';

interface StateGroupIndicatorProps {
  group: StateGroup;
  size?: 'sm' | 'md';
}

export default function StateGroupIndicator({ group, size = 'sm' }: StateGroupIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
  };

  return (
    <div
      className={`rounded-full ${sizeClasses[size]}`}
      style={{ backgroundColor: group.color }}
      title={group.name}
    />
  );
}
