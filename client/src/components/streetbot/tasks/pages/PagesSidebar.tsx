'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, FileText, Star, Clock, Search } from 'lucide-react';
import type { Page, PageTreeNode } from '@/lib/api/pages';
import { getPageTree, getFavoritePages, getRecentPages } from '@/lib/api/pages';
import PageTreeNav from './PageTreeNav';

interface PagesSidebarProps {
  projectId: string;
  userId: string;
  selectedPageId?: string;
  onSelectPage: (page: { id: string; name: string } | null) => void;
  onCreatePage: () => void;
}

export default function PagesSidebar({
  projectId,
  userId,
  selectedPageId,
  onSelectPage,
  onCreatePage,
}: PagesSidebarProps) {
  const [pageTree, setPageTree] = useState<PageTreeNode[]>([]);
  const [favorites, setFavorites] = useState<Page[]>([]);
  const [recentPages, setRecentPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showRecent, setShowRecent] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tree, favs, recent] = await Promise.all([
        getPageTree(projectId),
        getFavoritePages(projectId, userId),
        getRecentPages(projectId, userId, 5),
      ]);
      setPageTree(tree);
      setFavorites(favs);
      setRecentPages(recent);
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-3 rounded-xl">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer mb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/60" />
          )}
          <FileText className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Pages</span>
          <span className="text-xs text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
            {pageTree.length}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreatePage();
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <Plus className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 mt-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Favorites */}
              {favorites.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowFavorites(!showFavorites)}
                    className="flex items-center gap-2 text-xs text-white/50 px-2 mb-1 hover:text-white/70"
                  >
                    {showFavorites ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    <Star className="w-3 h-3" />
                    <span>Favorites</span>
                  </button>
                  {showFavorites && (
                    <div className="space-y-0.5 ml-2">
                      {favorites.map((page) => (
                        <button
                          key={page.id}
                          onClick={() => onSelectPage({ id: page.id, name: page.name })}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                            selectedPageId === page.id
                              ? 'bg-indigo-500/20 text-white'
                              : 'text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="truncate">{page.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recent */}
              {recentPages.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowRecent(!showRecent)}
                    className="flex items-center gap-2 text-xs text-white/50 px-2 mb-1 hover:text-white/70"
                  >
                    {showRecent ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    <Clock className="w-3 h-3" />
                    <span>Recent</span>
                  </button>
                  {showRecent && (
                    <div className="space-y-0.5 ml-2">
                      {recentPages.map((page) => (
                        <button
                          key={page.id}
                          onClick={() => onSelectPage({ id: page.id, name: page.name })}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                            selectedPageId === page.id
                              ? 'bg-indigo-500/20 text-white'
                              : 'text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <FileText className="w-3 h-3 text-white/40" />
                          <span className="truncate">{page.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Pages Tree */}
              <div>
                <div className="flex items-center gap-2 text-xs text-white/50 px-2 mb-1">
                  <span>All Pages</span>
                </div>
                <PageTreeNav
                  nodes={pageTree}
                  selectedPageId={selectedPageId}
                  onSelectPage={(node) => onSelectPage({ id: node.id, name: node.name })}
                  depth={0}
                />
              </div>

              {/* Empty state */}
              {pageTree.length === 0 && favorites.length === 0 && (
                <div className="text-center py-4">
                  <FileText className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/40 mb-3">No pages yet</p>
                  <button
                    onClick={onCreatePage}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500
                             text-white rounded-lg transition-colors"
                  >
                    Create Page
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
