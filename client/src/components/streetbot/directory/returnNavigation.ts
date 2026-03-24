const INVALID_RETURN_PREFIXES = ['/directory/add', '/directory/edit'];

const normalizeReturnPath = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  return trimmed;
};

const getPathname = (path: string) => path.split('?')[0].split('#')[0];

export const resolveReturnPath = (stateReturnTo: string | null | undefined, queryReturnTo: string | null | undefined): string => {
  const candidate = normalizeReturnPath(stateReturnTo) ?? normalizeReturnPath(queryReturnTo);
  if (!candidate) {
    return '/directory';
  }

  const pathname = getPathname(candidate);
  if (INVALID_RETURN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return '/directory';
  }

  return candidate;
};

export const getReturnLabel = (returnPath: string): string => {
  const pathname = getPathname(returnPath);

  if (pathname === '/' || pathname.startsWith('/home')) {
    return 'Back to home';
  }

  if (pathname.startsWith('/directory')) {
    return 'Back to directory';
  }

  return 'Back to previous page';
};
