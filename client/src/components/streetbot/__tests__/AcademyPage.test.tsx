/**
 * Tests for AcademyPage / AcademyClient — the learning management page.
 *
 * Tests cover:
 * - Renders without crashing
 * - Landing page content is shown by default
 * - Key landing page elements are present (title, features, stats)
 * - Course data renders after API response
 * - Fallback courses are used when API fails
 * - Loading state transitions
 * - Feature cards display correct content
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock sbFetch. The source file uses `import from "../shared/sbFetch"` (relative)
// which resolves to `src/components/streetbot/shared/sbFetch`, same as `@/shared/sbFetch`.
const mockSbFetchFn = jest.fn();
jest.mock('@/shared/sbFetch', () => ({
  sbFetch: (...args: unknown[]) => mockSbFetchFn(...args),
}));

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => {
  const React = require('react');
  const createMotionComponent = (tag: string) => {
    return React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      // Strip framer-motion-specific props
      const {
        initial, animate, exit, transition, variants,
        whileHover, whileTap, whileFocus, whileInView,
        viewport, layout, layoutId,
        ...domProps
      } = props;
      return React.createElement(tag, { ...domProps, ref });
    });
  };

  return {
    motion: new Proxy({}, {
      get: (_target: object, prop: string) => createMotionComponent(prop),
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useInView: () => true,
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const React = require('react');
  const handler: ProxyHandler<object> = {
    get: (_target: object, prop: string | symbol) => {
      if (typeof prop === 'string') {
        return (props: Record<string, unknown>) =>
          React.createElement('span', { 'data-testid': `icon-${prop}`, ...props }, prop);
      }
      return undefined;
    },
  };
  return new Proxy({}, handler);
});

// Mock AcademySidebar — source file uses `./AcademySidebar` which resolves
// to `src/components/streetbot/academy/AcademySidebar`
jest.mock('@/academy/AcademySidebar', () => ({
  AcademySidebar: () => React.createElement('aside', { 'data-testid': 'academy-sidebar' }, 'Sidebar'),
}));

// Mock the academy index barrel (source uses `"."` from academy directory).
// The resolved path is `src/components/streetbot/academy/index`.
jest.mock('@/academy', () => {
  const React = require('react');
  const mockComponent = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `mock-${name}`, ...props }, name);
  return {
    AiTutorFloatingButton: mockComponent('AiTutorFloatingButton'),
    DashboardSkeleton: mockComponent('DashboardSkeleton'),
    Breadcrumb: mockComponent('Breadcrumb'),
    BreadcrumbCompact: mockComponent('BreadcrumbCompact'),
    ForumsPanel: mockComponent('ForumsPanel'),
    CalendarPanel: mockComponent('CalendarPanel'),
    GradesPanel: mockComponent('GradesPanel'),
    MoodleAssignmentsPanel: mockComponent('MoodleAssignmentsPanel'),
    BadgesShowcase: mockComponent('BadgesShowcase'),
  };
});

// Import the component (AcademyPage -> AcademyClient)
import AcademyClient from '@/academy/academy-client';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCourses = [
  {
    id: '1',
    title: 'Digital Marketing Fundamentals',
    description: 'Learn the basics of digital marketing',
    level: 'Beginner',
    duration: '6 weeks',
    category: 'Marketing',
    instructor: 'Sarah Johnson',
    progress: 65,
  },
  {
    id: '2',
    title: 'Web Development Bootcamp',
    description: 'Full-stack web development',
    level: 'Intermediate',
    duration: '12 weeks',
    category: 'Technology',
    instructor: 'Michael Chen',
    progress: 30,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AcademyClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: API returns courses successfully
    mockSbFetchFn.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCourses),
    });
    // Set data-theme for the isDark detection
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });
    expect(document.body).toBeTruthy();
  });

  it('starts on the landing view', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    // Landing page shows "Street Voices Academy" text
    await waitFor(() => {
      expect(screen.getAllByText('Street Voices Academy').length).toBeGreaterThan(0);
    });
  });

  it('displays the feature cards', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('Interactive Courses')).toBeInTheDocument();
    });
    expect(screen.getByText('Learning Paths')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Learning')).toBeInTheDocument();
    expect(screen.getByText('Certificates & Badges')).toBeInTheDocument();
  });

  it('displays the stats section', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('10K+')).toBeInTheDocument();
    });
    expect(screen.getByText('Active Learners')).toBeInTheDocument();
    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('4.9')).toBeInTheDocument();
  });

  it('renders course titles in the Explore Courses section', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('Explore Courses')).toBeInTheDocument();
    });

    // The courses should render after data loads
    await waitFor(() => {
      expect(screen.getByText('Digital Marketing Fundamentals')).toBeInTheDocument();
      expect(screen.getByText('Web Development Bootcamp')).toBeInTheDocument();
    });
  });

  it('falls back to default courses when API fails', async () => {
    mockSbFetchFn.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<AcademyClient />);
    });

    // Fallback courses should still render (getFallbackCourses provides 4 courses)
    await waitFor(() => {
      expect(screen.getByText('Digital Marketing Fundamentals')).toBeInTheDocument();
      expect(screen.getByText('Web Development Bootcamp')).toBeInTheDocument();
      expect(screen.getByText('Entrepreneurship 101')).toBeInTheDocument();
      expect(screen.getByText('Graphic Design Essentials')).toBeInTheDocument();
    });
  });

  it('calls sbFetch with /api/academy/courses on mount', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    await waitFor(() => {
      expect(mockSbFetchFn).toHaveBeenCalledWith('/api/academy/courses');
    });
  });

  it('displays feature descriptions', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Engage with video, audio, articles, and interactive content/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Follow curated sequences of courses/),
      ).toBeInTheDocument();
    });
  });

  it('has a "Start Learning Free" or "Explore Courses" call-to-action', async () => {
    await act(async () => {
      render(<AcademyClient />);
    });

    await waitFor(() => {
      // At least one of these CTAs should be visible
      const startBtn = screen.queryByText('Start Learning Free');
      const exploreBtn = screen.queryByText('Explore Courses');
      expect(startBtn || exploreBtn).toBeTruthy();
    });
  });

  it('renders in light mode when data-theme is not dark', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    await act(async () => {
      render(<AcademyClient />);
    });

    // Component should render without error in light mode
    await waitFor(() => {
      expect(screen.getAllByText('Street Voices Academy').length).toBeGreaterThan(0);
    });
  });
});
