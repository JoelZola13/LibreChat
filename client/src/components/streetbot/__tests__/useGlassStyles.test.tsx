/**
 * Tests for useGlassStyles — the glassmorphism design system hook.
 *
 * Tests cover:
 * - Dark mode detection and color switching
 * - Light mode colors
 * - Glass style objects (glassCard, glassSurface, glassButton, glassInput)
 * - Accent button styles
 * - Glass tag styles
 * - Gradient orbs configuration
 * - Hover handler generation
 * - GlassBackground component rendering
 */
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';

// Mock the theme provider used by useGlassStyles.
// The import `@/app/providers/theme-provider` in the source file resolves
// to `src/components/streetbot/app/providers/theme-provider` via the @/ alias.
let mockTheme = 'dark';
jest.mock('@/app/providers/theme-provider', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

import { useGlassStyles } from '~/components/streetbot/shared/useGlassStyles';
import { GlassBackground } from '~/components/streetbot/shared/GlassBackground';

describe('useGlassStyles', () => {
  beforeEach(() => {
    mockTheme = 'dark';
  });

  // ---------------------------------------------------------------------------
  // Dark mode
  // ---------------------------------------------------------------------------

  describe('dark mode', () => {
    beforeEach(() => {
      mockTheme = 'dark';
    });

    it('returns isDark = true', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.isDark).toBe(true);
    });

    it('returns white text color', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.text).toBe('#fff');
    });

    it('returns dark surface colors with low opacity', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.surface).toContain('0.08');
    });

    it('returns dark card background with low opacity', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.cardBg).toContain('0.06');
    });

    it('returns dark glass shadow', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.glassShadow).toContain('rgba(0, 0, 0');
    });
  });

  // ---------------------------------------------------------------------------
  // Light mode
  // ---------------------------------------------------------------------------

  describe('light mode', () => {
    beforeEach(() => {
      mockTheme = 'light';
    });

    it('returns isDark = false', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.isDark).toBe(false);
    });

    it('returns dark text color for readability', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.text).toBe('#111');
    });

    it('returns lighter surface color', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.surface).toContain('0.25');
    });

    it('returns lighter card background', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.cardBg).toContain('0.3');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared colors (theme-independent)
  // ---------------------------------------------------------------------------

  describe('theme-independent colors', () => {
    it('has accent color #FFD600', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.accent).toBe('#FFD600');
    });

    it('has accent hover color #E6C200', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.colors.accentHover).toBe('#E6C200');
    });

    it('has status colors (success, error, warning, info)', () => {
      const { result } = renderHook(() => useGlassStyles());
      const { colors } = result.current;
      expect(colors.success).toBe('#22c55e');
      expect(colors.error).toBe('#ef4444');
      expect(colors.warning).toBe('#f59e0b');
      expect(colors.info).toBe('#3b82f6');
    });

    it('has status background colors', () => {
      const { result } = renderHook(() => useGlassStyles());
      const { colors } = result.current;
      expect(colors.successBg).toContain('rgba');
      expect(colors.errorBg).toContain('rgba');
      expect(colors.warningBg).toContain('rgba');
      expect(colors.infoBg).toContain('rgba');
    });
  });

  // ---------------------------------------------------------------------------
  // glassCard style
  // ---------------------------------------------------------------------------

  describe('glassCard', () => {
    it('has background matching cardBg', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassCard.background).toBe(result.current.colors.cardBg);
    });

    it('has backdropFilter with blur and saturate', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassCard.backdropFilter).toContain('blur(24px)');
      expect(result.current.glassCard.backdropFilter).toContain('saturate(180%)');
    });

    it('has WebkitBackdropFilter for cross-browser support', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassCard.WebkitBackdropFilter).toBe(
        result.current.glassCard.backdropFilter,
      );
    });

    it('has borderRadius of 24px', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassCard.borderRadius).toBe('24px');
    });

    it('has a border with colors.border', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassCard.border).toContain(result.current.colors.border);
    });

    it('has a box shadow', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassCard.boxShadow).toBe(result.current.colors.glassShadow);
    });
  });

  // ---------------------------------------------------------------------------
  // glassSurface style
  // ---------------------------------------------------------------------------

  describe('glassSurface', () => {
    it('has background matching surface color', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassSurface.background).toBe(result.current.colors.surface);
    });

    it('has a smaller borderRadius than glassCard (16px vs 24px)', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassSurface.borderRadius).toBe('16px');
    });

    it('uses blur(20px) instead of blur(24px)', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassSurface.backdropFilter).toContain('blur(20px)');
    });
  });

  // ---------------------------------------------------------------------------
  // glassButton style
  // ---------------------------------------------------------------------------

  describe('glassButton', () => {
    it('has cursor pointer', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassButton.cursor).toBe('pointer');
    });

    it('has transition for smooth interactions', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassButton.transition).toContain('0.2s');
    });

    it('has text color matching theme', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassButton.color).toBe(result.current.colors.text);
    });

    it('has borderRadius of 14px', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassButton.borderRadius).toBe('14px');
    });
  });

  // ---------------------------------------------------------------------------
  // glassInput style
  // ---------------------------------------------------------------------------

  describe('glassInput', () => {
    it('has outline none for custom focus styling', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassInput.outline).toBe('none');
    });

    it('has borderRadius of 12px', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassInput.borderRadius).toBe('12px');
    });

    it('uses cardBg for background', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassInput.background).toBe(result.current.colors.cardBg);
    });
  });

  // ---------------------------------------------------------------------------
  // accentButton style
  // ---------------------------------------------------------------------------

  describe('accentButton', () => {
    it('uses the accent color as background', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.accentButton.background).toBe('#FFD600');
    });

    it('has black text for contrast on yellow', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.accentButton.color).toBe('#000');
    });

    it('has no border', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.accentButton.border).toBe('none');
    });

    it('has bold font weight', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.accentButton.fontWeight).toBe(600);
    });

    it('has a glow box-shadow', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.accentButton.boxShadow).toContain('rgba(255, 214, 0');
    });
  });

  // ---------------------------------------------------------------------------
  // glassTag style
  // ---------------------------------------------------------------------------

  describe('glassTag', () => {
    it('has small font size (12px)', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassTag.fontSize).toBe('12px');
    });

    it('has compact padding', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassTag.padding).toBe('4px 10px');
    });

    it('has a border radius of 8px', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassTag.borderRadius).toBe('8px');
    });

    it('uses secondary text color', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(result.current.glassTag.color).toBe(result.current.colors.textSecondary);
    });
  });

  // ---------------------------------------------------------------------------
  // gradientOrbs
  // ---------------------------------------------------------------------------

  describe('gradientOrbs', () => {
    it('has four orbs (purple, pink, cyan, gold)', () => {
      const { result } = renderHook(() => useGlassStyles());
      const orbs = result.current.gradientOrbs;
      expect(orbs).toHaveProperty('purple');
      expect(orbs).toHaveProperty('pink');
      expect(orbs).toHaveProperty('cyan');
      expect(orbs).toHaveProperty('gold');
    });

    it('all orbs have position fixed', () => {
      const { result } = renderHook(() => useGlassStyles());
      const orbs = result.current.gradientOrbs;
      expect(orbs.purple.position).toBe('fixed');
      expect(orbs.pink.position).toBe('fixed');
      expect(orbs.cyan.position).toBe('fixed');
      expect(orbs.gold.position).toBe('fixed');
    });

    it('all orbs have pointerEvents none (non-interactive)', () => {
      const { result } = renderHook(() => useGlassStyles());
      const orbs = result.current.gradientOrbs;
      expect(orbs.purple.pointerEvents).toBe('none');
      expect(orbs.pink.pointerEvents).toBe('none');
      expect(orbs.cyan.pointerEvents).toBe('none');
      expect(orbs.gold.pointerEvents).toBe('none');
    });

    it('all orbs have blur filter', () => {
      const { result } = renderHook(() => useGlassStyles());
      const orbs = result.current.gradientOrbs;
      expect(orbs.purple.filter).toContain('blur');
      expect(orbs.pink.filter).toContain('blur');
      expect(orbs.cyan.filter).toContain('blur');
      expect(orbs.gold.filter).toContain('blur');
    });

    it('all orbs have zIndex 0 (behind content)', () => {
      const { result } = renderHook(() => useGlassStyles());
      const orbs = result.current.gradientOrbs;
      expect(orbs.purple.zIndex).toBe(0);
      expect(orbs.pink.zIndex).toBe(0);
      expect(orbs.cyan.zIndex).toBe(0);
      expect(orbs.gold.zIndex).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Hover handlers
  // ---------------------------------------------------------------------------

  describe('hover handlers', () => {
    it('provides cardHoverHandlers with onMouseEnter and onMouseLeave', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(typeof result.current.cardHoverHandlers.onMouseEnter).toBe('function');
      expect(typeof result.current.cardHoverHandlers.onMouseLeave).toBe('function');
    });

    it('provides buttonHoverHandlers with onMouseEnter and onMouseLeave', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(typeof result.current.buttonHoverHandlers.onMouseEnter).toBe('function');
      expect(typeof result.current.buttonHoverHandlers.onMouseLeave).toBe('function');
    });

    it('provides accentButtonHoverHandlers with onMouseEnter and onMouseLeave', () => {
      const { result } = renderHook(() => useGlassStyles());
      expect(typeof result.current.accentButtonHoverHandlers.onMouseEnter).toBe('function');
      expect(typeof result.current.accentButtonHoverHandlers.onMouseLeave).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // Return shape
  // ---------------------------------------------------------------------------

  describe('return shape', () => {
    it('returns all expected keys', () => {
      const { result } = renderHook(() => useGlassStyles());
      const keys = Object.keys(result.current);
      expect(keys).toContain('isDark');
      expect(keys).toContain('colors');
      expect(keys).toContain('glassCard');
      expect(keys).toContain('glassSurface');
      expect(keys).toContain('glassButton');
      expect(keys).toContain('glassInput');
      expect(keys).toContain('accentButton');
      expect(keys).toContain('glassTag');
      expect(keys).toContain('gradientOrbs');
      expect(keys).toContain('cardHoverHandlers');
      expect(keys).toContain('buttonHoverHandlers');
      expect(keys).toContain('accentButtonHoverHandlers');
    });
  });
});

// ---------------------------------------------------------------------------
// GlassBackground component
// ---------------------------------------------------------------------------

describe('GlassBackground', () => {
  beforeEach(() => {
    mockTheme = 'dark';
  });

  it('renders four aria-hidden decorative divs', () => {
    const { container } = render(<GlassBackground />);
    const hiddenDivs = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenDivs).toHaveLength(4);
  });

  it('all gradient orb divs have position fixed style', () => {
    const { container } = render(<GlassBackground />);
    const hiddenDivs = container.querySelectorAll('[aria-hidden="true"]');
    hiddenDivs.forEach((div) => {
      expect((div as HTMLElement).style.position).toBe('fixed');
    });
  });

  it('all gradient orb divs have pointer-events none', () => {
    const { container } = render(<GlassBackground />);
    const hiddenDivs = container.querySelectorAll('[aria-hidden="true"]');
    hiddenDivs.forEach((div) => {
      expect((div as HTMLElement).style.pointerEvents).toBe('none');
    });
  });
});
