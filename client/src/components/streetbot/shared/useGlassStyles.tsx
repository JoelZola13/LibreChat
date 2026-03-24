import { useMemo } from "react";
import { useTheme } from "@/app/providers/theme-provider";
import { useResponsive } from "../hooks/useResponsive";

/**
 * Glassmorphism Design System Hook
 * Provides consistent glass styles across the application
 * Based on Apple Vision Pro design principles
 */
export function useGlassStyles() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { isMobile } = useResponsive();

  const colors = useMemo(
    () => ({
      // Base backgrounds
      bg: isDark ? "var(--sb-color-background)" : "var(--sb-color-background)",

      // Glass surfaces
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.6)",
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.75)",
      surfaceActive: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.85)",

      // Glass borders
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)",
      borderHover: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.12)",
      borderActive: isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.18)",

      // Text colors
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      textInverse: isDark ? "#111" : "#fff",

      // Brand accent
      accent: "#FFD600",
      accentHover: "#E6C200",
      accentGlow: "rgba(255, 214, 0, 0.4)",

      // Status colors
      success: "#22c55e",
      successBg: "rgba(34, 197, 94, 0.1)",
      error: "#ef4444",
      errorBg: "rgba(239, 68, 68, 0.1)",
      warning: "#f59e0b",
      warningBg: "rgba(245, 158, 11, 0.1)",
      info: "#3b82f6",
      infoBg: "rgba(59, 130, 246, 0.1)",

      // Glass card
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.7)",
      cardBgHover: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(255, 255, 255, 0.85)",

      // Glass shadow
      glassShadow: isDark
        ? "0 8px 32px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
      glassShadowHover: isDark
        ? "0 16px 48px rgba(0, 0, 0, 0.4)"
        : "0 8px 32px rgba(0, 0, 0, 0.1)",

      // Glow effects
      glowPurple: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)",
      glowAccent: isDark ? "rgba(255, 214, 0, 0.15)" : "rgba(255, 214, 0, 0.1)",

      // Hero gradient
      heroBg: isDark
        ? "linear-gradient(135deg, rgba(26, 26, 30, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%)"
        : "linear-gradient(135deg, rgba(247, 248, 252, 0.95) 0%, rgba(237, 238, 245, 0.98) 100%)",
    }),
    [isDark]
  );

  // Common glass styles
  const glassCard = useMemo(
    () => ({
      background: colors.cardBg,
      backdropFilter: "blur(24px) saturate(180%)",
      WebkitBackdropFilter: "blur(24px) saturate(180%)",
      borderRadius: "24px",
      border: `1px solid ${colors.border}`,
      boxShadow: colors.glassShadow,
    }),
    [colors]
  );

  const glassSurface = useMemo(
    () => ({
      background: colors.surface,
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderRadius: "16px",
      border: `1px solid ${colors.border}`,
      boxShadow: colors.glassShadow,
    }),
    [colors]
  );

  const glassButton = useMemo(
    () => ({
      background: colors.surface,
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderRadius: "14px",
      border: `1px solid ${colors.border}`,
      color: colors.text,
      cursor: "pointer",
      transition: "all 0.2s ease",
    }),
    [colors]
  );

  const glassInput = useMemo(
    () => ({
      background: colors.cardBg,
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderRadius: "12px",
      border: `1px solid ${colors.border}`,
      color: colors.text,
      outline: "none",
      transition: "all 0.2s ease",
    }),
    [colors]
  );

  const accentButton = useMemo(
    () => ({
      background: colors.accent,
      color: "#000",
      border: "none",
      borderRadius: "14px",
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: `0 4px 14px ${colors.accentGlow}`,
      transition: "all 0.2s ease",
    }),
    [colors]
  );

  const glassTag = useMemo(
    () => ({
      background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      borderRadius: "8px",
      border: `1px solid ${colors.border}`,
      color: colors.textSecondary,
      fontSize: "12px",
      padding: "4px 10px",
    }),
    [colors, isDark]
  );

  // Gradient orbs for background
  const gradientOrbs = useMemo(
    () => ({
      purple: {
        position: "fixed" as const,
        top: "-30%",
        left: "30%",
        width: isMobile ? "400px" : "800px",
        height: isMobile ? "400px" : "800px",
        background: isDark
          ? "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 60%)"
          : "none",
        pointerEvents: "none" as const,
        zIndex: 0,
        filter: isMobile ? "blur(30px)" : "blur(40px)",
      },
      pink: {
        position: "fixed" as const,
        top: "20%",
        right: "-10%",
        width: isMobile ? "300px" : "600px",
        height: isMobile ? "300px" : "600px",
        background: isDark
          ? "radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0.15) 30%, transparent 60%)"
          : "none",
        pointerEvents: "none" as const,
        zIndex: 0,
        filter: isMobile ? "blur(45px)" : "blur(60px)",
      },
      cyan: {
        position: "fixed" as const,
        bottom: "-10%",
        left: "-10%",
        width: isMobile ? "350px" : "700px",
        height: isMobile ? "350px" : "700px",
        background: isDark
          ? "radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 30%, transparent 60%)"
          : "none",
        pointerEvents: "none" as const,
        zIndex: 0,
        filter: isMobile ? "blur(38px)" : "blur(50px)",
      },
      gold: {
        position: "fixed" as const,
        top: "50%",
        right: "20%",
        width: isMobile ? "200px" : "400px",
        height: isMobile ? "200px" : "400px",
        background: isDark
          ? "radial-gradient(circle, rgba(255, 214, 0, 0.25) 0%, transparent 50%)"
          : "none",
        pointerEvents: "none" as const,
        zIndex: 0,
        filter: isMobile ? "blur(30px)" : "blur(40px)",
      },
    }),
    [isDark, isMobile]
  );

  // Hover handlers for cards
  const cardHoverHandlers = useMemo(
    () => ({
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) return;
        e.currentTarget.style.transform = "translateY(-8px)";
        e.currentTarget.style.borderColor = colors.borderHover;
        e.currentTarget.style.background = colors.cardBgHover;
        e.currentTarget.style.boxShadow = isDark
          ? "0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15)"
          : "0 12px 32px rgba(0, 0, 0, 0.08)";
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.background = colors.cardBg;
        e.currentTarget.style.boxShadow = colors.glassShadow;
      },
    }),
    [colors, isDark, isMobile]
  );

  // Hover handlers for buttons
  const buttonHoverHandlers = useMemo(
    () => ({
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) return;
        e.currentTarget.style.background = colors.surfaceHover;
        e.currentTarget.style.borderColor = colors.borderHover;
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) return;
        e.currentTarget.style.background = colors.surface;
        e.currentTarget.style.borderColor = colors.border;
      },
    }),
    [colors, isMobile]
  );

  // Hover handlers for accent buttons
  const accentButtonHoverHandlers = useMemo(
    () => ({
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) return;
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) return;
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = `0 4px 14px ${colors.accentGlow}`;
      },
    }),
    [colors, isMobile]
  );

  return {
    isDark,
    colors,
    glassCard,
    glassSurface,
    glassButton,
    glassInput,
    accentButton,
    glassTag,
    gradientOrbs,
    cardHoverHandlers,
    buttonHoverHandlers,
    accentButtonHoverHandlers,
  };
}
