import React from "react";
import { ChevronRight, Home, BookOpen, FolderOpen, FileText } from "lucide-react";

/**
 * Breadcrumb navigation component for the Academy
 * Shows the current navigation path: Academy > Course > Module > Lesson
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: "home" | "course" | "module" | "lesson";
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const iconMap = {
  home: Home,
  course: BookOpen,
  module: FolderOpen,
  lesson: FileText,
};

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const colors = {
    text: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
    textHover: isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)",
    textActive: isDark ? "#ffffff" : "#1e293b",
    accent: "#FFD600",
    separator: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
    bg: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)",
    bgHover: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center ${className}`}
    >
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon ? iconMap[item.icon] : null;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight
                  className="w-4 h-4 mx-1 flex-shrink-0"
                  style={{ color: colors.separator }}
                  aria-hidden="true"
                />
              )}

              {isLast ? (
                // Current page (not a link)
                <span
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium"
                  style={{ color: colors.textActive }}
                  aria-current="page"
                >
                  {Icon && <Icon className="w-4 h-4" style={{ color: colors.accent }} />}
                  <span className="max-w-[200px] truncate">{item.label}</span>
                </span>
              ) : (
                // Link to previous page
                <a
                  href={item.href || "#"}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-all hover:bg-opacity-100"
                  style={{
                    color: colors.text,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.textHover;
                    e.currentTarget.style.background = colors.bgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.text;
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span className="max-w-[150px] truncate">{item.label}</span>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Compact breadcrumb for mobile
export function BreadcrumbCompact({ items, className = "" }: BreadcrumbProps) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  if (items.length <= 1) return null;

  const previousItem = items[items.length - 2];
  const currentItem = items[items.length - 1];

  const colors = {
    text: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
    textHover: isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)",
    accent: "#FFD600",
  };

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 ${className}`}>
      <a
        href={previousItem.href || "#"}
        className="flex items-center gap-1 text-sm transition-colors"
        style={{ color: colors.text }}
        onMouseEnter={(e) => (e.currentTarget.style.color = colors.textHover)}
        onMouseLeave={(e) => (e.currentTarget.style.color = colors.text)}
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span>Back</span>
      </a>
      <span style={{ color: colors.text }}>|</span>
      <span
        className="text-sm font-medium truncate max-w-[200px]"
        style={{ color: colors.accent }}
      >
        {currentItem.label}
      </span>
    </nav>
  );
}

// Helper function to build breadcrumb items from route params
export function buildAcademyBreadcrumbs(params: {
  courseId?: string;
  courseName?: string;
  moduleId?: string;
  moduleName?: string;
  lessonId?: string;
  lessonName?: string;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: "Academy", href: "/academy", icon: "home" },
  ];

  if (params.courseId) {
    items.push({
      label: params.courseName || "Course",
      href: `/academy/courses/${params.courseId}`,
      icon: "course",
    });
  }

  if (params.moduleId) {
    items.push({
      label: params.moduleName || "Module",
      href: params.courseId
        ? `/academy/courses/${params.courseId}/modules/${params.moduleId}`
        : "#",
      icon: "module",
    });
  }

  if (params.lessonId) {
    items.push({
      label: params.lessonName || "Lesson",
      icon: "lesson",
    });
  }

  return items;
}
