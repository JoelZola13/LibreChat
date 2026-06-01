import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { Frame, Page, Route } from '@playwright/test';

const messagesFrame = 'iframe[title="Street Voices Messages"]';
const messagesSidebar = 'aside[aria-label="Messages workspace"]';
const defaultMessagesStorageState = path.resolve(
  process.cwd(),
  'e2e/.auth/messages-storage-state.json',
);
const resolvedMessagesStorageState =
  process.env.MESSAGES_STORAGE_STATE || defaultMessagesStorageState;
const hasAuthenticatedStorageState = Boolean(
  process.env.MESSAGES_STORAGE_STATE || fs.existsSync(defaultMessagesStorageState),
);

type CapturedMessagePost = {
  content?: string;
  parentId?: string;
  attachments?: UploadedAttachment[];
  metadata?: {
    type?: 'voice' | 'email_import' | 'email_reply';
    duration?: number;
    transcription?: string;
    transcriptionStatus?: 'pending' | 'complete' | 'failed';
    transcriptionError?: string;
    email?: {
      provider?: string;
      subject: string;
      from?: {
        name?: string;
        email?: string;
      };
      sentAt?: string;
      messageId?: string;
      bodyPreview?: string;
    };
    emailReply?: {
      sourceMessageId: string;
      to: {
        name?: string;
        email: string;
      };
      subject: string;
      sentAt: string;
    };
  };
};

type CapturedReactionPost = {
  emoji?: string;
};

type UploadedAttachment = {
  id?: string;
  fileName?: string;
  mimeType?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
};

type SetupDiagnosticCheck = {
  id: string;
  status: string;
};

type ControlIssue = {
  kind: string;
  descriptor: string;
};

type SmokeNotificationLevel = 'ALL' | 'MENTIONS' | 'MUTED';

type SmokeChannelSummary = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  type: 'PUBLIC' | 'PRIVATE';
  iconEmoji: string | null;
  isDefault: boolean;
  isArchived: boolean;
  isMember: boolean;
  memberCount: number;
  messageCount: number;
  role?: string;
  canCreate: boolean;
  canManage: boolean;
};

const authRedirectPattern = /\/api\/auth\/error|\/social\/login|\/login/;
const tinyVoiceDataUrl =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const tinyVoiceBase64 = tinyVoiceDataUrl.split(',')[1];
const requiredSetupChecks = [
  'social-service',
  'social-auth-provider',
  'social-database',
  'librechat-auth-bridge',
  'host-health-check',
];

function socialMessage(
  channelId: string,
  content: string,
  parentId: string | null = null,
  extras: Pick<CapturedMessagePost, 'attachments' | 'metadata'> = {},
) {
  const createdAt = new Date().toISOString();
  const id = `e2e-${parentId ? 'reply' : 'message'}-${Date.now()}`;

  return {
    id,
    channelId,
    content,
    createdAt,
    isEdited: false,
    isPinned: false,
    isSaved: false,
    parentId,
    replyCount: 0,
    author: {
      id: 'e2e-current-user',
      username: 'e2e',
      displayName: 'E2E User',
      avatarUrl: null,
      isAgent: false,
    },
    reactions: [],
    attachments: (extras.attachments || []).map((attachment, index) => ({
      id: attachment.id || `${id}-attachment-${index}`,
      fileName: attachment.fileName || `attachment-${index + 1}`,
      mimeType: attachment.mimeType || 'application/octet-stream',
      url: attachment.url || 'https://example.test/attachment',
      width: attachment.width ?? null,
      height: attachment.height ?? null,
    })),
    metadata: extras.metadata,
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function channelIdFromUrl(url: string) {
  const match = url.match(/\/(?:channels|dm)\/([^/?#]+)/);
  return match?.[1] || 'e2e-channel';
}

function notificationPreferencePayload(
  channelId: string,
  level: SmokeNotificationLevel,
  channelName = 'codex notifications',
) {
  return {
    channelId,
    channelName,
    channelType: 'PUBLIC',
    level,
    mutedAt: level === 'MUTED' ? new Date('2026-01-01T12:00:00.000Z').toISOString() : null,
  };
}

async function getMessagesIframe(page: Page): Promise<Frame> {
  const iframe = page.locator(messagesFrame);
  await expect(iframe).toHaveCount(1);
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error('Messages iframe was not available');
  await expect(frame.locator(messagesSidebar)).toBeVisible();
  return frame;
}

async function installConversationApiMocks(
  page: Page,
  options: {
    reactionError?: string;
    threadLoadErrorOnce?: string;
    messagePostErrorOnce?: string;
    threadPostErrorOnce?: string;
    messageResponseExtras?: Pick<CapturedMessagePost, 'attachments' | 'metadata'>;
  } = {},
) {
  const messages: CapturedMessagePost[] = [];
  const reactions: CapturedReactionPost[] = [];
  let threadLoadErrorServed = false;
  let messagePostErrorServed = false;
  let threadPostErrorServed = false;

  await page.route('**/social/api/channels/*/messages**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.includes('/reactions')) {
      await route.fallback();
      return;
    }

    const channelId = channelIdFromUrl(url.pathname);

    if (request.method() === 'GET' && url.searchParams.has('parentId')) {
      if (options.threadLoadErrorOnce && !threadLoadErrorServed) {
        threadLoadErrorServed = true;
        await fulfillJson(route, 503, { error: options.threadLoadErrorOnce });
        return;
      }
      await fulfillJson(route, 200, { messages: [], nextCursor: null });
      return;
    }

    if (request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}') as CapturedMessagePost;
      if (body.parentId && options.threadPostErrorOnce && !threadPostErrorServed) {
        threadPostErrorServed = true;
        await fulfillJson(route, 503, { error: options.threadPostErrorOnce });
        return;
      }
      if (!body.parentId && options.messagePostErrorOnce && !messagePostErrorServed) {
        messagePostErrorServed = true;
        await fulfillJson(route, 503, { error: options.messagePostErrorOnce });
        return;
      }
      messages.push(body);
      await fulfillJson(
        route,
        201,
        socialMessage(channelId, body.content || '', body.parentId || null, {
          attachments: body.attachments || options.messageResponseExtras?.attachments,
          metadata: body.metadata || options.messageResponseExtras?.metadata,
        }),
      );
      return;
    }

    await route.fallback();
  });

  await page.route('**/social/api/channels/*/messages/*/reactions', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }

    const body = JSON.parse(request.postData() || '{}') as CapturedReactionPost;
    reactions.push(body);
    if (options.reactionError) {
      await fulfillJson(route, 503, { error: options.reactionError });
      return;
    }
    await fulfillJson(route, 200, {
      reactions: [{ emoji: body.emoji || '👍', count: 1, users: ['e2e-current-user'] }],
    });
  });

  return { messages, reactions };
}

async function openFirstConversation(scope: Page | Frame) {
  const conversationLinks = scope
    .locator(messagesSidebar)
    .locator('a[href*="/channels/"], a[href*="/dm/"]');
  const conversationCount = await conversationLinks.count();
  expect(
    conversationCount,
    'Messages needs at least one seeded channel or DM for conversation smoke coverage',
  ).toBeGreaterThan(0);

  await conversationLinks.first().click();
  await expect(scope.getByTestId('message-composer')).toBeVisible();
}

async function readEmbeddedSidebarThemeStyles(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(authRedirectPattern);
  await expect(page).toHaveURL(/\/social\/dm/);

  const aside = page.locator(messagesSidebar);
  await expect(aside).toBeVisible();
  return aside.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      color: styles.color,
    };
  });
}

async function expectVisibleControlsLookActionable(scope: Page | Frame, label: string) {
  const issues = await scope.locator('button, a, [role="button"]').evaluateAll((elements) => {
    const visible = (element: Element) => {
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const labelFor = (element: Element) => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const labelledByText = labelledBy
        ?.split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean)
        .join(' ');

      return (
        element.getAttribute('aria-label')?.trim() ||
        labelledByText ||
        element.getAttribute('title')?.trim() ||
        element.textContent?.trim() ||
        element.querySelector('img[alt]')?.getAttribute('alt')?.trim() ||
        ''
      );
    };

    const descriptorFor = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      const name = labelFor(element) || '<no label>';
      const testId = element.getAttribute('data-testid');
      const href = element.getAttribute('href');
      return [tag, testId ? `[data-testid="${testId}"]` : null, `"${name}"`, href || null]
        .filter(Boolean)
        .join(' ');
    };

    const issues: ControlIssue[] = [];
    for (const element of elements) {
      if (!visible(element)) continue;

      const label = labelFor(element);
      if (!label) {
        issues.push({ kind: 'missing-label', descriptor: descriptorFor(element) });
      }

      if (element.tagName.toLowerCase() === 'a') {
        const href = element.getAttribute('href')?.trim() || '';
        const normalizedHref = href.toLowerCase();
        const ariaDisabled = element.getAttribute('aria-disabled') === 'true';
        if (!ariaDisabled && (!href || href === '#' || normalizedHref.startsWith('javascript:'))) {
          issues.push({ kind: 'placeholder-link', descriptor: descriptorFor(element) });
        }
      }
    }

    return issues;
  });

  expect(issues, `${label} should not expose unlabeled controls or placeholder links`).toEqual([]);
}

async function installCallMediaMocks(page: Page) {
  await page.addInitScript(() => {
    const callWindow = window as typeof window & {
      __codexRejectCallMedia?: boolean;
      __codexRejectScreenShare?: boolean;
    };
    callWindow.__codexRejectCallMedia = false;
    callWindow.__codexRejectScreenShare = false;

    const createVideoStream = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      context!.fillStyle = '#111827';
      context!.fillRect(0, 0, canvas.width, canvas.height);
      context!.fillStyle = '#22c55e';
      context!.fillRect(16, 16, 96, 64);
      return canvas.captureStream();
    };

    class MockRTCPeerConnection {
      ontrack: ((event: unknown) => void) | null = null;
      onicecandidate: ((event: { candidate: null }) => void) | null = null;
      senders: Array<{
        track: MediaStreamTrack;
        replaceTrack: (track: MediaStreamTrack) => Promise<void>;
      }> = [];

      addTrack(track: MediaStreamTrack) {
        const sender = {
          track,
          replaceTrack: async (replacement: MediaStreamTrack) => {
            sender.track = replacement;
          },
        };
        this.senders.push(sender);
        return sender;
      }

      async createOffer() {
        return { type: 'offer', sdp: 'codex-offer' };
      }

      async createAnswer() {
        return { type: 'answer', sdp: 'codex-answer' };
      }

      async setLocalDescription() {
        return undefined;
      }

      async setRemoteDescription() {
        return undefined;
      }

      async addIceCandidate() {
        return undefined;
      }

      getSenders() {
        return this.senders;
      }

      close() {
        return undefined;
      }
    }

    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      value: MockRTCPeerConnection,
    });
    Object.defineProperty(window, 'RTCSessionDescription', {
      configurable: true,
      value: function MockRTCSessionDescription(description: RTCSessionDescriptionInit) {
        return description;
      },
    });
    Object.defineProperty(window, 'RTCIceCandidate', {
      configurable: true,
      value: function MockRTCIceCandidate(candidate: RTCIceCandidateInit) {
        return candidate;
      },
    });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (callWindow.__codexRejectCallMedia) {
            throw new DOMException('Call media denied by smoke test', 'NotAllowedError');
          }
          return createVideoStream();
        },
        getDisplayMedia: async () => {
          if (callWindow.__codexRejectScreenShare) {
            throw new DOMException('Screen share denied by smoke test', 'NotAllowedError');
          }
          return createVideoStream();
        },
      },
    });
  });
}

async function installVoiceRecordingMocks(
  page: Page,
  options: {
    rejectFirstGetUserMedia?: boolean;
    mimeType?: string;
    voiceBase64?: string;
  } = {},
) {
  await page.addInitScript((mockOptions) => {
    let getUserMediaAttempts = 0;
    const configuredMimeType = mockOptions.mimeType || 'audio/webm';

    class MockMediaRecorder {
      static isTypeSupported(type: string) {
        if (mockOptions.mimeType) return type === configuredMimeType;
        return type.startsWith('audio/webm');
      }

      state = 'inactive';
      mimeType = configuredMimeType;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream, recorderOptions?: MediaRecorderOptions) {
        this.mimeType = recorderOptions?.mimeType || configuredMimeType;
      }

      start() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        let payload: BlobPart = 'codex voice smoke';
        if (mockOptions.voiceBase64) {
          const binary = atob(mockOptions.voiceBase64);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
          }
          payload = bytes;
        }

        this.ondataavailable?.({
          data: new Blob([payload], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    class MockAudioContext {
      createMediaStreamSource() {
        return { connect: () => undefined };
      }

      createAnalyser() {
        return {
          fftSize: 64,
          frequencyBinCount: 16,
          getByteFrequencyData: (data: Uint8Array) => data.fill(18),
        };
      }
    }

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          getUserMediaAttempts += 1;
          if (mockOptions.rejectFirstGetUserMedia && getUserMediaAttempts === 1) {
            throw new DOMException('Microphone denied by smoke test', 'NotAllowedError');
          }

          return {
            getTracks: () => [{ stop: () => undefined }],
          };
        },
      },
    });
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });
  }, options);
}

test.describe('Social Messages setup diagnostics', () => {
  test('reports every teammate setup dependency as ok', async ({ request }) => {
    const response = await request.get('/social/api/setup/diagnostics');
    expect(response.ok()).toBeTruthy();

    const diagnostics = (await response.json()) as {
      status?: string;
      checks?: SetupDiagnosticCheck[];
    };

    expect(diagnostics.status).toBe('ok');
    expect(Array.isArray(diagnostics.checks)).toBe(true);

    const checksById = new Map((diagnostics.checks || []).map((check) => [check.id, check]));
    for (const checkId of requiredSetupChecks) {
      expect(checksById.get(checkId)?.status).toBe('ok');
    }
  });
});

test.describe('Social Messages smoke', () => {
  test.skip(
    !hasAuthenticatedStorageState,
    'Set MESSAGES_STORAGE_STATE to an authenticated LibreChat storage-state file before running Messages smoke tests.',
  );

  test.afterEach(async ({ context }) => {
    if (!hasAuthenticatedStorageState) return;
    fs.mkdirSync(path.dirname(resolvedMessagesStorageState), { recursive: true });
    await context.storageState({ path: resolvedMessagesStorageState });
  });

  test('LibreChat /messages uses one shell auth and renders both sidebars', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(authRedirectPattern);
    await expect(page.locator('nav[aria-label="Chat History"]')).toHaveCount(1);
    await expect(page.locator('#sv-standalone-sidebar')).toHaveCount(0);
    await expect(page.locator(messagesFrame)).toHaveCount(1);

    const frame = page.frameLocator(messagesFrame);
    await expect(frame.locator(messagesSidebar)).toBeVisible();
    await expect(frame.getByText('Direct messages').first()).toBeVisible();
  });

  test('LibreChat /messages permalink query opens the requested embedded conversation', async ({
    page,
  }) => {
    await page.goto('/messages?channel=channel-channel-random&message=e2e-message-link', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).not.toHaveURL(authRedirectPattern);
    await expect(page.locator(messagesFrame)).toHaveAttribute(
      'src',
      /\/social\/channels\/channel-random\?embed=true&message=e2e-message-link/,
    );
  });

  test('LibreChat /messages surfaces setup diagnostics when Social is unreachable', async ({
    page,
  }) => {
    let diagnosticsRequests = 0;

    await page.route('**/social/api/setup/diagnostics', async (route) => {
      diagnosticsRequests += 1;
      await route.fulfill({
        status: 502,
        contentType: 'text/plain',
        body: 'bad gateway',
      });
    });

    await page.goto('/messages', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(authRedirectPattern);
    await expect(page.getByText('Setup diagnostics')).toBeVisible();
    await expect(page.getByText('Messages setup needs attention')).toBeVisible();
    await expect(page.getByText('Social service')).toBeVisible();
    await expect(page.getByText('cd social && npm run health', { exact: true })).toBeVisible();

    const retryButton = page.getByRole('button', { name: 'Run checks again' });
    await expect(retryButton).toBeEnabled();
    await retryButton.click();
    await expect.poll(() => diagnosticsRequests).toBeGreaterThanOrEqual(2);
  });

  test('LibreChat /messages permalink query highlights the requested message inside embedded Social', async ({
    page,
  }) => {
    const channelName = `codex-permalink-${Date.now()}`;
    let createdChannelId: string | null = null;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Permalink smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const messageResponse = await page.request.post(
      `/social/api/channels/${createdChannelId}/messages`,
      {
        data: { content: `Codex permalink smoke ${Date.now()}` },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
    const createdMessage = (await messageResponse.json()) as { id?: string };
    const messageId = createdMessage.id || null;
    expect(messageId).toBeTruthy();

    const channelParam = `channel-${createdChannelId}`;

    try {
      await page.goto(`/messages?channel=${channelParam}&message=${messageId}`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.locator(messagesFrame)).toHaveAttribute(
        'src',
        new RegExp(`/social/.+\\?embed=true&message=${messageId}`),
      );

      const frame = await getMessagesIframe(page);
      const highlightedRow = frame.locator(
        `[data-testid="message-row"][data-message-id="${messageId}"]`,
      );
      await expect(highlightedRow).toHaveAttribute('aria-current', 'true');
      await expect(highlightedRow).toHaveClass(/ring-accent/);
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('read receipts ignore stale message ids and recover for valid messages', async ({
    page,
  }) => {
    const channelName = `codex-read-receipts-${Date.now()}`;
    let createdChannelId: string | null = null;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Read receipt smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const messageResponse = await page.request.post(
      `/social/api/channels/${createdChannelId}/messages`,
      {
        data: { content: `Codex read receipt smoke ${Date.now()}` },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
    const createdMessage = (await messageResponse.json()) as { id?: string };
    const messageId = createdMessage.id || null;
    expect(messageId).toBeTruthy();

    try {
      const staleResponse = await page.request.post(
        `/social/api/channels/${createdChannelId}/read`,
        {
          data: { messageId: `missing-read-message-${Date.now()}` },
        },
      );
      expect(staleResponse.status()).toBe(202);
      await expect(staleResponse.json()).resolves.toEqual(
        expect.objectContaining({
          ignored: true,
          reason: 'message-not-found',
        }),
      );

      const validResponse = await page.request.post(
        `/social/api/channels/${createdChannelId}/read`,
        {
          data: { messageId },
        },
      );
      expect(validResponse.ok()).toBeTruthy();
      await expect(validResponse.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          messageId,
        }),
      );

      const receiptsResponse = await page.request.get(
        `/social/api/channels/${createdChannelId}/read`,
      );
      expect(receiptsResponse.ok()).toBeTruthy();
      const receipts = (await receiptsResponse.json()) as Array<{ messageId?: string }>;
      expect(receipts.some((receipt) => receipt.messageId === messageId)).toBe(true);
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('embedded Social messages supports light and dark themes', async ({ page, context }) => {
    const lightStyles = await readEmbeddedSidebarThemeStyles(
      page,
      '/social/dm?embed=true&theme=light',
    );

    const darkStyles = await (async () => {
      const darkPage = await context.newPage();
      try {
        return await readEmbeddedSidebarThemeStyles(darkPage, '/social/dm?embed=true&theme=dark');
      } finally {
        await darkPage.close();
      }
    })();

    expect(lightStyles.background).not.toEqual(darkStyles.background);
    expect(lightStyles.color).not.toEqual(darkStyles.color);
  });

  test('mobile Messages quick switcher stays visible outside the translated sidebar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 760 });
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(authRedirectPattern);
    await expect(page.locator(messagesFrame)).toHaveCount(1);
    const parentMobileNavMask = page.locator('#mobile-nav-mask-toggle.active');
    if ((await parentMobileNavMask.count()) > 0) {
      await parentMobileNavMask.click();
      await expect(page.locator('#mobile-nav-mask-toggle')).not.toHaveClass(/active/);
    }

    const frame = page.frameLocator(messagesFrame);
    await frame.getByRole('button', { name: 'Open messages sidebar' }).click();
    await expect(frame.locator(messagesSidebar)).toBeVisible();
    await expect(frame.locator(messagesSidebar)).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    await frame.getByRole('button', { name: 'Open quick switcher' }).click();
    await expect(frame.getByRole('dialog', { name: 'Quick switcher' })).toBeVisible();
    await expect(frame.getByPlaceholder('Jump to a channel, DM, or agent')).toBeVisible();
  });

  test('visible Messages controls expose labels and non-placeholder links', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const frame = await getMessagesIframe(page);
    await expectVisibleControlsLookActionable(frame, 'embedded Messages workspace');

    await frame.getByRole('button', { name: 'Open quick switcher' }).click();
    await expect(frame.getByRole('dialog', { name: 'Quick switcher' })).toBeVisible();
    await expectVisibleControlsLookActionable(frame, 'Messages quick switcher');
  });

  test('workspace switcher menu opens real workspace actions', async ({ page }) => {
    await page.goto('/social/channels?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const switcher = page.getByRole('button', { name: 'Open workspace switcher' });
    await expect(switcher).toBeVisible();
    await switcher.click();

    let menu = page.getByRole('menu', { name: 'Street Voices workspace menu' });
    await expect(menu).toBeVisible();
    await expect(switcher).toHaveAttribute('aria-expanded', 'true');

    await menu.getByRole('menuitem', { name: 'Search Street Voices workspace' }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Quick switcher' })).toBeVisible();
    await page.getByLabel('Close quick switcher').click();

    await switcher.click();
    menu = page.getByRole('menu', { name: 'Street Voices workspace menu' });
    await menu.getByRole('menuitem', { name: 'Compose a new direct message' }).click();
    await expect(page.getByRole('dialog', { name: 'New message quick switcher' })).toBeVisible();
    await page.getByLabel('Close quick switcher').click();

    await switcher.click();
    menu = page.getByRole('menu', { name: 'Street Voices workspace menu' });
    await expect(menu.getByRole('menuitem', { name: 'Channel browser' })).toHaveAttribute(
      'href',
      /\/social\/channels\?embed=true$/,
    );
    await menu.getByRole('menuitem', { name: 'Later' }).click();
    await expect(page).toHaveURL(/\/social\/saved\?embed=true/);
  });

  test('sidebar and quick switcher DM controls show request feedback', async ({ page }) => {
    let dmRequestCount = 0;
    const smokeTeammate = {
      id: 'e2e-sidebar-dm-target',
      username: 'codex_dm_smoke',
      displayName: 'Codex DM Smoke',
      avatarUrl: null,
      isAgent: false,
      status: 'offline',
    };

    await page.route('**/social/api/users/search**', async (route) => {
      await fulfillJson(route, 200, [smokeTeammate]);
    });

    await page.route('**/social/api/dm', async (route) => {
      dmRequestCount += 1;
      if (dmRequestCount <= 2) {
        await fulfillJson(route, 503, { error: 'DM temporarily unavailable' });
        return;
      }
      await fulfillJson(route, 201, { channelId: 'e2e-sidebar-dm' });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const sidebar = page.locator(messagesSidebar);
    await sidebar.getByLabel('Start a new direct message').click();
    const newDmSearch = sidebar.getByTestId('sidebar-new-dm-search');
    await newDmSearch.getByLabel('Find people or agents').fill('codex dm');
    await newDmSearch
      .getByTestId('sidebar-new-dm-result')
      .filter({ hasText: smokeTeammate.displayName })
      .click();
    await expect(page.getByText('DM temporarily unavailable')).toBeVisible();

    await sidebar.getByLabel('Start a new message').click();
    const dialog = page.getByRole('dialog', { name: 'New message quick switcher' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Start a DM or open a conversation').fill('codex dm');
    const quickSwitcherResult = dialog
      .getByTestId('quick-switcher-result')
      .filter({ hasText: smokeTeammate.displayName });
    await quickSwitcherResult.click();
    await expect(dialog.getByTestId('quick-switcher-error')).toContainText(
      'DM temporarily unavailable',
    );

    await quickSwitcherResult.click();
    await expect(page).toHaveURL(/\/social\/dm\/e2e-sidebar-dm\?embed=true/);
    expect(dmRequestCount).toBe(3);
  });

  test('sidebar and quick switcher people search failures retry cleanly', async ({ page }) => {
    let searchRequestCount = 0;
    const smokeTeammate = {
      id: 'e2e-search-retry-target',
      username: 'codex_search_retry',
      displayName: 'Codex Search Retry',
      avatarUrl: null,
      isAgent: false,
      status: 'offline',
    };

    await page.route('**/social/api/users/search**', async (route) => {
      searchRequestCount += 1;
      if (searchRequestCount === 1 || searchRequestCount === 3) {
        await fulfillJson(route, 503, {
          error: 'People search temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, [smokeTeammate]);
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const sidebar = page.locator(messagesSidebar);
    await sidebar.getByLabel('Start a new direct message').click();
    const newDmSearch = sidebar.getByTestId('sidebar-new-dm-search');
    await newDmSearch.getByLabel('Find people or agents').fill('codex retry');
    await expect(newDmSearch.getByTestId('sidebar-new-dm-error')).toContainText(
      'People search temporarily unavailable',
    );

    await newDmSearch.getByLabel('Retry people search').click();
    await expect(
      newDmSearch.getByTestId('sidebar-new-dm-result').filter({
        hasText: smokeTeammate.displayName,
      }),
    ).toBeVisible();
    await sidebar.getByLabel('Close new message search').click();

    await sidebar.getByLabel('Start a new message').click();
    const dialog = page.getByRole('dialog', { name: 'New message quick switcher' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Start a DM or open a conversation').fill('codex retry');
    await expect(dialog.getByTestId('quick-switcher-error')).toContainText(
      'People search temporarily unavailable',
    );

    await dialog.getByLabel('Retry quick switcher people search').click();
    await expect(
      dialog.getByTestId('quick-switcher-result').filter({
        hasText: smokeTeammate.displayName,
      }),
    ).toBeVisible();
    expect(searchRequestCount).toBe(4);
  });

  test('AI agents sidebar entry opens the filtered DM directory', async ({ page }) => {
    await page.goto('/social/channels?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const sidebar = page.locator(messagesSidebar);
    await sidebar.getByLabel('Browse AI agents').click();
    await expect(page).toHaveURL(/\/social\/dm\?filter=agents&embed=true/);
    await expect(page.getByRole('heading', { name: 'AI agents' })).toBeVisible();

    const directoryFilter = page.getByTestId('dm-directory-filter');
    await expect(directoryFilter.getByRole('tab', { name: 'Show AI agents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByLabel('Search agents')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Teammates' })).toHaveCount(0);

    await directoryFilter.getByRole('tab', { name: 'Show all direct message contacts' }).click();
    await expect(page).not.toHaveURL(/filter=agents/);
    await expect(page.getByRole('heading', { name: 'Direct messages' })).toBeVisible();
    await expect(page.getByLabel('Search people and agents')).toBeVisible();
  });

  test('quick switcher browse agents action opens the filtered DM directory', async ({ page }) => {
    await page.goto('/social/channels?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    await page.getByLabel('Open quick switcher').click();
    const dialog = page.getByRole('dialog', { name: 'Quick switcher' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Browse AI agents' }).click();

    await expect(page).toHaveURL(/\/social\/dm\?filter=agents&embed=true/);
    await expect(page.getByRole('heading', { name: 'AI agents' })).toBeVisible();
    await expect(
      page.getByTestId('dm-directory-filter').getByRole('tab', { name: 'Show AI agents' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('quick switcher browse teammates action opens the filtered DM directory', async ({
    page,
  }) => {
    await page.goto('/social/channels?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    await page.getByLabel('Open quick switcher').click();
    const dialog = page.getByRole('dialog', { name: 'Quick switcher' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Browse teammates', exact: true }).click();

    await expect(page).toHaveURL(/\/social\/dm\?filter=teammates&embed=true/);
    await expect(page.getByRole('heading', { name: 'Teammates' }).first()).toBeVisible();
    await expect(
      page.getByTestId('dm-directory-filter').getByRole('tab', { name: 'Show teammates' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Search teammates')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI agents' })).toHaveCount(0);
  });

  test('desktop notification prompt shows permission feedback and dismisses', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('street-voices:browser-notifications:dismissed');

      let permission: NotificationPermission = 'default';
      const notificationStub = function () {};
      Object.defineProperty(notificationStub, 'permission', {
        configurable: true,
        get: () => permission,
      });
      Object.defineProperty(notificationStub, 'requestPermission', {
        configurable: true,
        value: async () => {
          permission = 'denied';
          return permission;
        },
      });
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: notificationStub,
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const prompt = page.getByTestId('browser-notification-prompt');
    await expect(prompt).toBeVisible();
    await prompt.getByLabel('Enable desktop alerts').click();
    await expect(page.getByTestId('browser-notification-prompt-status')).toContainText(
      'Desktop alerts are blocked in this browser.',
    );

    await prompt.getByLabel('Dismiss desktop alerts prompt').click();
    await expect(prompt).toHaveCount(0);
  });

  test('Messages sidebar creates a new channel from the Add channel button', async ({ page }) => {
    let createAttempts = 0;
    await page.route('**/social/api/channels', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.fallback();
        return;
      }

      createAttempts += 1;
      if (createAttempts === 1) {
        await fulfillJson(route, 503, {
          error: 'Channel creation temporarily unavailable',
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const frame = await getMessagesIframe(page);
    const sidebarToggle = frame.getByRole('button', { name: 'Open messages sidebar' });
    if ((await sidebarToggle.count()) === 1 && (await sidebarToggle.isVisible())) {
      await sidebarToggle.click();
    }

    const addChannelButton = frame.getByLabel('Add channel');
    await expect(addChannelButton).toBeVisible();
    await addChannelButton.click();

    const channelName = `codex-smoke-${Date.now()}`;
    let createdChannelId: string | null = null;

    try {
      await expect(frame.getByRole('heading', { name: 'Channel browser' })).toBeVisible();
      await frame.getByLabel('Channel name').fill(channelName);
      await frame.getByRole('button', { name: 'Create Channel' }).click();
      await expect(frame.getByTestId('channel-browser-create-error')).toContainText(
        'Channel creation temporarily unavailable',
      );
      await expect(frame.getByLabel('Channel name')).toHaveValue(channelName);
      await frame.getByRole('button', { name: 'Create Channel' }).click();

      await expect(frame.getByText(`Start #${channelName}`)).toBeVisible();
      await expect.poll(() => frame.url()).toContain('/social/channels/');

      const createdPathMatch = new URL(frame.url()).pathname.match(/\/social\/channels\/([^/?#]+)/);
      createdChannelId = createdPathMatch?.[1] || null;
      expect(createdChannelId).toBeTruthy();
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('channel browser controls retry, filter, join, leave, edit, archive, and restore', async ({
    page,
  }) => {
    const channelsById = new Map<string, SmokeChannelSummary>([
      [
        'managed-active',
        {
          id: 'managed-active',
          name: 'managed-active',
          slug: 'managed-active',
          description: 'Managed active channel',
          type: 'PUBLIC',
          iconEmoji: null,
          isDefault: false,
          isArchived: false,
          isMember: true,
          memberCount: 2,
          messageCount: 3,
          role: 'owner',
          canCreate: true,
          canManage: true,
        },
      ],
      [
        'browse-public',
        {
          id: 'browse-public',
          name: 'browse-public',
          slug: 'browse-public',
          description: 'Public channel to join',
          type: 'PUBLIC',
          iconEmoji: null,
          isDefault: false,
          isArchived: false,
          isMember: false,
          memberCount: 1,
          messageCount: 0,
          role: undefined,
          canCreate: true,
          canManage: false,
        },
      ],
      [
        'archived-channel',
        {
          id: 'archived-channel',
          name: 'archived-channel',
          slug: 'archived-channel',
          description: 'Archived managed channel',
          type: 'PUBLIC',
          iconEmoji: null,
          isDefault: false,
          isArchived: true,
          isMember: true,
          memberCount: 1,
          messageCount: 0,
          role: 'owner',
          canCreate: true,
          canManage: true,
        },
      ],
    ]);
    let channelListRequests = 0;
    let browseJoinAttempts = 0;
    let browseLeaveAttempts = 0;
    let managedUpdateAttempts = 0;
    let managedArchiveAttempts = 0;
    let managedRestoreAttempts = 0;
    let workspacePolicyRequests = 0;

    await page.route('**/social/api/workspace/policies', async (route) => {
      workspacePolicyRequests += 1;
      if (workspacePolicyRequests === 1) {
        await fulfillJson(route, 503, {
          error: 'Workspace defaults temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, {
        defaultChannelVisibility: 'PRIVATE',
        defaultNotificationLevel: 'MENTIONS',
        publicChannelJoinPolicy: 'OPEN',
        privateChannelJoinPolicy: 'INVITE_ONLY',
        channelCreationPolicy: 'MEMBERS',
        canManage: true,
      });
    });

    await page.route('**/social/api/channels**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname !== '/social/api/channels' || request.method() !== 'GET') {
        await route.fallback();
        return;
      }

      channelListRequests += 1;
      if (channelListRequests === 1) {
        await fulfillJson(route, 503, {
          error: 'Channel directory temporarily unavailable',
        });
        return;
      }

      const includeArchived = url.searchParams.get('includeArchived') === 'true';
      const channels = Array.from(channelsById.values()).filter(
        (channel) => includeArchived || !channel.isArchived,
      );
      await fulfillJson(route, 200, channels);
    });

    await page.route('**/social/api/channels/*/membership', async (route) => {
      const request = route.request();
      const match = new URL(request.url()).pathname.match(
        /\/social\/api\/channels\/([^/]+)\/membership$/,
      );
      const channel = match ? channelsById.get(match[1]) : null;
      if (!channel) {
        await route.fallback();
        return;
      }

      if (request.method() === 'POST') {
        if (channel.id === 'browse-public') {
          browseJoinAttempts += 1;
          if (browseJoinAttempts === 1) {
            await fulfillJson(route, 503, {
              error: '#browse-public could not be joined right now',
            });
            return;
          }
        }
        channel.isMember = true;
        channel.role = 'member';
        channel.memberCount += 1;
        await fulfillJson(route, 200, {
          channelId: channel.id,
          isMember: true,
          role: channel.role,
        });
        return;
      }

      if (request.method() === 'DELETE') {
        if (channel.id === 'browse-public') {
          browseLeaveAttempts += 1;
          if (browseLeaveAttempts === 1) {
            await fulfillJson(route, 503, {
              error: '#browse-public could not be left right now',
            });
            return;
          }
        }
        channel.isMember = false;
        channel.role = undefined;
        channel.memberCount = Math.max(channel.memberCount - 1, 0);
        await fulfillJson(route, 200, {
          channelId: channel.id,
          isMember: false,
        });
        return;
      }

      await route.fallback();
    });

    await page.route('**/social/api/channels/*/archive', async (route) => {
      const request = route.request();
      const match = new URL(request.url()).pathname.match(
        /\/social\/api\/channels\/([^/]+)\/archive$/,
      );
      const channel = match ? channelsById.get(match[1]) : null;
      if (!channel || request.method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      const body = JSON.parse(request.postData() || '{}') as { archived?: boolean };
      if (channel.id === 'managed-active' && body.archived === true) {
        managedArchiveAttempts += 1;
        if (managedArchiveAttempts === 1) {
          await fulfillJson(route, 503, {
            error: '#managed-renamed could not be archived right now',
          });
          return;
        }
      }
      if (channel.id === 'managed-active' && body.archived === false) {
        managedRestoreAttempts += 1;
        if (managedRestoreAttempts === 1) {
          await fulfillJson(route, 503, {
            error: '#managed-renamed could not be restored right now',
          });
          return;
        }
      }
      channel.isArchived = body.archived === true;
      await fulfillJson(route, 200, channel);
    });

    await page.route('**/social/api/channels/*', async (route) => {
      const request = route.request();
      const match = new URL(request.url()).pathname.match(/\/social\/api\/channels\/([^/]+)$/);
      const channel = match ? channelsById.get(match[1]) : null;
      if (!channel || request.method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      if (channel.id === 'managed-active') {
        managedUpdateAttempts += 1;
        if (managedUpdateAttempts === 1) {
          await fulfillJson(route, 503, {
            error: '#managed-active could not be updated right now',
          });
          return;
        }
      }

      const body = JSON.parse(request.postData() || '{}') as {
        name?: string;
        description?: string;
        type?: 'PUBLIC' | 'PRIVATE';
      };
      channel.name = body.name || channel.name;
      channel.slug = body.name || channel.slug;
      channel.description = body.description ?? channel.description;
      channel.type = body.type || channel.type;
      await fulfillJson(route, 200, channel);
    });

    await page.goto('/social/channels?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await expect(page.getByTestId('channel-browser-load-error')).toContainText(
      'Channel directory temporarily unavailable',
    );

    await page.getByLabel('Retry channels').click();
    await expect(page.getByTestId('channel-browser-results')).toBeVisible();
    await expect(
      page.getByTestId('channel-browser-row').filter({ hasText: 'managed-active' }),
    ).toBeVisible();
    await expect(page.getByTestId('channel-browser-policy-error')).toContainText(
      'Workspace defaults temporarily unavailable',
    );
    await page.getByLabel('Retry workspace defaults').click();
    await expect(page.getByTestId('channel-browser-policy-summary')).toContainText(
      'Workspace defaults',
    );
    await expect(page.getByTestId('channel-browser-policy-summary')).toContainText('Private');
    await expect(page.getByTestId('channel-browser-policy-summary')).toContainText('Mentions');

    await page.getByLabel('Create a new channel').click();
    await expect(page.getByTestId('channel-browser-create-form')).toBeVisible();
    await expect(page).toHaveURL(/create=true/);
    await expect(page.getByLabel('New channel visibility Private')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByLabel('New channel visibility Public').click();
    await expect(page.getByLabel('New channel visibility Public')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByLabel('Close new channel form').click();
    await expect(page.getByTestId('channel-browser-create-form')).toHaveCount(0);
    await expect(page).not.toHaveURL(/create=true/);

    await page.getByLabel('Create a new channel').click();
    await expect(page.getByLabel('New channel visibility Private')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByLabel('Channel name').fill('draft-channel');
    await page.getByLabel('Description (optional)').fill('draft description');
    await page.getByLabel('Cancel new channel').click();
    await expect(page.getByTestId('channel-browser-create-form')).toHaveCount(0);

    await page.getByLabel('Create a new channel').click();
    await expect(page.getByLabel('Channel name')).toHaveValue('');
    await expect(page.getByLabel('Description (optional)')).toHaveValue('');
    await expect(page.getByLabel('New channel visibility Private')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByLabel('Close new channel form').click();

    await page.getByLabel('Search channels').fill('browse');
    await expect(
      page.getByTestId('channel-browser-row').filter({ hasText: 'browse-public' }),
    ).toBeVisible();
    await expect(
      page.getByTestId('channel-browser-row').filter({ hasText: 'managed-active' }),
    ).toHaveCount(0);

    await page.getByLabel('Clear channel search').click();
    await expect(
      page.getByTestId('channel-browser-row').filter({ hasText: 'managed-active' }),
    ).toBeVisible();

    await page.getByLabel('Show archived channels').click();
    await expect(page.getByLabel('Restore #archived-channel')).toBeVisible();

    await page.getByLabel('Join #browse-public').click();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'browse-public' })
        .getByTestId('channel-browser-row-action-error'),
    ).toContainText('#browse-public could not be joined right now');
    await expect(page.getByLabel('Join #browse-public')).toBeVisible();
    await page.getByLabel('Join #browse-public').click();
    await expect(page.getByLabel('Leave #browse-public')).toBeVisible();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'browse-public' })
        .getByTestId('channel-browser-row-action-error'),
    ).toHaveCount(0);

    await page.getByLabel('Leave #browse-public').click();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'browse-public' })
        .getByTestId('channel-browser-row-action-error'),
    ).toContainText('#browse-public could not be left right now');
    await expect(page.getByLabel('Leave #browse-public')).toBeVisible();
    await page.getByLabel('Leave #browse-public').click();
    await expect(page.getByLabel('Join #browse-public')).toBeVisible();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'browse-public' })
        .getByTestId('channel-browser-row-action-error'),
    ).toHaveCount(0);

    await page.getByLabel('Edit #managed-active').click();
    await expect(page.getByTestId('channel-browser-edit-form')).toBeVisible();
    await page.getByLabel('Channel name').fill('managed-renamed');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByTestId('channel-browser-edit-error')).toContainText(
      '#managed-active could not be updated right now',
    );
    await expect(page.getByLabel('Channel name')).toHaveValue('managed-renamed');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      page.getByTestId('channel-browser-row').filter({ hasText: 'managed-renamed' }),
    ).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Archive #managed-renamed').click();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'managed-renamed' })
        .getByTestId('channel-browser-row-action-error'),
    ).toContainText('#managed-renamed could not be archived right now');
    await expect(page.getByLabel('Archive #managed-renamed')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Archive #managed-renamed').click();
    await expect(page.getByLabel('Restore #managed-renamed')).toBeVisible();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'managed-renamed' })
        .getByTestId('channel-browser-row-action-error'),
    ).toHaveCount(0);

    await page.getByLabel('Restore #managed-renamed').click();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'managed-renamed' })
        .getByTestId('channel-browser-row-action-error'),
    ).toContainText('#managed-renamed could not be restored right now');
    await expect(page.getByLabel('Restore #managed-renamed')).toBeVisible();
    await page.getByLabel('Restore #managed-renamed').click();
    await expect(page.getByLabel('Archive #managed-renamed')).toBeVisible();
    await expect(
      page
        .getByTestId('channel-browser-row')
        .filter({ hasText: 'managed-renamed' })
        .getByTestId('channel-browser-row-action-error'),
    ).toHaveCount(0);
  });

  test('conversation header buttons open their secondary panels', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const frame = await getMessagesIframe(page);
    await openFirstConversation(frame);

    await frame.getByLabel('Search messages').click();
    await expect(frame.getByRole('dialog', { name: 'Search messages' })).toBeVisible();
    await frame.getByLabel('Close search').click();

    await frame.getByLabel('Pinned messages').click();
    await expect(frame.getByText('Pinned Messages', { exact: true })).toBeVisible();
    await frame.getByLabel('Close pinned messages').click();

    await frame.getByLabel('Files').click();
    await expect(frame.getByText('Files', { exact: true })).toBeVisible();
    await frame.getByLabel('Close files').click();

    await frame.getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(
      frame.getByTestId('notification-preferences-panel').getByText('Notifications'),
    ).toBeVisible();
    await frame.getByLabel('Close notification preferences').click();

    const detailsLabel = frame.url().includes('/social/dm/') ? 'DM details' : 'Channel details';
    await frame.getByLabel(detailsLabel).click();
    await expect(frame.getByTestId('conversation-details-panel')).toBeVisible();
    await frame.getByTestId('conversation-details-pins').click();
    await expect(frame.getByText('Pinned Messages', { exact: true })).toBeVisible();
  });

  test('removed messages panel surfaces load errors and audit rows with retry', async ({
    page,
  }) => {
    const channelName = `codex-removed-${Date.now()}`;
    const messageContent = `Codex removed message audit ${Date.now()}`;
    const removalReason = 'Smoke test removal audit';
    let createdChannelId: string | null = null;
    let createdMessageId: string | null = null;
    let loadErrorServed = false;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Removed messages smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const messageResponse = await page.request.post(
      `/social/api/channels/${createdChannelId}/messages`,
      {
        data: { content: messageContent },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
    const createdMessage = (await messageResponse.json()) as { id?: string };
    createdMessageId = createdMessage.id || null;
    expect(createdMessageId).toBeTruthy();

    const deleteResponse = await page.request.delete(
      `/social/api/channels/${createdChannelId}/messages/${createdMessageId}`,
      {
        data: { reason: removalReason },
      },
    );
    expect(deleteResponse.ok()).toBeTruthy();

    await page.route(
      `**/social/api/channels/${createdChannelId}/messages/deleted**`,
      async (route) => {
        if (route.request().method() === 'GET' && !loadErrorServed) {
          loadErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Removed audit temporarily unavailable',
          });
          return;
        }

        await route.fallback();
      },
    );

    try {
      await page.goto(`/social/channels/${createdChannelId}?embed=true`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.getByTestId('message-composer')).toBeVisible();

      await page.getByLabel('Removed messages').click();
      await expect(page.getByRole('dialog', { name: 'Removed messages' })).toBeVisible();
      await expect(page.getByTestId('removed-messages-load-error')).toContainText(
        'Removed audit temporarily unavailable',
      );

      await page.getByLabel('Retry removed messages').click();
      const removedRow = page.getByTestId('removed-message-row').filter({
        hasText: messageContent,
      });
      await expect(removedRow).toBeVisible();
      await expect(removedRow).toContainText(removalReason);
      await page.getByLabel('Close removed messages').click();
      await expect(page.getByTestId('removed-messages-panel')).toHaveCount(0);
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('notification preferences recover from load and save errors', async ({ page }) => {
    const channelName = `codex-notifications-${Date.now()}`;
    let createdChannelId: string | null = null;
    let loadErrorServed = false;
    let saveErrorServed = false;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Notification preference smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    await page.route('**/social/api/channels/*/notifications', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        !createdChannelId ||
        url.pathname !== `/social/api/channels/${createdChannelId}/notifications`
      ) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET') {
        if (!loadErrorServed) {
          loadErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Notification preferences temporarily unavailable',
          });
          return;
        }

        await fulfillJson(
          route,
          200,
          notificationPreferencePayload(createdChannelId, 'MENTIONS', channelName),
        );
        return;
      }

      if (request.method() === 'PATCH') {
        const body = JSON.parse(request.postData() || '{}') as {
          level?: SmokeNotificationLevel;
        };
        if (!saveErrorServed) {
          saveErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Notification save temporarily unavailable',
          });
          return;
        }

        await fulfillJson(
          route,
          200,
          notificationPreferencePayload(createdChannelId, body.level || 'MUTED', channelName),
        );
        return;
      }

      await route.fallback();
    });

    try {
      await page.goto(`/social/channels/${createdChannelId}?embed=true`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.getByTestId('message-composer')).toBeVisible();

      await page.getByRole('button', { name: 'Notifications', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Notification preferences' })).toBeVisible();
      await expect(page.getByTestId('notification-preferences-load-error')).toContainText(
        'Notification preferences temporarily unavailable',
      );

      await page.getByLabel('Retry notification preferences').click();
      await expect(page.getByTestId('notification-preference-mentions')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await page.getByTestId('notification-preference-muted').click();
      await expect(page.getByTestId('notification-preferences-save-error')).toContainText(
        'Notification save temporarily unavailable',
      );

      await page.getByTestId('notification-preference-muted').click();
      await expect(page.getByTestId('notification-preference-muted')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByTestId('notification-preferences-save-error')).toHaveCount(0);
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('activity notification shortcut updates the row label after saving', async ({ page }) => {
    const channelName = `codex-activity-notifications-${Date.now()}`;
    const messageContent = `Codex activity notification smoke ${Date.now()}`;
    let createdChannelId: string | null = null;
    let createdMessageId: string | null = null;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Activity notification shortcut smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const messageResponse = await page.request.post(
      `/social/api/channels/${createdChannelId}/messages`,
      {
        data: { content: messageContent },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
    const createdMessage = (await messageResponse.json()) as { id?: string };
    createdMessageId = createdMessage.id || null;
    expect(createdMessageId).toBeTruthy();

    const saveResponse = await page.request.post('/social/api/saved', {
      data: { messageId: createdMessageId },
    });
    expect(saveResponse.ok()).toBeTruthy();

    await page.route('**/social/api/channels/*/notifications', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        !createdChannelId ||
        url.pathname !== `/social/api/channels/${createdChannelId}/notifications`
      ) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET') {
        await fulfillJson(
          route,
          200,
          notificationPreferencePayload(createdChannelId, 'ALL', channelName),
        );
        return;
      }

      if (request.method() === 'PATCH') {
        const body = JSON.parse(request.postData() || '{}') as {
          level?: SmokeNotificationLevel;
        };
        await fulfillJson(
          route,
          200,
          notificationPreferencePayload(createdChannelId, body.level || 'MUTED', channelName),
        );
        return;
      }

      await route.fallback();
    });

    try {
      await page.goto('/social/activity?embed=true', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(authRedirectPattern);

      const activityCard = page.getByTestId('activity-card').filter({
        hasText: messageContent,
      });
      await expect(activityCard).toHaveCount(1);

      await activityCard.getByTestId('activity-notification-shortcut').click();
      await expect(page.getByRole('dialog', { name: 'Notification preferences' })).toBeVisible();
      await page.getByTestId('notification-preference-muted').click();
      await expect(activityCard.getByTestId('activity-notification-shortcut')).toContainText(
        'Muted',
      );
    } finally {
      if (createdMessageId) {
        await page.request.delete(`/social/api/saved?messageId=${createdMessageId}`);
      }
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('activity filters update selected state and visible results', async ({ page }) => {
    const channelName = `codex-activity-filters-${Date.now()}`;
    const messageContent = `Codex activity filter smoke ${Date.now()}`;
    let createdChannelId: string | null = null;
    let createdMessageId: string | null = null;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Activity filter smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const messageResponse = await page.request.post(
      `/social/api/channels/${createdChannelId}/messages`,
      {
        data: { content: messageContent },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
    const createdMessage = (await messageResponse.json()) as { id?: string };
    createdMessageId = createdMessage.id || null;
    expect(createdMessageId).toBeTruthy();

    const saveResponse = await page.request.post('/social/api/saved', {
      data: { messageId: createdMessageId },
    });
    expect(saveResponse.ok()).toBeTruthy();

    try {
      await page.goto('/social/activity?embed=true', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(authRedirectPattern);

      await expect(page.getByTestId('activity-filter-all')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByTestId('activity-results')).toContainText(messageContent);

      await page.getByTestId('activity-filter-saved').click();
      await expect(page.getByTestId('activity-filter-saved')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByTestId('activity-results')).toContainText(messageContent);
      await expect(page.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        'activity-filter-tab-saved',
      );
      await expect(page.getByTestId('activity-filter-saved')).toHaveAccessibleName(
        /Later activity, \d+ items?/,
      );

      await page.getByTestId('activity-filter-mentions').click();
      await expect(page.getByTestId('activity-filter-mentions')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByText(messageContent)).toHaveCount(0);
    } finally {
      if (createdMessageId) {
        await page.request.delete(`/social/api/saved?messageId=${createdMessageId}`);
      }
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('saved items preserve embedded jump links and recover from remove errors', async ({
    page,
  }) => {
    const channelName = `codex-saved-items-${Date.now()}`;
    const messageContent = `Codex saved items smoke ${Date.now()}`;
    let createdChannelId: string | null = null;
    let createdMessageId: string | null = null;
    let removeErrorServed = false;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Saved items smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const messageResponse = await page.request.post(
      `/social/api/channels/${createdChannelId}/messages`,
      {
        data: { content: messageContent },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
    const createdMessage = (await messageResponse.json()) as { id?: string };
    createdMessageId = createdMessage.id || null;
    expect(createdMessageId).toBeTruthy();

    const saveResponse = await page.request.post('/social/api/saved', {
      data: { messageId: createdMessageId },
    });
    expect(saveResponse.ok()).toBeTruthy();

    await page.route('**/social/api/saved**', async (route) => {
      const request = route.request();
      if (request.method() !== 'DELETE') {
        await route.fallback();
        return;
      }

      const url = new URL(request.url());
      const body = request.postData()
        ? (JSON.parse(request.postData() || '{}') as { messageId?: string })
        : {};
      const messageId = url.searchParams.get('messageId') || body.messageId;
      if (!createdMessageId || messageId !== createdMessageId) {
        await route.fallback();
        return;
      }

      if (!removeErrorServed) {
        removeErrorServed = true;
        await fulfillJson(route, 503, {
          error: 'Saved item removal temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, { saved: false });
    });

    try {
      await page.goto('/social/saved?embed=true', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(authRedirectPattern);

      const savedCard = page.getByTestId('saved-item-card').filter({
        hasText: messageContent,
      });
      await expect(savedCard).toHaveCount(1);
      await expect(savedCard.getByTestId('saved-item-channel-link')).toHaveAttribute(
        'href',
        /embed=true/,
      );
      await expect(savedCard.getByTestId('jump-to-message-link')).toHaveAttribute(
        'href',
        /embed=true/,
      );

      await savedCard.getByLabel(`Remove saved message from #${channelName}`).click();
      await expect(savedCard.getByTestId('saved-item-action-error')).toContainText(
        'Saved item removal temporarily unavailable',
      );

      await savedCard.getByLabel(`Dismiss saved item error for #${channelName}`).click();
      await expect(savedCard.getByTestId('saved-item-action-error')).toHaveCount(0);

      await savedCard.getByLabel(`Remove saved message from #${channelName}`).click();
      await expect(savedCard).toHaveCount(0);
    } finally {
      if (createdMessageId) {
        await page.request.delete(`/social/api/saved?messageId=${createdMessageId}`);
      }
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('search panel surfaces filter and result errors with retry controls', async ({ page }) => {
    let filterErrorServed = false;
    let searchErrorServed = false;
    const filters = {
      channels: [{ id: 'e2e-search-channel', label: 'E2E Search Channel' }],
      authors: [{ id: 'e2e-search-author', label: 'Alex Rivera', username: 'alex_rivera' }],
    };

    await page.route('**/social/api/search**', async (route) => {
      const url = new URL(route.request().url());
      const hasCriteria = ['q', 'channelId', 'authorId', 'date', 'attachment'].some((key) =>
        url.searchParams.has(key),
      );

      if (!hasCriteria) {
        if (!filterErrorServed) {
          filterErrorServed = true;
          await fulfillJson(route, 503, { error: 'Search filters temporarily unavailable' });
          return;
        }

        await fulfillJson(route, 200, { filters, results: [] });
        return;
      }

      if (url.searchParams.get('q') === 'no-match-codex') {
        await fulfillJson(route, 200, { filters, results: [] });
        return;
      }

      if (!searchErrorServed) {
        searchErrorServed = true;
        await fulfillJson(route, 503, { error: 'Search results temporarily unavailable' });
        return;
      }

      await fulfillJson(route, 200, {
        filters,
        results: [
          {
            id: 'e2e-search-message',
            channelId: 'e2e-search-channel',
            content: 'Codex search retry result',
            createdAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
            author: {
              id: 'e2e-search-author',
              displayName: 'Alex Rivera',
              isAgent: false,
            },
            channel: {
              id: 'e2e-search-channel',
              name: 'search',
              slug: 'search',
              type: 'PUBLIC',
            },
            attachments: [
              {
                id: 'e2e-search-attachment',
                fileName: 'search-brief.pdf',
                mimeType: 'application/pdf',
                url: 'https://example.test/search-brief.pdf',
              },
            ],
          },
        ],
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.getByLabel('Search messages').click();
    await expect(page.getByRole('dialog', { name: 'Search messages' })).toBeVisible();
    await expect(page.getByTestId('message-search-filter-error')).toContainText(
      'Search filters temporarily unavailable',
    );

    await page.getByLabel('Retry search filters').click();
    await expect(page.getByRole('option', { name: 'E2E Search Channel' })).toBeAttached();

    await page.getByLabel('Search message text').fill('codex');
    await expect(page.getByTestId('message-search-error')).toContainText(
      'Search results temporarily unavailable',
    );

    await page.getByLabel('Retry message search').click();
    await expect(page.getByLabel('Open search result from Alex Rivera')).toBeVisible();
    await expect(page.getByText('Codex search retry result')).toBeVisible();
    await expect(page.getByText('search-brief.pdf')).toBeVisible();

    await page.getByLabel('Search message text').fill('no-match-codex');
    await expect(page.getByTestId('message-search-empty')).toContainText('No results found');

    await page.getByLabel('Clear message search from empty state').click();
    await expect(page.getByLabel('Search message text')).toHaveValue('');
    await expect(
      page.getByText('Type at least two characters or choose a filter to search.'),
    ).toBeVisible();
  });

  test('pinned messages panel surfaces load and unpin errors with retry controls', async ({
    page,
  }) => {
    let loadErrorServed = false;
    let unpinErrorServed = false;

    await page.route('**/social/api/channels/*/pins', async (route) => {
      const request = route.request();

      if (request.method() === 'GET') {
        if (!loadErrorServed) {
          loadErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Pinned messages temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 200, {
          pins: [
            {
              id: 'e2e-pinned-message',
              channelId: 'e2e-channel',
              content: 'Codex pinned retry result',
              createdAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
              author: {
                id: 'e2e-alex-rivera',
                displayName: 'Alex Rivera',
                isAgent: false,
              },
            },
          ],
        });
        return;
      }

      if (request.method() === 'POST') {
        if (!unpinErrorServed) {
          unpinErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Pinned message could not be toggled',
          });
          return;
        }

        await fulfillJson(route, 200, { isPinned: false });
        return;
      }

      await route.fallback();
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.getByLabel('Pinned messages').click();
    await expect(page.getByRole('dialog', { name: 'Pinned messages' })).toBeVisible();
    await expect(page.getByTestId('pinned-messages-load-error')).toContainText(
      'Pinned messages temporarily unavailable',
    );

    await page.getByLabel('Retry pinned messages').click();
    const pinnedRow = page.getByTestId('pinned-message-row').filter({
      hasText: 'Codex pinned retry result',
    });
    await expect(pinnedRow).toBeVisible();

    await pinnedRow.getByLabel('Unpin pinned message from Alex Rivera').click();
    await expect(pinnedRow.getByTestId('pinned-message-action-error')).toContainText(
      'Pinned message could not be toggled',
    );

    await pinnedRow.getByLabel('Unpin pinned message from Alex Rivera').click();
    await expect(page.getByText('No pinned messages')).toBeVisible();
  });

  test('files panel surfaces load errors and keeps filters/context links actionable', async ({
    page,
  }) => {
    let loadErrorServed = false;

    await page.route('**/social/api/channels/*/files', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      if (!loadErrorServed) {
        loadErrorServed = true;
        await fulfillJson(route, 503, {
          error: 'Files temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, {
        files: [
          {
            id: 'e2e-file-image',
            fileName: 'codex-image.png',
            fileSize: 2048,
            mimeType: 'image/png',
            url: 'https://example.test/codex-image.png',
            width: 320,
            height: 180,
            messageId: 'e2e-file-message-image',
            channelId: 'e2e-channel',
            createdAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
            messageContent: 'Codex image attachment',
            href: '/dm/e2e-channel?message=e2e-file-message-image',
            author: {
              id: 'e2e-alex-rivera',
              username: 'alex_rivera',
              displayName: 'Alex Rivera',
              avatarUrl: null,
              isAgent: false,
            },
          },
          {
            id: 'e2e-file-document',
            fileName: 'codex-brief.pdf',
            fileSize: 4096,
            mimeType: 'application/pdf',
            url: 'https://example.test/codex-brief.pdf',
            width: null,
            height: null,
            messageId: 'e2e-file-message-pdf',
            channelId: 'e2e-channel',
            createdAt: new Date('2026-01-01T12:05:00.000Z').toISOString(),
            messageContent: 'Codex document attachment',
            href: '/dm/e2e-channel?message=e2e-file-message-pdf',
            author: {
              id: 'e2e-alex-rivera',
              username: 'alex_rivera',
              displayName: 'Alex Rivera',
              avatarUrl: null,
              isAgent: false,
            },
          },
        ],
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.getByLabel('Files').click();
    await expect(page.getByRole('dialog', { name: 'Files' })).toBeVisible();
    await expect(page.getByTestId('files-panel-load-error')).toContainText(
      'Files temporarily unavailable',
    );

    await page.getByLabel('Retry files').click();
    const imageRow = page.getByTestId('files-panel-row').filter({
      hasText: 'codex-image.png',
    });
    const pdfRow = page.getByTestId('files-panel-row').filter({
      hasText: 'codex-brief.pdf',
    });
    await expect(imageRow).toBeVisible();
    await expect(pdfRow).toBeVisible();

    await page.getByLabel('Show Images files').click();
    await expect(imageRow).toBeVisible();
    await expect(pdfRow).toHaveCount(0);

    await page.getByLabel('Show Docs files').click();
    await expect(pdfRow).toBeVisible();
    await expect(imageRow).toHaveCount(0);
    await expect(page.getByLabel('Open codex-brief.pdf').first()).toBeVisible();
    await expect(page.getByLabel('Open message context for codex-brief.pdf')).toHaveAttribute(
      'href',
      /embed=true/,
    );

    await page.getByLabel('Show Video files').click();
    await expect(page.getByTestId('files-panel-empty')).toContainText('No video files');
    await page.getByLabel('Show all files from empty state').click();
    await expect(imageRow).toBeVisible();
    await expect(pdfRow).toBeVisible();
  });

  test('members panel recovers from load, search, add, role, and remove failures', async ({
    page,
  }) => {
    const channelName = `codex-members-${Date.now()}`;
    let createdChannelId: string | null = null;
    let loadErrorServed = false;
    let searchErrorServed = false;
    let addErrorServed = false;
    let roleErrorServed = false;
    let removeErrorServed = false;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Members panel smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    const ownerMember = {
      channelId: createdChannelId,
      userId: 'e2e-owner',
      role: 'owner',
      joinedAt: new Date('2025-01-01T12:00:00.000Z').toISOString(),
      user: {
        id: 'e2e-owner',
        username: 'owner',
        displayName: 'Owner User',
        avatarUrl: null,
        isAgent: false,
        status: 'online',
      },
    };
    const rileyMember = {
      channelId: createdChannelId,
      userId: 'e2e-riley',
      role: 'member',
      joinedAt: new Date('2025-01-02T12:00:00.000Z').toISOString(),
      user: {
        id: 'e2e-riley',
        username: 'riley',
        displayName: 'Riley Member',
        avatarUrl: null,
        isAgent: false,
        status: 'offline',
      },
    };
    const priyaUser = {
      id: 'e2e-priya',
      username: 'priya',
      displayName: 'Priya Sharma',
      avatarUrl: null,
      isAgent: false,
      status: 'offline',
    };
    const priyaMember = {
      channelId: createdChannelId,
      userId: priyaUser.id,
      role: 'member',
      joinedAt: new Date('2025-01-03T12:00:00.000Z').toISOString(),
      user: priyaUser,
    };

    await page.route('**/social/api/channels/*/members', async (route) => {
      const request = route.request();

      if (request.method() === 'GET') {
        if (!loadErrorServed) {
          loadErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Members temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 200, {
          channelId: createdChannelId,
          canManage: true,
          members: [ownerMember, rileyMember],
        });
        return;
      }

      if (request.method() === 'POST') {
        if (!addErrorServed) {
          addErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Member invite temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 201, priyaMember);
        return;
      }

      await route.fallback();
    });

    await page.route('**/social/api/users/search**', async (route) => {
      if (!searchErrorServed) {
        searchErrorServed = true;
        await fulfillJson(route, 503, {
          error: 'User search temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, [priyaUser]);
    });

    await page.route('**/social/api/channels/*/members/*', async (route) => {
      const request = route.request();

      if (request.method() === 'PATCH') {
        if (!roleErrorServed) {
          roleErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Role update temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 200, { ...rileyMember, role: 'admin' });
        return;
      }

      if (request.method() === 'DELETE') {
        if (!removeErrorServed) {
          removeErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Member removal temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 200, {
          channelId: createdChannelId,
          userId: 'e2e-riley',
          removed: true,
        });
        return;
      }

      await route.fallback();
    });

    try {
      await page.goto(`/social/channels/${createdChannelId}?embed=true`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.getByTestId('message-composer')).toBeVisible();

      await page.getByRole('button', { name: /Members,/ }).click();
      await expect(page.getByRole('dialog', { name: 'Members' })).toBeVisible();
      await expect(page.getByTestId('channel-members-load-error')).toContainText(
        'Members temporarily unavailable',
      );

      await page.getByLabel('Retry members').click();
      await expect(
        page.getByTestId('channel-member-row').filter({ hasText: 'Riley Member' }),
      ).toBeVisible();

      await page.getByLabel('Search people or agents to add').fill('priya');
      await expect(page.getByTestId('channel-member-search-error')).toContainText(
        'User search temporarily unavailable',
      );

      await page.getByLabel('Retry teammate search').click();
      const priyaResult = page.getByTestId('channel-member-search-result').filter({
        hasText: 'Priya Sharma',
      });
      await expect(priyaResult).toBeVisible();

      await priyaResult.getByLabel('Add Priya Sharma').click();
      await expect(page.getByTestId('channel-member-add-error')).toContainText(
        'Member invite temporarily unavailable',
      );

      await priyaResult.getByLabel('Add Priya Sharma').click();
      await expect(
        page.getByTestId('channel-member-row').filter({ hasText: 'Priya Sharma' }),
      ).toBeVisible();

      const rileyRow = page.getByTestId('channel-member-row').filter({
        hasText: 'Riley Member',
      });
      await rileyRow.getByLabel('Role for Riley Member').selectOption('admin');
      await expect(rileyRow.getByTestId('channel-member-action-error')).toContainText(
        'Role update temporarily unavailable',
      );
      await rileyRow.getByLabel('Dismiss member action error for Riley Member').click();

      await rileyRow.getByLabel('Role for Riley Member').selectOption('admin');
      await expect(rileyRow).toContainText('Admin');

      await rileyRow.getByLabel('Remove Riley Member').click();
      await expect(rileyRow.getByTestId('channel-member-action-error')).toContainText(
        'Member removal temporarily unavailable',
      );

      await rileyRow.getByLabel('Remove Riley Member').click();
      await expect(rileyRow).toHaveCount(0);
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('details panel recovers summary and topic errors while shortcuts stay actionable', async ({
    page,
  }) => {
    const channelName = `codex-details-${Date.now()}`;
    let createdChannelId: string | null = null;
    let summaryErrorServed = false;
    let topicErrorServed = false;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'Initial details topic',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    await page.route('**/social/api/channels/*/pins', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      if (!summaryErrorServed) {
        summaryErrorServed = true;
        await fulfillJson(route, 503, {
          error: 'Details summary temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, {
        pins: [
          {
            id: 'e2e-details-pin',
            channelId: createdChannelId,
            content: 'Codex details pinned message',
            createdAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
            author: {
              id: 'e2e-owner',
              displayName: 'Owner User',
              isAgent: false,
            },
          },
        ],
      });
    });

    await page.route('**/social/api/channels/*/files', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      await fulfillJson(route, 200, {
        files: [
          {
            id: 'e2e-details-file',
            fileName: 'codex-details.png',
            fileSize: 1024,
            mimeType: 'image/png',
            url: 'https://example.test/codex-details.png',
            width: 320,
            height: 180,
            messageId: 'e2e-details-message',
            channelId: createdChannelId,
            createdAt: new Date('2026-01-01T12:05:00.000Z').toISOString(),
            messageContent: 'Codex details file',
            href: `/channels/${createdChannelId}?message=e2e-details-message`,
            author: {
              id: 'e2e-owner',
              username: 'owner',
              displayName: 'Owner User',
              avatarUrl: null,
              isAgent: false,
            },
          },
        ],
      });
    });

    await page.route('**/social/api/channels/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (
        request.method() === 'PATCH' &&
        createdChannelId &&
        url.pathname === `/social/api/channels/${createdChannelId}`
      ) {
        if (!topicErrorServed) {
          topicErrorServed = true;
          await fulfillJson(route, 503, {
            error: 'Topic temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 200, {
          id: createdChannelId,
          name: channelName,
          slug: channelName,
          description: 'Updated details topic',
          type: 'PUBLIC',
          iconEmoji: null,
          isDefault: false,
          isArchived: false,
          isMember: true,
          memberCount: 1,
          messageCount: 0,
          role: 'owner',
          canCreate: true,
          canManage: true,
        });
        return;
      }

      await route.fallback();
    });

    try {
      await page.goto(`/social/channels/${createdChannelId}?embed=true`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.getByTestId('message-composer')).toBeVisible();

      await page.getByRole('button', { name: 'Channel details', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Conversation details' })).toBeVisible();
      await expect(page.getByTestId('conversation-details-summary-error')).toContainText(
        'Details summary temporarily unavailable',
      );

      await page.getByLabel('Retry details summary').click();
      await expect(page.getByTestId('conversation-details-pins-count')).toContainText('1 pin');
      await expect(page.getByTestId('conversation-details-files-count')).toContainText('1 file');
      await expect(page.getByLabel('Open codex-details.png')).toBeVisible();

      await page.getByLabel('Edit channel topic').click();
      await page.getByLabel('Channel topic', { exact: true }).fill('Updated details topic');
      await page.getByLabel('Save channel topic').click();
      await expect(page.getByTestId('conversation-details-topic-error')).toContainText(
        'Topic temporarily unavailable',
      );

      await page.getByLabel('Save channel topic').click();
      await expect(page.getByText('Updated details topic')).toBeVisible();

      await page.getByTestId('conversation-details-members').click();
      await expect(page.getByTestId('channel-members-panel')).toBeVisible();
      await page.getByLabel('Close members').click();

      await page.getByRole('button', { name: 'Channel details', exact: true }).click();
      await page.getByTestId('conversation-details-pins').click();
      await expect(page.getByRole('dialog', { name: 'Pinned messages' })).toBeVisible();
      await page.getByLabel('Close pinned messages').click();

      await page.getByRole('button', { name: 'Channel details', exact: true }).click();
      await page.getByTestId('conversation-details-files').click();
      await expect(page.getByRole('dialog', { name: 'Files' })).toBeVisible();
      await page.getByLabel('Close files').click();

      await page.getByRole('button', { name: 'Channel details', exact: true }).click();
      await page.getByTestId('conversation-details-notifications').click();
      await expect(page.getByTestId('notification-preferences-panel')).toBeVisible();
      await page.getByLabel('Close notification preferences').click();
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('composer toolbar inserts mentions, emoji, slash commands, and uploaded files', async ({
    page,
  }, testInfo) => {
    const captured = await installConversationApiMocks(page);
    const uploadPath = testInfo.outputPath('codex-upload.txt');
    fs.writeFileSync(uploadPath, 'Codex upload fixture\n');

    await page.route('**/social/api/users/search**', async (route) => {
      await fulfillJson(route, 200, [
        {
          id: 'e2e-alex-rivera',
          username: 'alex_rivera',
          displayName: 'Alex Rivera',
          avatarUrl: null,
          isAgent: false,
          status: 'offline',
        },
      ]);
    });

    await page.route('**/social/api/upload', async (route) => {
      await fulfillJson(route, 200, {
        s3Key: 'uploads/e2e/codex-upload.txt',
        url: 'https://example.test/codex-upload.txt',
        fileName: 'codex-upload.txt',
        fileSize: 22,
        mimeType: 'text/plain',
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const composer = page.getByTestId('message-composer');

    await page.getByLabel('Add emoji').click();
    await expect(page.getByRole('group', { name: 'Emoji picker' })).toBeVisible();
    await page.getByLabel('Insert Thumbs up emoji').click();
    await expect(composer).toHaveValue('👍');

    await composer.fill('');
    await page.getByLabel('Mention someone').click();
    await expect(page.getByRole('dialog', { name: 'Mention someone' })).toBeVisible();
    await page.getByPlaceholder('Search people or agents').fill('alex');
    await page.getByLabel('Mention Alex Rivera').click();
    await expect(composer).toHaveValue('@alex_rivera ');

    await composer.fill('/to');
    await page.getByText('/todo').click();
    await expect(composer).toHaveValue('- [ ] ');

    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await expect
      .poll(() => captured.messages.some((message) => message.content === '📎 codex-upload.txt'))
      .toBeTruthy();
  });

  test('composer stores uploaded files and voice messages as retrievable attachments', async ({
    page,
  }, testInfo) => {
    await installVoiceRecordingMocks(page, {
      mimeType: 'audio/wav',
      voiceBase64: tinyVoiceBase64,
    });

    await page.route('**/social/api/voice/transcribe', async (route) => {
      await fulfillJson(route, 200, { transcription: 'Codex live voice upload transcript' });
    });

    const stamp = Date.now();
    const fileName = `codex-live-upload-${stamp}.txt`;
    const fileContents = `Codex live upload fixture ${stamp}\n`;
    const uploadPath = testInfo.outputPath(fileName);
    fs.writeFileSync(uploadPath, fileContents);

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);
    const channelId = channelIdFromUrl(page.url());

    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    const uploadedRow = page.getByTestId('message-row').filter({ hasText: fileName });
    await expect(uploadedRow).toBeVisible();

    const attachmentLink = page.getByLabel(`Open attachment ${fileName}`);
    await expect(attachmentLink).toHaveAttribute('href', /\/social\/api\/files\/uploads\//);
    const attachmentHref = await attachmentLink.getAttribute('href');
    expect(attachmentHref).toBeTruthy();
    const attachmentResponse = await page.request.get(attachmentHref!);
    expect(attachmentResponse.ok()).toBeTruthy();
    expect(await attachmentResponse.text()).toBe(fileContents);

    await page.getByLabel('Record voice message').click();
    const recorder = page.getByTestId('voice-recorder');
    await recorder.getByLabel('Stop recording').click();
    await expect(recorder.getByText('Voice message ready')).toBeVisible();
    await recorder.getByLabel('Send voice message').click();
    await expect(page.getByTestId('voice-recorder')).toHaveCount(0);

    const voicePlayer = page.getByTestId('voice-player').last();
    await expect(voicePlayer).toBeVisible();
    await expect(voicePlayer.getByLabel('Play voice message')).toBeVisible();

    const messagesResponse = await page.request.get(
      `/social/api/channels/${channelId}/messages?limit=10`,
    );
    expect(messagesResponse.ok()).toBeTruthy();
    const messagesPayload = (await messagesResponse.json()) as {
      messages?: Array<{
        content?: string;
        attachments?: Array<{ fileName?: string; mimeType?: string; url?: string }>;
      }>;
    };
    const voiceMessage = (messagesPayload.messages || [])
      .filter((message) => message.content === '🎙️ Voice message')
      .at(-1);
    const voiceAttachment = voiceMessage?.attachments?.[0];
    expect(voiceAttachment).toEqual(
      expect.objectContaining({
        fileName: 'voice-message.wav',
        mimeType: 'audio/wav',
        url: expect.stringMatching(/\/social\/api\/files\/uploads\//),
      }),
    );

    const voiceResponse = await page.request.get(voiceAttachment!.url!);
    expect(voiceResponse.ok()).toBeTruthy();
    expect(voiceResponse.headers()['content-type']).toContain('audio/wav');

    const rangedVoiceResponse = await page.request.get(voiceAttachment!.url!, {
      headers: { Range: 'bytes=0-15' },
    });
    expect(rangedVoiceResponse.status()).toBe(206);
    expect(rangedVoiceResponse.headers()['content-range']).toMatch(/^bytes 0-15\//);
  });

  test('composer mention search surfaces errors and retries cleanly', async ({ page }) => {
    await installConversationApiMocks(page);
    let searchErrorServed = false;

    await page.route('**/social/api/users/search**', async (route) => {
      if (!searchErrorServed) {
        searchErrorServed = true;
        await fulfillJson(route, 503, { error: 'Mention search temporarily unavailable' });
        return;
      }

      await fulfillJson(route, 200, [
        {
          id: 'e2e-alex-rivera',
          username: 'alex_rivera',
          displayName: 'Alex Rivera',
          avatarUrl: null,
          isAgent: false,
          status: 'offline',
        },
      ]);
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const composer = page.getByTestId('message-composer');
    await composer.fill('Hello ');
    await page.getByLabel('Mention someone').click();
    await expect(page.getByRole('dialog', { name: 'Mention someone' })).toBeVisible();
    await page.getByPlaceholder('Search people or agents').fill('alex');

    await expect(page.getByTestId('mention-search-error')).toContainText(
      'Mention search temporarily unavailable',
    );
    await page.getByLabel('Retry mention search').click();
    await page.getByLabel('Mention Alex Rivera').click();

    await expect(composer).toHaveValue('Hello @alex_rivera ');
    await expect(page.getByTestId('mention-search-error')).toHaveCount(0);
  });

  test('composer file upload failures keep retry controls actionable', async ({
    page,
  }, testInfo) => {
    const captured = await installConversationApiMocks(page);
    const uploadPath = testInfo.outputPath('codex-upload-retry.txt');
    fs.writeFileSync(uploadPath, 'Codex retry upload fixture\n');
    let uploadErrorServed = false;

    await page.route('**/social/api/upload', async (route) => {
      if (!uploadErrorServed) {
        uploadErrorServed = true;
        await fulfillJson(route, 503, { error: 'Upload temporarily unavailable' });
        return;
      }

      await fulfillJson(route, 200, {
        s3Key: 'uploads/e2e/codex-upload-retry.txt',
        url: 'https://example.test/codex-upload-retry.txt',
        fileName: 'codex-upload-retry.txt',
        fileSize: 28,
        mimeType: 'text/plain',
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await expect(page.getByTestId('file-upload-error')).toContainText('codex-upload-retry.txt');
    await expect(page.getByTestId('file-upload-error')).toContainText(
      'Upload temporarily unavailable',
    );
    expect(captured.messages).not.toContainEqual(
      expect.objectContaining({ content: '📎 codex-upload-retry.txt' }),
    );

    await page.getByLabel('Retry file upload codex-upload-retry.txt').click();
    await expect
      .poll(() =>
        captured.messages.some((message) => message.content === '📎 codex-upload-retry.txt'),
      )
      .toBeTruthy();
    await expect(page.getByTestId('file-upload-error')).toHaveCount(0);
  });

  test('voice recorder microphone failures show retry and recover recording controls', async ({
    page,
  }) => {
    await installConversationApiMocks(page);
    await installVoiceRecordingMocks(page, { rejectFirstGetUserMedia: true });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.getByLabel('Record voice message').click();
    const recorder = page.getByTestId('voice-recorder');
    await expect(recorder.getByTestId('voice-recorder-error')).toContainText(
      'Microphone permission is required to record a voice message.',
    );

    await recorder.getByLabel('Retry voice recording').click();
    await expect(recorder.getByLabel('Stop recording')).toBeVisible();

    await recorder.getByLabel('Stop recording').click();
    await expect(recorder.getByText('Voice message ready')).toBeVisible();

    await recorder.getByLabel('Cancel voice recording').click();
    await expect(page.getByTestId('voice-recorder')).toHaveCount(0);
    await expect(page.getByLabel('Record voice message')).toBeVisible();
  });

  test('composer voice send failures keep retry controls actionable', async ({ page }) => {
    const captured = await installConversationApiMocks(page);
    let uploadAttempts = 0;

    await installVoiceRecordingMocks(page);

    await page.route('**/social/api/upload', async (route) => {
      uploadAttempts += 1;
      if (uploadAttempts === 1) {
        await fulfillJson(route, 503, { error: 'Voice upload temporarily unavailable' });
        return;
      }

      await fulfillJson(route, 200, {
        s3Key: 'uploads/e2e/voice-message.webm',
        url: tinyVoiceDataUrl,
        fileName: 'voice-message.webm',
        fileSize: 18,
        mimeType: 'audio/webm',
      });
    });

    await page.route('**/social/api/voice/transcribe', async (route) => {
      await fulfillJson(route, 200, { transcription: 'Codex voice retry transcript' });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.getByLabel('Record voice message').click();
    const recorder = page.getByTestId('voice-recorder');
    await expect(recorder).toBeVisible();
    await recorder.getByLabel('Stop recording').click();
    await expect(recorder.getByText('Voice message ready')).toBeVisible();

    await recorder.getByLabel('Send voice message').click();
    await expect(recorder.getByTestId('voice-recorder-error')).toContainText(
      'Voice upload temporarily unavailable',
    );
    expect(captured.messages).not.toContainEqual(
      expect.objectContaining({ content: '🎙️ Voice message' }),
    );

    await recorder.getByLabel('Retry voice message').click();
    await expect
      .poll(() => captured.messages.some((message) => message.content === '🎙️ Voice message'))
      .toBeTruthy();
    const voicePost = captured.messages.find((message) => message.content === '🎙️ Voice message');
    expect(voicePost?.attachments?.[0]).toEqual(
      expect.objectContaining({
        fileName: 'voice-message.webm',
        mimeType: 'audio/webm',
      }),
    );
    expect(voicePost?.metadata).toEqual(
      expect.objectContaining({
        type: 'voice',
        duration: expect.any(Number),
      }),
    );
    await expect(page.getByTestId('voice-recorder')).toHaveCount(0);
    await expect(page.getByTestId('message-composer')).toBeVisible();
  });

  test('voice transcription failures show retry and recover the transcript', async ({ page }) => {
    await installConversationApiMocks(page);
    await installVoiceRecordingMocks(page);

    await page.route('**/social/api/upload', async (route) => {
      await fulfillJson(route, 200, {
        s3Key: 'uploads/e2e/voice-message.webm',
        url: tinyVoiceDataUrl,
        fileName: 'voice-message.webm',
        fileSize: 18,
        mimeType: 'audio/webm',
      });
    });

    let transcribeAttempts = 0;
    await page.route('**/social/api/voice/transcribe', async (route) => {
      transcribeAttempts += 1;
      if (transcribeAttempts === 1) {
        await fulfillJson(route, 503, {
          error: 'Voice transcription temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, {
        transcription: 'Codex recovered voice transcript',
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    await page.getByLabel('Record voice message').click();
    const recorder = page.getByTestId('voice-recorder');
    await expect(recorder).toBeVisible();
    await recorder.getByLabel('Stop recording').click();
    await recorder.getByLabel('Send voice message').click();

    const voicePlayer = page.getByTestId('voice-player').last();
    await expect(voicePlayer).toBeVisible();
    await expect(voicePlayer.getByTestId('voice-transcription-status')).toContainText(
      'Voice transcription temporarily unavailable',
    );

    await voicePlayer.getByLabel('Retry voice transcription').click();
    await expect(voicePlayer.getByLabel('Show transcription')).toBeVisible();
    await voicePlayer.getByLabel('Show transcription').click();
    await expect(voicePlayer.getByText('Codex recovered voice transcript')).toBeVisible();
    expect(transcribeAttempts).toBe(2);
  });

  test('voice message playback controls expose seek, speed, and transcript state', async ({
    page,
  }) => {
    const captured = await installConversationApiMocks(page, {
      messageResponseExtras: {
        attachments: [
          {
            id: 'e2e-voice-attachment',
            fileName: 'codex-voice.wav',
            mimeType: 'audio/wav',
            url: tinyVoiceDataUrl,
          },
        ],
        metadata: {
          type: 'voice',
          duration: 3,
          transcription: 'Codex voice playback transcript',
        },
      },
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex voice playback smoke ${Date.now()}`;
    await page.getByTestId('message-composer').fill(messageText);
    await page.getByTestId('message-send-button').click();
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));

    const messageRow = page.getByTestId('message-row').filter({ hasText: messageText });
    await expect(messageRow).toBeVisible();

    const voicePlayer = messageRow.getByTestId('voice-player');
    await expect(voicePlayer).toBeVisible();
    await expect(voicePlayer.getByLabel('Play voice message')).toBeVisible();
    await expect(voicePlayer.getByLabel('Seek voice message')).toBeEnabled();

    await voicePlayer.getByLabel('Change playback speed, currently 1x').click();
    await expect(voicePlayer.getByLabel('Change playback speed, currently 1.5x')).toBeVisible();

    await voicePlayer.getByLabel('Show transcription').click();
    await expect(voicePlayer.getByText('Codex voice playback transcript')).toBeVisible();
    await voicePlayer.getByLabel('Hide transcription').click();
    await expect(voicePlayer.getByText('Codex voice playback transcript')).toBeHidden();
  });

  test('profile popovers surface profile load errors and retry cleanly', async ({ page }) => {
    const captured = await installConversationApiMocks(page);
    let profileRequests = 0;

    await page.route('**/social/api/users/profile**', async (route) => {
      profileRequests += 1;
      if (profileRequests === 1) {
        await fulfillJson(route, 503, {
          error: 'Profile service temporarily unavailable',
        });
        return;
      }

      await fulfillJson(route, 200, {
        id: 'e2e-alex-rivera',
        username: 'alex_rivera',
        displayName: 'Alex Rivera',
        avatarUrl: null,
        bio: 'E2E profile retry fixture',
        location: 'Toronto',
        website: null,
        status: 'online',
        isAgent: false,
        createdAt: new Date('2025-01-15T12:00:00.000Z').toISOString(),
        channelCount: 3,
        postCount: 1,
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex profile popover smoke @alex_rivera ${Date.now()}`;
    await page.getByTestId('message-composer').fill(messageText);
    await page.getByTestId('message-send-button').click();
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));

    const messageRow = page.getByTestId('message-row').filter({ hasText: messageText });
    await expect(messageRow).toBeVisible();
    await messageRow.getByLabel('Open alex_rivera profile card').click();

    await expect(page.getByTestId('profile-popover-error')).toContainText(
      'Profile service temporarily unavailable',
    );
    await page.getByLabel('Retry profile').click();
    await expect(page.getByRole('dialog', { name: 'Alex Rivera profile card' })).toBeVisible();
    await expect(page.getByText('E2E profile retry fixture')).toBeVisible();
    await page.getByLabel('Close profile card').click();
    await expect(page.getByRole('dialog', { name: 'Alex Rivera profile card' })).toBeHidden();
  });

  test('own profile edit recovers from save errors and updates profile fields', async ({
    page,
  }) => {
    const profileResponse = await page.request.get(
      '/social/api/users/profile?username=messages-smoke',
    );
    expect(profileResponse.ok()).toBeTruthy();
    const originalProfile = (await profileResponse.json()) as {
      id: string;
      displayName: string;
      bio: string | null;
      location: string | null;
      website: string | null;
    };

    const stamp = Date.now();
    const editedProfile = {
      displayName: `Messages Smoke ${stamp}`,
      bio: `Codex profile edit smoke ${stamp}`,
      location: 'Toronto QA Lab',
      website: `streetvoices.example/profile-${stamp}`,
    };

    let patchAttempts = 0;
    await page.route('**/social/api/users/profile', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      patchAttempts += 1;
      if (patchAttempts === 1) {
        await fulfillJson(route, 503, { error: 'Profile save temporarily unavailable' });
        return;
      }

      await route.fallback();
    });

    try {
      await page.goto(`/social/profile/${originalProfile.id}?embed=true`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.getByTestId('profile-display-name')).toHaveText(
        originalProfile.displayName,
      );

      await page.getByLabel('Edit profile').click();
      const editor = page.getByRole('dialog', { name: 'Edit profile' });
      await expect(editor).toBeVisible();

      await editor.getByTestId('profile-edit-display-name').fill(editedProfile.displayName);
      await editor.getByTestId('profile-edit-bio').fill(editedProfile.bio);
      await editor.getByTestId('profile-edit-location').fill(editedProfile.location);
      await editor.getByTestId('profile-edit-website').fill(editedProfile.website);

      await editor.getByTestId('profile-edit-save').click();
      await expect(editor.getByTestId('profile-edit-error')).toContainText(
        'Profile save temporarily unavailable',
      );
      await expect(editor.getByTestId('profile-edit-display-name')).toHaveValue(
        editedProfile.displayName,
      );

      await editor.getByTestId('profile-edit-save').click();
      await expect(page.getByTestId('profile-edit-notice')).toContainText('Profile updated');
      await expect(page.getByTestId('profile-display-name')).toHaveText(editedProfile.displayName);
      await expect(page.getByText(editedProfile.bio)).toBeVisible();
      await expect(page.getByText(editedProfile.location)).toBeVisible();
      await expect(page.getByRole('link', { name: /streetvoices\.example/ })).toHaveAttribute(
        'href',
        `https://${editedProfile.website}`,
      );
      expect(patchAttempts).toBe(2);
    } finally {
      await page.request.patch('/social/api/users/profile', {
        data: {
          displayName: originalProfile.displayName,
          bio: originalProfile.bio || '',
          location: originalProfile.location || '',
          website: originalProfile.website || '',
        },
      });
    }
  });

  test('DM directory search and direct-message actions recover from errors', async ({ page }) => {
    let requestBody: { userId?: string } | null = null;
    let dmRequestCount = 0;

    await page.route('**/social/api/dm', async (route) => {
      dmRequestCount += 1;
      requestBody = JSON.parse(route.request().postData() || '{}') as { userId?: string };
      if (dmRequestCount === 1) {
        await fulfillJson(route, 503, { error: 'DM directory temporarily unavailable' });
        return;
      }

      await fulfillJson(route, 201, { channelId: 'e2e-dm-channel' });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    await page.getByLabel('Search people and agents').fill('no-such-codex-person');
    await expect(page.getByTestId('dm-directory-empty')).toBeVisible();
    await page.getByLabel('Clear directory search').click();
    await expect(page.getByTestId('dm-directory-empty')).toHaveCount(0);

    const directoryRows = page.getByTestId('dm-directory-row');
    const directoryRowCount = await directoryRows.count();
    expect(
      directoryRowCount,
      'Messages needs at least one teammate or agent for DM-start coverage',
    ).toBeGreaterThan(0);

    const firstRow = directoryRows.first();
    const firstStartButton = firstRow.getByTestId('start-dm-button');
    await expect(firstStartButton).toHaveCount(1);
    const expectedUserId = await firstStartButton.getAttribute('data-user-id');
    await firstRow.hover();
    await firstStartButton.click();
    await expect(firstRow.getByTestId('dm-directory-action-error')).toContainText(
      'DM directory temporarily unavailable',
    );

    await firstRow.hover();
    await firstStartButton.click();

    expect(requestBody?.userId).toBe(expectedUserId);
    await expect(page).toHaveURL(/\/social\/dm\/e2e-dm-channel\?embed=true/);
  });

  test('conversation send, reaction, and thread reply controls call the expected Social APIs', async ({
    page,
  }) => {
    const captured = await installConversationApiMocks(page);

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex Playwright smoke ${Date.now()}`;
    await page.getByTestId('message-composer').fill(messageText);
    await page.getByTestId('message-send-button').click();

    await expect(page.getByTestId('message-row').filter({ hasText: messageText })).toBeVisible();
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));

    const messageRow = page.getByTestId('message-row').filter({ hasText: messageText });
    await messageRow.hover();
    await messageRow.getByLabel('Add reaction').click();
    await page.getByLabel('React with 👍').click();
    expect(captured.reactions).toContainEqual(expect.objectContaining({ emoji: '👍' }));

    await messageRow.hover();
    await messageRow.getByLabel('Reply in thread').click();

    const threadPanel = page.getByTestId('thread-panel');
    await expect(threadPanel).toBeVisible();
    await expect(threadPanel.getByText('No replies yet')).toBeVisible();

    const replyText = `Thread reply ${Date.now()}`;
    await threadPanel.getByTestId('message-composer').fill(replyText);
    await threadPanel.getByTestId('message-send-button').click();

    await expect(threadPanel.getByText(replyText)).toBeVisible();
    expect(captured.messages).toContainEqual(
      expect.objectContaining({ content: replyText, parentId: expect.any(String) }),
    );
  });

  test('composer send failures keep drafts visible and retry successfully', async ({ page }) => {
    const messageError = 'Messages API temporarily unavailable';
    const captured = await installConversationApiMocks(page, {
      messagePostErrorOnce: messageError,
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex composer retry smoke ${Date.now()}`;
    const composer = page.getByTestId('message-composer');
    await composer.fill(messageText);
    await page.getByTestId('message-send-button').click();

    await expect(page.getByTestId('message-composer-error')).toContainText(messageError);
    await expect(page.getByTestId('message-composer-error')).toContainText('Draft saved.');
    await expect(composer).toHaveValue(messageText);
    expect(captured.messages).toHaveLength(0);

    await page.getByTestId('message-send-button').click();
    await expect(page.getByTestId('message-row').filter({ hasText: messageText })).toBeVisible();
    await expect(page.getByTestId('message-composer-error')).toHaveCount(0);
    await expect(composer).toHaveValue('');
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));
  });

  test('thread panel shows reply load errors and retries cleanly', async ({ page }) => {
    const captured = await installConversationApiMocks(page, {
      threadLoadErrorOnce: 'Thread replies temporarily unavailable',
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex thread error smoke ${Date.now()}`;
    await page.getByTestId('message-composer').fill(messageText);
    await page.getByTestId('message-send-button').click();
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));

    const messageRow = page.getByTestId('message-row').filter({ hasText: messageText });
    await expect(messageRow).toBeVisible();
    await messageRow.hover();
    await messageRow.getByLabel('Reply in thread').click();

    const threadPanel = page.getByTestId('thread-panel');
    await expect(threadPanel.getByTestId('thread-load-error')).toContainText(
      'Thread replies temporarily unavailable',
    );
    await threadPanel.getByRole('button', { name: 'Retry replies' }).click();
    await expect(threadPanel.getByText('No replies yet')).toBeVisible();
  });

  test('thread reply send failures keep drafts visible and retry successfully', async ({
    page,
  }) => {
    const replyError = 'Thread replies are temporarily read-only';
    const captured = await installConversationApiMocks(page, {
      threadPostErrorOnce: replyError,
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex thread send retry parent ${Date.now()}`;
    await page.getByTestId('message-composer').fill(messageText);
    await page.getByTestId('message-send-button').click();
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));

    const messageRow = page.getByTestId('message-row').filter({ hasText: messageText });
    await expect(messageRow).toBeVisible();
    await messageRow.hover();
    await messageRow.getByLabel('Reply in thread').click();

    const threadPanel = page.getByTestId('thread-panel');
    await expect(threadPanel).toBeVisible();

    const replyText = `Thread retry reply ${Date.now()}`;
    const replyComposer = threadPanel.getByTestId('message-composer');
    await replyComposer.fill(replyText);
    await threadPanel.getByTestId('message-send-button').click();

    await expect(threadPanel.getByTestId('message-composer-error')).toContainText(replyError);
    await expect(threadPanel.getByTestId('message-composer-error')).toContainText('Draft saved.');
    await expect(replyComposer).toHaveValue(replyText);
    expect(captured.messages).not.toContainEqual(
      expect.objectContaining({ content: replyText, parentId: expect.any(String) }),
    );

    await threadPanel.getByTestId('message-send-button').click();
    await expect(threadPanel.getByText(replyText)).toBeVisible();
    await expect(threadPanel.getByTestId('message-composer-error')).toHaveCount(0);
    await expect(replyComposer).toHaveValue('');
    expect(captured.messages).toContainEqual(
      expect.objectContaining({ content: replyText, parentId: expect.any(String) }),
    );
  });

  test('message row actions surface request errors instead of failing silently', async ({
    page,
  }) => {
    const captured = await installConversationApiMocks(page, {
      reactionError: 'Reaction temporarily unavailable',
    });

    await page.route('**/social/api/saved', async (route) => {
      await fulfillJson(route, 503, { error: 'Saved items temporarily unavailable' });
    });

    await page.route('**/social/api/channels/*/pins', async (route) => {
      if (route.request().method() === 'POST') {
        await fulfillJson(route, 503, { error: 'Pins temporarily unavailable' });
        return;
      }
      await route.fallback();
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const messageText = `Codex row action smoke ${Date.now()}`;
    await page.getByTestId('message-composer').fill(messageText);
    await page.getByTestId('message-send-button').click();
    expect(captured.messages).toContainEqual(expect.objectContaining({ content: messageText }));

    const messageRow = page.getByTestId('message-row').filter({ hasText: messageText });
    await expect(messageRow).toBeVisible();

    await messageRow.hover();
    await messageRow.getByLabel('Save for later').click();
    await expect(messageRow.getByTestId('message-action-error')).toContainText(
      'Saved items temporarily unavailable',
    );
    await messageRow.getByLabel('Dismiss message action error').click();

    await messageRow.hover();
    await messageRow.getByLabel('Add reaction').click();
    await page.getByLabel('React with 👍').click();
    await expect(messageRow.getByTestId('message-action-error')).toContainText(
      'Reaction temporarily unavailable',
    );
    await messageRow.getByLabel('Dismiss message action error').click();

    await messageRow.hover();
    await messageRow.getByLabel('More message actions').click();
    await page.getByRole('menuitem', { name: 'Pin message' }).click();
    await expect(messageRow.getByTestId('message-action-error')).toContainText(
      'Pins temporarily unavailable',
    );
  });

  test('message row copy, edit, and delete actions expose fallback and retry states', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException('Clipboard blocked by smoke test', 'NotAllowedError');
          },
        },
      });
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: () => false,
      });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const originalMessageText = `Codex row edit delete smoke ${Date.now()}`;
    await page.getByTestId('message-composer').fill(originalMessageText);
    await page.getByTestId('message-send-button').click();

    const createdRow = page.getByTestId('message-row').filter({ hasText: originalMessageText });
    await expect(createdRow).toBeVisible();
    const messageId = await createdRow.getAttribute('data-message-id');
    expect(messageId).toBeTruthy();

    const messageRow = page.locator(`[data-testid="message-row"][data-message-id="${messageId}"]`);
    await messageRow.hover();
    await messageRow.getByLabel('Copy message link').click();
    await expect(messageRow.getByTestId('message-copy-fallback')).toBeVisible();
    await expect(messageRow.getByTestId('message-copy-fallback-input')).toHaveValue(
      new RegExp(`/messages\\?channel=(?:dm|channel)-[^&]+&message=${messageId}`),
    );
    await messageRow.getByTestId('message-copy-fallback-select').click();

    let editAttempts = 0;
    let deleteAttempts = 0;
    let editedBody: { content?: string } | null = null;

    await page.route(`**/social/api/channels/*/messages/${messageId}`, async (route) => {
      const request = route.request();
      if (request.method() === 'PATCH') {
        editAttempts += 1;
        editedBody = JSON.parse(request.postData() || '{}') as { content?: string };
        if (editAttempts === 1) {
          await fulfillJson(route, 503, { error: 'Edit temporarily unavailable' });
          return;
        }
        await fulfillJson(route, 200, { ok: true });
        return;
      }

      if (request.method() === 'DELETE') {
        deleteAttempts += 1;
        if (deleteAttempts === 1) {
          await fulfillJson(route, 503, { error: 'Delete temporarily unavailable' });
          return;
        }
        await fulfillJson(route, 200, { ok: true });
        return;
      }

      await route.fallback();
    });

    await messageRow.hover();
    await messageRow.getByLabel('More message actions').click();
    await page.getByRole('menuitem', { name: 'Edit message' }).click();

    const editedMessageText = `${originalMessageText} edited`;
    await messageRow.getByTestId('message-edit-input').fill(editedMessageText);
    await messageRow.getByTestId('message-edit-save').click();
    await expect(messageRow.getByTestId('message-action-error')).toContainText(
      'Edit temporarily unavailable',
    );
    await expect(messageRow.getByTestId('message-edit-input')).toHaveValue(editedMessageText);

    await messageRow.getByTestId('message-edit-save').click();
    expect(editedBody?.content).toBe(editedMessageText);
    await expect(messageRow).toContainText(editedMessageText);
    await expect(messageRow.getByTestId('message-edit-input')).toHaveCount(0);

    await messageRow.hover();
    await messageRow.getByLabel('More message actions').click();
    await page.getByRole('menuitem', { name: 'Delete message' }).click();
    await expect(messageRow.getByTestId('message-action-error')).toContainText(
      'Delete temporarily unavailable',
    );

    const deleteMenuItem = page.getByRole('menuitem', { name: 'Delete message' });
    if ((await deleteMenuItem.count()) === 0) {
      await messageRow.hover();
      await messageRow.getByLabel('More message actions').click();
    }
    await page.getByRole('menuitem', { name: 'Delete message' }).click();
    await expect(messageRow).toHaveCount(0);
  });

  test('imported email reply controls validate, surface send errors, and retry successfully', async ({
    page,
  }) => {
    const importedEmailMetadata: CapturedMessagePost['metadata'] = {
      type: 'email_import',
      email: {
        provider: 'gmail',
        subject: 'Codex imported email smoke',
        from: {
          name: 'Pat Sender',
          email: 'pat.sender@example.com',
        },
        sentAt: new Date('2026-05-04T12:00:00.000Z').toISOString(),
        messageId: 'codex-imported-email@example.com',
        bodyPreview: 'Imported email body preview',
      },
    };
    const captured = await installConversationApiMocks(page, {
      messageResponseExtras: {
        metadata: importedEmailMetadata,
      },
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await openFirstConversation(page);

    const channelId = channelIdFromUrl(page.url());
    const importedMessageText = `Codex imported email reply smoke ${Date.now()}`;
    await page.getByTestId('message-composer').fill(importedMessageText);
    await page.getByTestId('message-send-button').click();
    expect(captured.messages).toContainEqual(
      expect.objectContaining({ content: importedMessageText }),
    );

    const importedRow = page.getByTestId('message-row').filter({ hasText: importedMessageText });
    await expect(importedRow).toBeVisible();
    await expect(importedRow).toContainText('Reply to Pat Sender <pat.sender@example.com>');

    const importedMessageId = await importedRow.getAttribute('data-message-id');
    expect(importedMessageId).toBeTruthy();

    let replyAttempts = 0;
    let replyRequestBody: { content?: string } | null = null;
    await page.route(`**/social/api/email-import/${importedMessageId}/reply`, async (route) => {
      replyAttempts += 1;
      replyRequestBody = JSON.parse(route.request().postData() || '{}') as {
        content?: string;
      };

      if (replyAttempts === 1) {
        await fulfillJson(route, 503, { error: 'SMTP temporarily unavailable' });
        return;
      }

      const replyText = replyRequestBody.content || '';
      await fulfillJson(route, 201, {
        message: socialMessage(channelId, replyText, importedMessageId, {
          metadata: {
            type: 'email_reply',
            emailReply: {
              sourceMessageId: importedMessageId!,
              to: {
                name: 'Pat Sender',
                email: 'pat.sender@example.com',
              },
              subject: 'Re: Codex imported email smoke',
              sentAt: new Date().toISOString(),
            },
          },
        }),
        delivery: {
          to: {
            name: 'Pat Sender',
            email: 'pat.sender@example.com',
          },
          subject: 'Re: Codex imported email smoke',
          sentAt: new Date().toISOString(),
        },
      });
    });

    await importedRow.getByTestId('email-reply-toggle').click();
    await importedRow.getByTestId('email-reply-send').click();
    await expect(importedRow.getByTestId('message-action-error')).toContainText(
      'Email reply content is required.',
    );

    const replyText = `Codex email reply retry smoke ${Date.now()}`;
    await importedRow.getByTestId('email-reply-input').fill(replyText);
    await importedRow.getByTestId('email-reply-send').click();
    await expect(importedRow.getByTestId('message-action-error')).toContainText(
      'SMTP temporarily unavailable',
    );
    await expect(importedRow.getByTestId('email-reply-input')).toHaveValue(replyText);

    await importedRow.getByTestId('email-reply-send').click();
    expect(replyRequestBody?.content).toBe(replyText);
    await expect(importedRow.getByTestId('email-reply-notice')).toContainText('Email sent');
    await expect(importedRow.getByTestId('email-reply-input')).toHaveCount(0);
  });

  test('older message loading surfaces errors, retries, and keeps jump-to-latest actionable', async ({
    page,
  }) => {
    const channelName = `codex-history-${Date.now()}`;
    let createdChannelId: string | null = null;

    const createResponse = await page.request.post('/social/api/channels', {
      data: {
        name: channelName,
        description: 'History controls smoke channel',
        type: 'PUBLIC',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdChannel = (await createResponse.json()) as { id?: string };
    createdChannelId = createdChannel.id || null;
    expect(createdChannelId).toBeTruthy();

    try {
      const seedPrefix = `Codex history seed ${Date.now()}`;
      for (let index = 0; index < 101; index += 1) {
        const response = await page.request.post(
          `/social/api/channels/${createdChannelId}/messages`,
          {
            data: { content: `${seedPrefix} ${index.toString().padStart(3, '0')}` },
          },
        );
        expect(response.ok()).toBeTruthy();
      }

      const olderMessageText = `Codex older history recovered ${Date.now()}`;
      let loadOlderRequests = 0;
      await page.route(`**/social/api/channels/${createdChannelId}/messages**`, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== 'GET' || !url.searchParams.has('cursor')) {
          await route.fallback();
          return;
        }

        loadOlderRequests += 1;
        if (loadOlderRequests === 1) {
          await fulfillJson(route, 503, {
            error: 'Older messages temporarily unavailable',
          });
          return;
        }

        await fulfillJson(route, 200, {
          messages: [
            socialMessage(createdChannelId!, olderMessageText, null, {
              metadata: undefined,
            }),
          ],
          nextCursor: null,
        });
      });

      await page.goto(`/social/channels/${createdChannelId}?embed=true`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).not.toHaveURL(authRedirectPattern);
      await expect(page.getByTestId('load-older-messages')).toBeVisible();

      await page.getByTestId('load-older-messages').click();
      await expect(page.getByTestId('older-messages-error')).toContainText(
        'Older messages temporarily unavailable',
      );
      await expect(page.getByTestId('load-older-messages')).toContainText('Retry older messages');

      await page.getByLabel('Dismiss older messages error').click();
      await expect(page.getByTestId('older-messages-error')).toHaveCount(0);

      await page.getByTestId('load-older-messages').click();
      await expect(page.getByText(olderMessageText)).toBeVisible();
      await expect(page.getByTestId('jump-to-latest')).toBeVisible();

      await page.getByTestId('jump-to-latest').click();
      await expect(page.getByTestId('jump-to-latest')).toHaveCount(0);
    } finally {
      if (createdChannelId) {
        await page.request.patch(`/social/api/channels/${createdChannelId}/archive`, {
          data: { archived: true },
        });
      }
    }
  });

  test('existing DM call controls surface media errors and start voice or video overlays', async ({
    page,
  }) => {
    const searchResponse = await page.request.get('/social/api/users/search?q=alex');
    expect(searchResponse.ok()).toBeTruthy();
    const users = (await searchResponse.json()) as Array<{ id?: string }>;
    const targetUser = users.find((user) => Boolean(user.id));
    expect(targetUser?.id).toBeTruthy();

    const dmResponse = await page.request.post('/social/api/dm', {
      data: { userId: targetUser?.id },
    });
    expect(dmResponse.ok()).toBeTruthy();
    const dm = (await dmResponse.json()) as { channelId?: string };
    expect(dm.channelId).toBeTruthy();

    await installCallMediaMocks(page);
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const frame = await getMessagesIframe(page);
    const dmLinks = frame.locator(`${messagesSidebar} a[href*="/dm/${dm.channelId}"]`);

    await dmLinks.first().click();
    await expect(frame.getByLabel('Voice call')).toBeEnabled();
    await expect(frame.getByLabel('Video call')).toBeEnabled();

    await frame.evaluate(() => {
      (window as typeof window & { __codexRejectCallMedia?: boolean }).__codexRejectCallMedia =
        true;
    });
    await frame.getByLabel('Voice call').click();
    await expect(frame.getByTestId('call-start-error')).toContainText(
      'Microphone permission is required to start a voice call.',
    );
    await frame.getByLabel('Dismiss call error').click();
    await expect(frame.getByTestId('call-start-error')).toHaveCount(0);

    await frame.evaluate(() => {
      (window as typeof window & { __codexRejectCallMedia?: boolean }).__codexRejectCallMedia =
        false;
    });
    await frame.getByLabel('Voice call').click();
    await expect(frame.getByRole('dialog', { name: /Voice call with/ })).toBeVisible();
    await frame.getByLabel('Mute').click();
    await expect(frame.getByLabel('Unmute')).toBeVisible();
    await frame.getByLabel('End call').click();
    await expect(frame.getByTestId('call-overlay')).toHaveCount(0);

    await frame.getByLabel('Video call').click();
    await expect(frame.getByRole('dialog', { name: /Video call with/ })).toBeVisible();

    await frame.evaluate(() => {
      (window as typeof window & { __codexRejectScreenShare?: boolean }).__codexRejectScreenShare =
        true;
    });
    await frame.getByLabel('Share screen').click();
    await expect(frame.getByTestId('call-screen-share-error')).toContainText(
      'Screen sharing permission is required.',
    );
    await frame.getByLabel('Dismiss screen share error').click();
    await expect(frame.getByTestId('call-screen-share-error')).toHaveCount(0);

    await frame.evaluate(() => {
      (window as typeof window & { __codexRejectScreenShare?: boolean }).__codexRejectScreenShare =
        false;
    });
    await frame.getByLabel('Share screen').click();
    await expect(frame.getByLabel('Stop sharing screen')).toBeVisible();
    await frame.getByLabel('Stop sharing screen').click();
    await expect(frame.getByLabel('Share screen')).toBeVisible();

    await frame.getByLabel('Turn off camera').click();
    await expect(frame.getByLabel('Turn on camera')).toBeVisible();
    await frame.getByLabel('End call').click();
    await expect(frame.getByTestId('call-overlay')).toHaveCount(0);
  });
});
