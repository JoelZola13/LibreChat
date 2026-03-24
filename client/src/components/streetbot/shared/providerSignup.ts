export type PendingProviderSignup = {
  accountType: 'provider';
  organizationName: string;
  organizationRole: string;
  email?: string;
  name?: string;
  newsletterOptIn?: boolean;
  createdAt: string;
};

export const PROVIDER_SIGNUP_STORAGE_KEY = 'streetbot:providerSignup';

const getStorageTargets = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  const targets: Storage[] = [];

  try {
    targets.push(window.sessionStorage);
  } catch {
    // ignore storage access failures
  }

  try {
    targets.push(window.localStorage);
  } catch {
    // ignore storage access failures
  }

  return targets;
};

const normalizeString = (value?: string | null) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

export const savePendingProviderSignup = (payload: {
  organizationName: string;
  organizationRole: string;
  email?: string;
  name?: string;
  newsletterOptIn?: boolean;
}) => {
  const organizationName = normalizeString(payload.organizationName);
  const organizationRole = normalizeString(payload.organizationRole);
  if (!organizationName || !organizationRole) {
    return;
  }

  const record: PendingProviderSignup = {
    accountType: 'provider',
    organizationName,
    organizationRole,
    email: normalizeString(payload.email) || undefined,
    name: normalizeString(payload.name) || undefined,
    newsletterOptIn: Boolean(payload.newsletterOptIn),
    createdAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(record);

  for (const storage of getStorageTargets()) {
    storage.setItem(PROVIDER_SIGNUP_STORAGE_KEY, serialized);
  }
};

export const readPendingProviderSignup = (): PendingProviderSignup | null => {
  for (const storage of getStorageTargets()) {
    const rawValue = storage.getItem(PROVIDER_SIGNUP_STORAGE_KEY);
    if (!rawValue) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<PendingProviderSignup>;
      const organizationName = normalizeString(parsed.organizationName);
      const organizationRole = normalizeString(parsed.organizationRole);
      if (!organizationName || !organizationRole || parsed.accountType !== 'provider') {
        continue;
      }

      return {
        accountType: 'provider',
        organizationName,
        organizationRole,
        email: normalizeString(parsed.email) || undefined,
        name: normalizeString(parsed.name) || undefined,
        newsletterOptIn: Boolean(parsed.newsletterOptIn),
        createdAt:
          typeof parsed.createdAt === 'string' && parsed.createdAt.length > 0
            ? parsed.createdAt
            : new Date().toISOString(),
      };
    } catch {
      continue;
    }
  }

  return null;
};

export const clearPendingProviderSignup = () => {
  for (const storage of getStorageTargets()) {
    storage.removeItem(PROVIDER_SIGNUP_STORAGE_KEY);
  }
};
