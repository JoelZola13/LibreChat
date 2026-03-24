/**
 * Tests for sbFetch — the auth-aware fetch wrapper for Street Bot Pro API.
 *
 * Tests cover:
 * - URL prepending with /sbapi prefix
 * - Authorization header injection from axios defaults
 * - Content-Type auto-detection for JSON bodies
 * - Convenience methods (sbGet, sbPost, sbPatch, sbDelete)
 * - Error handling for non-OK responses
 */
import axios from 'axios';

// Mock the apiConfig module so SB_API_BASE is predictable.
// sbFetch.ts imports from './apiConfig' (relative), which resolves to @/shared/apiConfig.
jest.mock('@/shared/apiConfig', () => ({
  SB_API_BASE: '/sbapi',
}));

// We need to mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { sbFetch, sbGet, sbPost, sbPatch, sbDelete } from '@/shared/sbFetch';

describe('sbFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    // Clear axios auth header between tests
    delete axios.defaults.headers.common['Authorization'];
  });

  // ---------------------------------------------------------------------------
  // URL prepending
  // ---------------------------------------------------------------------------

  describe('URL prepending', () => {
    it('prepends /sbapi to relative paths', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/documents');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('/sbapi/api/documents');
    });

    it('does NOT double-prepend if path already starts with /sbapi', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/sbapi/api/documents');

      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('/sbapi/api/documents');
    });

    it('preserves query parameters in the path', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/documents?limit=10&offset=0');

      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('/sbapi/api/documents?limit=10&offset=0');
    });
  });

  // ---------------------------------------------------------------------------
  // Authorization header
  // ---------------------------------------------------------------------------

  describe('Authorization header injection', () => {
    it('attaches Authorization header when axios has a Bearer token', async () => {
      axios.defaults.headers.common['Authorization'] = 'Bearer test-jwt-token-123';
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/messages');

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Authorization']).toBe('Bearer test-jwt-token-123');
    });

    it('does NOT set Authorization header when axios has no token', async () => {
      delete axios.defaults.headers.common['Authorization'];
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/messages');

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Authorization']).toBeUndefined();
    });

    it('does NOT set Authorization header when axios header is not a Bearer token', async () => {
      axios.defaults.headers.common['Authorization'] = 'Basic dXNlcjpwYXNz';
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/messages');

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Authorization']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Content-Type auto-detection
  // ---------------------------------------------------------------------------

  describe('Content-Type header', () => {
    it('sets Content-Type to application/json for string body', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('does NOT override explicit Content-Type header', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/upload', {
        method: 'POST',
        body: 'some data',
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Content-Type']).toBe('multipart/form-data');
    });

    it('does NOT set Content-Type when there is no body', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/tasks');

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Content-Type']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Custom headers passthrough
  // ---------------------------------------------------------------------------

  describe('custom headers passthrough', () => {
    it('merges custom headers with auth headers', async () => {
      axios.defaults.headers.common['Authorization'] = 'Bearer my-jwt';
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await sbFetch('/api/data', {
        headers: { 'X-Custom': 'value' },
      });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['X-Custom']).toBe('value');
      expect(init.headers['Authorization']).toBe('Bearer my-jwt');
    });
  });
});

// ---------------------------------------------------------------------------
// sbGet
// ---------------------------------------------------------------------------

describe('sbGet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    delete axios.defaults.headers.common['Authorization'];
  });

  it('makes a GET request and parses JSON response', async () => {
    const mockData = { documents: [{ id: '1', title: 'Doc 1' }] };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 }));

    const result = await sbGet('/api/documents');

    expect(result).toEqual(mockData);
    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('/sbapi/api/documents');
  });

  it('appends query params to the URL', async () => {
    mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));

    await sbGet('/api/documents', { user_id: 'u123', limit: '50' });

    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/sbapi/api/documents?');
    expect(calledUrl).toContain('user_id=u123');
    expect(calledUrl).toContain('limit=50');
  });

  it('throws an error for non-OK responses', async () => {
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

    await expect(sbGet('/api/documents')).rejects.toThrow('GET /api/documents failed: 404');
  });
});

// ---------------------------------------------------------------------------
// sbPost
// ---------------------------------------------------------------------------

describe('sbPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    delete axios.defaults.headers.common['Authorization'];
  });

  it('makes a POST request with JSON body', async () => {
    const responseData = { id: 'new-1', title: 'New Doc' };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(responseData), { status: 201 }));

    const result = await sbPost('/api/documents', { title: 'New Doc' });

    expect(result).toEqual(responseData);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'New Doc' }));
  });

  it('handles 204 No Content', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sbPost('/api/documents/1/favorite');

    expect(result).toBeUndefined();
  });

  it('handles POST with no body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sbPost('/api/ping');

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('throws on non-OK responses', async () => {
    mockFetch.mockResolvedValue(new Response('Server Error', { status: 500 }));

    await expect(sbPost('/api/documents', { title: 'x' })).rejects.toThrow(
      'POST /api/documents failed: 500',
    );
  });
});

// ---------------------------------------------------------------------------
// sbPatch
// ---------------------------------------------------------------------------

describe('sbPatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('makes a PATCH request with JSON body', async () => {
    const updated = { id: '1', title: 'Updated' };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(updated), { status: 200 }));

    const result = await sbPatch('/api/documents/1', { title: 'Updated' });

    expect(result).toEqual(updated);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('PATCH');
  });

  it('handles 204 No Content for PATCH', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sbPatch('/api/documents/1', { status: 'archived' });

    expect(result).toBeUndefined();
  });

  it('throws on non-OK responses', async () => {
    mockFetch.mockResolvedValue(new Response('Forbidden', { status: 403 }));

    await expect(sbPatch('/api/documents/1', {})).rejects.toThrow(
      'PATCH /api/documents/1 failed: 403',
    );
  });
});

// ---------------------------------------------------------------------------
// sbDelete
// ---------------------------------------------------------------------------

describe('sbDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('makes a DELETE request', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await sbDelete('/api/documents/1');

    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('/sbapi/api/documents/1');
    expect(init.method).toBe('DELETE');
  });

  it('succeeds on 200 response', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await expect(sbDelete('/api/documents/1')).resolves.toBeUndefined();
  });

  it('succeeds on 204 response', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(sbDelete('/api/documents/1')).resolves.toBeUndefined();
  });

  it('throws on non-OK responses (excluding 204)', async () => {
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

    await expect(sbDelete('/api/documents/999')).rejects.toThrow(
      'DELETE /api/documents/999 failed: 404',
    );
  });
});
