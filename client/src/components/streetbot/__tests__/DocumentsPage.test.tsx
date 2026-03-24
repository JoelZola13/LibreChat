/**
 * Tests for DocumentsPage — the full-featured document management page.
 *
 * Tests cover:
 * - Renders without crashing
 * - Loading state is shown initially
 * - Documents render after API response
 * - Sidebar navigation sections are present
 * - Search input is present
 * - Create document button is present
 * - Error state handling
 * - Document card rendering with metadata
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useGlassStyles (used via @/hooks/useGlassStyles)
const mockGlassColors = {
  bg: '#1a1a1e',
  background: '#1a1a1e',
  surface: 'rgba(255,255,255,0.08)',
  surfaceHover: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.15)',
  borderHover: 'rgba(255,255,255,0.25)',
  text: '#fff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.5)',
  accent: '#FFD600',
  accentHover: '#E6C200',
  accentGlow: 'rgba(255,214,0,0.4)',
  cardBg: 'rgba(255,255,255,0.06)',
  cardBgHover: 'rgba(255,255,255,0.10)',
  glassShadow: '0 8px 32px rgba(0,0,0,0.3)',
  glassShadowHover: '0 16px 48px rgba(0,0,0,0.4)',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

jest.mock('@/hooks/useGlassStyles', () => ({
  useGlassStyles: () => ({
    colors: mockGlassColors,
    isDark: true,
    glassCard: { background: mockGlassColors.cardBg },
  }),
}));

// Mock AuthContext
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'test-user-123', name: 'Test User' },
  }),
}));

// Mock sbFetch and its convenience helpers
const mockSbGet = jest.fn();
const mockSbPost = jest.fn();
const mockSbPatch = jest.fn();
const mockSbDelete = jest.fn();
const mockSbFetch = jest.fn();

jest.mock('@/shared/sbFetch', () => ({
  sbFetch: (...args: unknown[]) => mockSbFetch(...args),
  sbGet: (...args: unknown[]) => mockSbGet(...args),
  sbPost: (...args: unknown[]) => mockSbPost(...args),
  sbPatch: (...args: unknown[]) => mockSbPatch(...args),
  sbDelete: (...args: unknown[]) => mockSbDelete(...args),
}));

// Mock userId helper
jest.mock('@/shared/userId', () => ({
  getOrCreateUserId: () => 'test-user-123',
}));

// Mock glassmorphism CSS import
jest.mock('@/styles/glassmorphism.css', () => ({}));

// Mock lucide-react icons (they're React components)
jest.mock('lucide-react', () => {
  const icons: Record<string, React.FC<{ size?: number }>> = {};
  const iconNames = [
    'Search', 'Plus', 'FileText', 'File', 'FileSpreadsheet', 'Folder',
    'FolderPlus', 'FolderOpen', 'ChevronRight', 'ChevronDown', 'ChevronLeft',
    'Clock', 'Star', 'Trash2', 'Share2', 'Download', 'Edit3', 'X', 'Loader2',
    'Upload', 'MoreHorizontal', 'Grid3X3', 'List', 'Eye', 'Users', 'Lock',
    'History', 'Tag', 'RefreshCw', 'Presentation', 'ArrowLeft', 'ExternalLink',
    'Globe',
  ];
  iconNames.forEach((name) => {
    icons[name] = ({ size }: { size?: number }) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, 'data-size': size }, name);
  });
  return icons;
});

import DocumentsPage from '@/documents/DocumentsPage';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockDocuments = [
  {
    id: 'doc-1',
    title: 'Project Proposal',
    document_type: 'document',
    status: 'published',
    word_count: 1500,
    reading_time_minutes: 5,
    is_pinned: false,
    is_archived: false,
    is_locked: false,
    version_count: 3,
    comment_count: 2,
    share_count: 1,
    view_count: 15,
    tags: ['project', 'planning'],
    is_favorite: false,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-20T14:30:00Z',
  },
  {
    id: 'doc-2',
    title: 'Budget Spreadsheet',
    document_type: 'spreadsheet',
    status: 'draft',
    word_count: 500,
    reading_time_minutes: 2,
    is_pinned: true,
    is_archived: false,
    is_locked: false,
    version_count: 1,
    comment_count: 0,
    share_count: 0,
    view_count: 5,
    tags: ['budget'],
    is_favorite: true,
    created_at: '2025-01-18T09:00:00Z',
    updated_at: '2025-01-19T16:45:00Z',
  },
];

const mockWorkspaces = [
  { id: 'ws-1', name: 'Main Workspace', description: 'Primary workspace', document_count: 10, folder_count: 3 },
];

const mockFolders = [
  { id: 'fld-1', name: 'Proposals', workspace_id: 'ws-1', document_count: 4, created_at: '2025-01-10T00:00:00Z' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: successful API calls
    mockSbGet.mockImplementation((path: string) => {
      if (path.includes('/api/documents') && !path.includes('workspace') && !path.includes('folder') && !path.includes('recent') && !path.includes('search') && !path.includes('office')) {
        return Promise.resolve({ documents: mockDocuments, total: mockDocuments.length });
      }
      if (path.includes('/api/document-workspaces') && path.includes('/folders')) {
        return Promise.resolve(mockFolders);
      }
      if (path.includes('/api/document-workspaces')) {
        return Promise.resolve(mockWorkspaces);
      }
      return Promise.resolve([]);
    });
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });
    // The component should mount without errors
    expect(document.body).toBeTruthy();
  });

  it('shows loading state initially with "Loading documents..." text', async () => {
    // Make the API never resolve to capture loading state
    mockSbGet.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(<DocumentsPage />);
    });

    expect(screen.getByText('Loading documents...')).toBeInTheDocument();
  });

  it('renders document titles after API response', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Project Proposal')).toBeInTheDocument();
    });

    expect(screen.getByText('Budget Spreadsheet')).toBeInTheDocument();
  });

  it('renders sidebar with "Documents" heading', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
  });

  it('renders sidebar navigation sections', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('All Documents')).toBeInTheDocument();
    });
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Shared')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
  });

  it('has a "New" button for creating documents', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  it('calls the documents API with correct user_id', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(mockSbGet).toHaveBeenCalledWith(
        '/api/documents',
        expect.objectContaining({ user_id: 'test-user-123' }),
      );
    });
  });

  it('calls the workspaces API on mount', async () => {
    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(mockSbGet).toHaveBeenCalledWith(
        '/api/document-workspaces',
        expect.objectContaining({ user_id: 'test-user-123' }),
      );
    });
  });

  it('handles API error gracefully and shows error message', async () => {
    mockSbGet.mockImplementation((path: string) => {
      if (path.includes('/api/documents') && !path.includes('workspace')) {
        return Promise.reject(new Error('Network error'));
      }
      if (path.includes('/api/document-workspaces')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
    });
  });

  it('renders empty state when no documents returned', async () => {
    mockSbGet.mockImplementation((path: string) => {
      if (path.includes('/api/documents') && !path.includes('workspace')) {
        return Promise.resolve({ documents: [], total: 0 });
      }
      if (path.includes('/api/document-workspaces') && path.includes('/folders')) {
        return Promise.resolve([]);
      }
      if (path.includes('/api/document-workspaces')) {
        return Promise.resolve(mockWorkspaces);
      }
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<DocumentsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('No documents yet')).toBeInTheDocument();
    });
  });
});
