'use client';

import { format } from 'date-fns';
import { FileText, Star, Lock, Clock, Hash } from 'lucide-react';
import type { Page } from '@/lib/api/pages';

interface PageCardProps {
  page: Page;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function PageCard({ page, onClick, isSelected = false }: PageCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 rounded-xl cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-indigo-500'
          : 'hover:bg-white/5'
      }`}
      style={{ borderLeft: `3px solid ${page.color}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${page.color}20` }}
          >
            {page.icon ? (
              <span className="text-lg">{page.icon}</span>
            ) : (
              <FileText className="w-5 h-5" style={{ color: page.color }} />
            )}
          </div>
          <div>
            <h3 className="text-base font-medium text-white flex items-center gap-2">
              {page.name}
              {page.is_favorite && (
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              )}
              {page.is_locked && (
                <Lock className="w-4 h-4 text-orange-400" />
              )}
            </h3>
            {page.description && (
              <p className="text-sm text-white/50 line-clamp-1 mt-0.5">
                {page.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content preview */}
      {page.content && (
        <p className="text-sm text-white/40 line-clamp-2 mb-3">
          {page.content.slice(0, 150)}...
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-4 text-xs text-white/40">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{format(new Date(page.updated_at), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <span>v{page.version}</span>
          </div>
          <span>{page.word_count} words</span>
        </div>

        {page.is_private && (
          <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">
            Private
          </span>
        )}
      </div>
    </div>
  );
}
