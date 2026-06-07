import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, BookOpen, Map, ChevronLeft, Sparkles, GraduationCap } from 'lucide-react';

interface AcademySidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  layout?: 'fixed' | 'inline';
  offsetLeft?: number;
}

export function AcademySidebar({
  isCollapsed = false,
  onToggle,
  layout = 'fixed',
  offsetLeft = 0,
}: AcademySidebarProps) {
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  const basePath = pathname.startsWith('/learning') ? '/learning' : '/academy';
  const isInline = layout === 'inline';
  const navSections = [
    {
      title: 'Journey',
      items: [
        {
          href: `${basePath}#programs`,
          label: 'Programs',
          icon: Map,
          color: '#8B5CF6',
          anchor: 'programs',
        },
        {
          href: `${basePath}/courses`,
          label: 'Courses',
          icon: BookOpen,
          color: '#FFD600',
          anchor: 'courses',
        },
        {
          href: `${basePath}/student-workspace`,
          label: 'Student Workspace',
          icon: GraduationCap,
          color: '#10B981',
        },
        {
          href: `${basePath}/dashboard`,
          label: 'Dashboard',
          icon: LayoutDashboard,
          color: '#FACC15',
        },
        {
          href: `${basePath}/instructor`,
          label: 'Instructor Workspace',
          icon: Sparkles,
          color: '#F97316',
        },
      ],
    },
  ];

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`${isInline ? 'relative' : 'fixed bottom-0'} z-50 flex flex-col`}
      style={{
        left: isInline ? 0 : `${offsetLeft}px`,
        top: isInline ? 0 : '64px',
        width: isInline ? '100%' : isCollapsed ? '64px' : '240px',
        height: isInline ? '100%' : undefined,
        background: 'rgba(15, 15, 25, 0.98)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRight: '1px solid rgba(255, 255, 255, 0.15)',
        transition: 'left 0.3s ease, width 0.2s ease',
      }}
    >
      {/* Collapse Toggle */}
      {onToggle && !isInline && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <ChevronLeft
            className="h-4 w-4 text-white/70"
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            {!isCollapsed && (
              <h3
                className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(255, 255, 255, 0.4)' }}
              >
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isRootAcademyLink = item.href === basePath;
                const isActive = item.anchor
                  ? hash === `#${item.anchor}` ||
                    pathname === `${basePath}/${item.anchor === 'programs' ? 'paths' : item.anchor}`
                  : isRootAcademyLink
                    ? pathname === item.href && !hash
                    : pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${isActive ? 'bg-white/10' : 'hover:bg-white/5'} `}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        background: isActive ? `${item.color}20` : 'transparent',
                      }}
                    >
                      <item.icon
                        className="h-5 w-5"
                        style={{ color: isActive ? item.color : 'rgba(255, 255, 255, 0.6)' }}
                      />
                    </div>
                    {!isCollapsed && (
                      <>
                        <span
                          className="flex-1 text-sm font-medium"
                          style={{ color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.7)' }}
                        >
                          {item.label}
                        </span>
                      </>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 h-8 w-1 rounded-r-full"
                        style={{ background: item.color }}
                      />
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </motion.aside>
  );
}
