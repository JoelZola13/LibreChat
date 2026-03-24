import React from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  Video,
  Trophy,
  FileText,
  ClipboardCheck,
  Calendar,
  Map,
  Brain,
  Award,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";

interface AcademySidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const navSections = [
  {
    title: "Learn",
    items: [
      { href: "/academy/courses", label: "Courses", icon: BookOpen, color: "#FFD600" },
      { href: "/academy/paths", label: "Learning Paths", icon: Map, color: "#8B5CF6" },
      { href: "/academy/live-sessions", label: "Live Sessions", icon: Video, color: "#10B981", badge: "LIVE" },
    ],
  },
  {
    title: "Activities",
    items: [
      { href: "/academy/assignments", label: "Assignments", icon: FileText, color: "#3B82F6" },
      { href: "/academy/peer-review", label: "Peer Review", icon: Users, color: "#A855F7" },
      { href: "/academy/attendance", label: "Attendance", icon: Calendar, color: "#10B981" },
    ],
  },
  {
    title: "Progress",
    items: [
      { href: "/academy/progress", label: "My Progress", icon: Trophy, color: "#F59E0B" },
      { href: "/academy/certificates", label: "Certificates", icon: Award, color: "#EF4444" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/academy/ai-tutor", label: "AI Tutor", icon: Brain, color: "#EC4899" },
      { href: "/academy/discussions", label: "Discussions", icon: MessageSquare, color: "#6366F1" },
    ],
  },
  {
    title: "Instructor",
    items: [
      { href: "/academy/instructor/grading", label: "Grading", icon: ClipboardCheck, color: "#F97316" },
    ],
  },
];

export function AcademySidebar({ isCollapsed = false, onToggle }: AcademySidebarProps) {
  const pathname = window.location.pathname;

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed bottom-0 z-50 flex flex-col"
      style={{
        left: "var(--sidebar-width, 0px)",
        top: "64px",
        width: isCollapsed ? "64px" : "240px",
        background: "rgba(15, 15, 25, 0.98)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderRight: "1px solid rgba(255, 255, 255, 0.15)",
        transition: "left 0.3s ease, width 0.2s ease",
      }}
    >
      {/* Collapse Toggle */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-4 w-6 h-6 rounded-full flex items-center justify-center z-50"
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <ChevronLeft
            className="w-4 h-4 text-white/70"
            style={{ transform: isCollapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            {!isCollapsed && (
              <h3
                className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${isActive ? "bg-white/10" : "hover:bg-white/5"}
                    `}
                    style={{
                      justifyContent: isCollapsed ? "center" : "flex-start",
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{
                        background: isActive ? `${item.color}20` : "transparent",
                      }}
                    >
                      <item.icon
                        className="w-5 h-5"
                        style={{ color: isActive ? item.color : "rgba(255, 255, 255, 0.6)" }}
                      />
                    </div>
                    {!isCollapsed && (
                      <>
                        <span
                          className="flex-1 text-sm font-medium"
                          style={{ color: isActive ? "#fff" : "rgba(255, 255, 255, 0.7)" }}
                        >
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] font-bold rounded-full animate-pulse"
                            style={{
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#10B981",
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 w-1 h-8 rounded-r-full"
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

      {/* Bottom Section - Community Link */}
      <div className="p-2 border-t border-white/10">
        <a
          href="/groups"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
          style={{ justifyContent: isCollapsed ? "center" : "flex-start" }}
          title={isCollapsed ? "Community" : undefined}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg">
            <Users className="w-5 h-5" style={{ color: "rgba(255, 255, 255, 0.6)" }} />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-medium" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              Community
            </span>
          )}
        </a>
      </div>
    </motion.aside>
  );
}
