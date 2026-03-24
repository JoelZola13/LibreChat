'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Lock } from 'lucide-react';
import type { PageTreeNode } from '@/lib/api/pages';

interface PageTreeNavProps {
  nodes: PageTreeNode[];
  selectedPageId?: string;
  onSelectPage: (node: PageTreeNode) => void;
  depth: number;
}

export default function PageTreeNav({
  nodes,
  selectedPageId,
  onSelectPage,
  depth,
}: PageTreeNavProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (nodes.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = selectedPageId === node.id;

        return (
          <div key={node.id}>
            <button
              onClick={() => onSelectPage(node)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors
                        flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-500/20 text-white'
                            : 'text-white/70 hover:bg-white/5'
                        }`}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
            >
              {/* Expand/collapse button */}
              {hasChildren ? (
                <button
                  onClick={(e) => toggleExpand(node.id, e)}
                  className="p-0.5 hover:bg-white/10 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-white/40" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-white/40" />
                  )}
                </button>
              ) : (
                <span className="w-4" />
              )}

              {/* Icon */}
              {node.icon ? (
                <span className="text-sm">{node.icon}</span>
              ) : (
                <FileText
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: node.color }}
                />
              )}

              {/* Name */}
              <span className="truncate flex-1">{node.name}</span>

              {/* Private indicator */}
              {node.is_private && (
                <Lock className="w-3 h-3 text-white/30 flex-shrink-0" />
              )}
            </button>

            {/* Children */}
            {hasChildren && isExpanded && (
              <PageTreeNav
                nodes={node.children}
                selectedPageId={selectedPageId}
                onSelectPage={onSelectPage}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
