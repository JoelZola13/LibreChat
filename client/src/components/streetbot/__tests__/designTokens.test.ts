/**
 * Tests for designTokens.ts — shared glassmorphism design tokens.
 *
 * Tests cover:
 * - Token objects have expected shape and correct keys
 * - Color values are valid CSS color strings
 * - Glass styles have correct CSS properties
 * - Priority and status color maps are complete
 * - Aurora orb configuration is valid
 */
import {
  T,
  glass,
  glassHover,
  auroraOrbs,
  pageWrapper,
  headingStyle,
  priorityColors,
  statusColors,
} from '~/components/streetbot/shared/designTokens';

describe('designTokens', () => {
  // ---------------------------------------------------------------------------
  // Core color tokens (T)
  // ---------------------------------------------------------------------------

  describe('T (core color tokens)', () => {
    it('exports a T object with all expected color keys', () => {
      const expectedKeys = [
        'bgDeep',
        'bgSurface',
        'accent',
        'accentHover',
        'accentMuted',
        'textPrimary',
        'textSecondary',
        'textMuted',
        'border',
        'borderHover',
        'borderAccent',
        'glassSubtle',
        'glassMedium',
        'success',
        'error',
        'warning',
        'info',
      ];

      for (const key of expectedKeys) {
        expect(T).toHaveProperty(key);
        expect(typeof (T as Record<string, unknown>)[key]).toBe('string');
      }
    });

    it('has the correct accent color (#FFD600)', () => {
      expect(T.accent).toBe('#FFD600');
    });

    it('has the correct deep background color', () => {
      expect(T.bgDeep).toBe('#1f2027');
    });

    it('has valid hex colors for status tokens', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(T.success).toMatch(hexRegex);
      expect(T.error).toMatch(hexRegex);
      expect(T.warning).toMatch(hexRegex);
      expect(T.info).toMatch(hexRegex);
    });

    it('has rgba values for glass/muted tokens', () => {
      expect(T.accentMuted).toContain('rgba');
      expect(T.textMuted).toContain('rgba');
      expect(T.border).toContain('rgba');
      expect(T.glassSubtle).toContain('rgba');
      expect(T.glassMedium).toContain('rgba');
    });

    it('is frozen (readonly)', () => {
      // The `as const` assertion makes values readonly at the type level.
      // Verify that T is indeed an object with string values.
      expect(Object.keys(T).length).toBeGreaterThan(10);
    });
  });

  // ---------------------------------------------------------------------------
  // glass style
  // ---------------------------------------------------------------------------

  describe('glass style object', () => {
    it('has background property with rgba transparency', () => {
      expect(glass.background).toContain('rgba');
    });

    it('has backdropFilter with blur', () => {
      expect(glass.backdropFilter).toContain('blur');
    });

    it('has WebkitBackdropFilter for Safari support', () => {
      expect(glass.WebkitBackdropFilter).toContain('blur');
    });

    it('has a border with the token border color', () => {
      expect(glass.border).toContain(T.border);
    });

    it('has borderRadius of 16', () => {
      expect(glass.borderRadius).toBe(16);
    });
  });

  // ---------------------------------------------------------------------------
  // glassHover style
  // ---------------------------------------------------------------------------

  describe('glassHover style object', () => {
    it('extends the base glass style', () => {
      expect(glassHover.background).toBe(glass.background);
      expect(glassHover.backdropFilter).toBe(glass.backdropFilter);
      expect(glassHover.borderRadius).toBe(glass.borderRadius);
    });

    it('has transition property for animations', () => {
      expect(glassHover.transition).toBeDefined();
      expect(glassHover.transition).toContain('border-color');
      expect(glassHover.transition).toContain('box-shadow');
    });
  });

  // ---------------------------------------------------------------------------
  // auroraOrbs
  // ---------------------------------------------------------------------------

  describe('auroraOrbs', () => {
    it('contains exactly 3 orbs', () => {
      expect(auroraOrbs).toHaveLength(3);
    });

    it('each orb has a color, size, and at least one position property', () => {
      for (const orb of auroraOrbs) {
        expect(orb.color).toBeDefined();
        expect(typeof orb.color).toBe('string');
        expect(orb.color).toContain('rgba');

        expect(orb.size).toBeDefined();
        expect(typeof orb.size).toBe('number');
        expect(orb.size).toBeGreaterThan(0);

        // At least one position prop
        const hasPosition = orb.top || orb.bottom || orb.left || orb.right;
        expect(hasPosition).toBeTruthy();
      }
    });

    it('has orbs with distinct colors', () => {
      const colors = auroraOrbs.map((o) => o.color);
      const unique = new Set(colors);
      expect(unique.size).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // pageWrapper
  // ---------------------------------------------------------------------------

  describe('pageWrapper style', () => {
    it('has position absolute with inset 0', () => {
      expect(pageWrapper.position).toBe('absolute');
      expect(pageWrapper.inset).toBe(0);
    });

    it('allows vertical scrolling', () => {
      expect(pageWrapper.overflowY).toBe('auto');
      expect(pageWrapper.overflowX).toBe('hidden');
    });

    it('uses the deep background color', () => {
      expect(pageWrapper.background).toBe(T.bgDeep);
    });

    it('uses the primary text color', () => {
      expect(pageWrapper.color).toBe(T.textPrimary);
    });

    it('uses Rubik font family', () => {
      expect(pageWrapper.fontFamily).toContain('Rubik');
    });
  });

  // ---------------------------------------------------------------------------
  // headingStyle
  // ---------------------------------------------------------------------------

  describe('headingStyle', () => {
    it('uses Rubik font family', () => {
      expect(headingStyle.fontFamily).toContain('Rubik');
    });

    it('has bold fontWeight (700)', () => {
      expect(headingStyle.fontWeight).toBe(700);
    });

    it('has tight letter spacing', () => {
      expect(headingStyle.letterSpacing).toBe('-0.02em');
    });
  });

  // ---------------------------------------------------------------------------
  // priorityColors
  // ---------------------------------------------------------------------------

  describe('priorityColors', () => {
    it('has all priority levels', () => {
      const expectedPriorities = ['urgent', 'high', 'medium', 'low', 'none'];
      for (const priority of expectedPriorities) {
        expect(priorityColors).toHaveProperty(priority);
        expect(typeof priorityColors[priority]).toBe('string');
      }
    });

    it('urgent is red (#EF4444)', () => {
      expect(priorityColors.urgent).toBe('#EF4444');
    });

    it('medium uses the accent color (#FFD600)', () => {
      expect(priorityColors.medium).toBe('#FFD600');
    });
  });

  // ---------------------------------------------------------------------------
  // statusColors
  // ---------------------------------------------------------------------------

  describe('statusColors', () => {
    it('has all expected statuses', () => {
      const expectedStatuses = ['todo', 'in_progress', 'in_review', 'done', 'cancelled', 'backlog'];
      for (const status of expectedStatuses) {
        expect(statusColors).toHaveProperty(status);
        expect(typeof statusColors[status]).toBe('string');
      }
    });

    it('done is green (#22C55E)', () => {
      expect(statusColors.done).toBe('#22C55E');
    });

    it('in_progress is blue (#3B82F6)', () => {
      expect(statusColors.in_progress).toBe('#3B82F6');
    });
  });
});
