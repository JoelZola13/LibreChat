'use client';

import {
  Layers,
  BookOpen,
  CheckSquare,
  Bug,
  TrendingUp,
  Circle,
  AlertCircle,
  Lightbulb,
  Target,
} from 'lucide-react';
import type { WorkItemType } from '@/lib/api/modules';

interface TypeIconProps {
  type: WorkItemType;
  size?: 'sm' | 'md' | 'lg';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  layers: Layers,
  'book-open': BookOpen,
  'check-square': CheckSquare,
  bug: Bug,
  'trending-up': TrendingUp,
  circle: Circle,
  'alert-circle': AlertCircle,
  lightbulb: Lightbulb,
  target: Target,
};

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export default function TypeIcon({ type, size = 'md' }: TypeIconProps) {
  const IconComponent = type.icon ? iconMap[type.icon] : Circle;
  const Icon = IconComponent || Circle;

  return (
    <div
      className={`flex items-center justify-center rounded ${sizeClasses[size]}`}
      style={{ color: type.color }}
    >
      <Icon className={sizeClasses[size]} />
    </div>
  );
}
