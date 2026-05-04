import { expect, test } from '@playwright/test';
import type { Frame, Page, Route } from '@playwright/test';

const messagesFrame = 'iframe[title="Street Voices Messages"]';
const messagesSidebar = 'aside[aria-label="Messages workspace"]';
const hasAuthenticatedStorageState = Boolean(process.env.MESSAGES_STORAGE_STATE);

test.skip(
  !hasAuthenticatedStorageState,
  'Set MESSAGES_STORAGE_STATE to an authenticated LibreChat storage-state file before running Messages smoke tests.',
);

type CapturedMessagePost = {
  content?: string;
  parentId?: string;
};

type CapturedReactionPost = {
  emoji?: string;
};

const authRedirectPattern = /\/api\/auth\/error|\/social\/login|\/login/;

function socialMessage(channelId: string, content: string, parentId: string | null = null) {
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
    attachments: [],
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

async function getMessagesIframe(page: Page): Promise<Frame> {
  const iframe = page.locator(messagesFrame);
  await expect(iframe).toHaveCount(1);
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error('Messages iframe was not available');
  await expect(frame.locator(messagesSidebar)).toBeVisible();
  return frame;
}

async function installConversationApiMocks(page: Page) {
  const messages: CapturedMessagePost[] = [];
  const reactions: CapturedReactionPost[] = [];

  await page.route('**/social/api/channels/*/messages**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.includes('/reactions')) {
      await route.fallback();
      return;
    }

    const channelId = channelIdFromUrl(url.pathname);

    if (request.method() === 'GET' && url.searchParams.has('parentId')) {
      await fulfillJson(route, 200, { messages: [], nextCursor: null });
      return;
    }

    if (request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}') as CapturedMessagePost;
      messages.push(body);
      await fulfillJson(route, 201, socialMessage(channelId, body.content || '', body.parentId || null));
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
    await fulfillJson(route, 200, {
      reactions: [{ emoji: body.emoji || '👍', count: 1, users: ['e2e-current-user'] }],
    });
  });

  return { messages, reactions };
}

async function openFirstConversation(page: Page) {
  const conversationLinks = page
    .locator(messagesSidebar)
    .locator('a[href*="/channels/"], a[href*="/dm/"]');
  const conversationCount = await conversationLinks.count();
  test.skip(conversationCount === 0, 'Messages needs at least one seeded channel or DM for conversation smoke coverage');

  await conversationLinks.first().click();
  await expect(page.getByTestId('message-composer')).toBeVisible();
}

test.describe('Social Messages smoke', () => {
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

  test('embedded Social messages supports light and dark themes', async ({ page }) => {
    await page.goto('/social/dm?embed=true&theme=light', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const aside = page.locator(messagesSidebar);
    await expect(aside).toBeVisible();
    const lightStyles = await aside.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        color: styles.color,
      };
    });

    await page.goto('/social/dm?embed=true&theme=dark', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);
    await expect(aside).toBeVisible();
    const darkStyles = await aside.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        color: styles.color,
      };
    });

    expect(lightStyles.background).not.toEqual(darkStyles.background);
    expect(lightStyles.color).not.toEqual(darkStyles.color);
  });

  test('DM directory starts a direct message through the Social API', async ({ page }) => {
    let requestBody: { userId?: string } | null = null;

    await page.route('**/social/api/dm', async (route) => {
      requestBody = JSON.parse(route.request().postData() || '{}') as { userId?: string };
      await fulfillJson(route, 201, { channelId: 'e2e-dm-channel' });
    });

    await page.goto('/social/dm?embed=true', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const startButtons = page.getByTestId('start-dm-button');
    const startButtonCount = await startButtons.count();
    test.skip(startButtonCount === 0, 'Messages needs at least one teammate or agent for DM-start coverage');

    const firstStartButton = startButtons.first();
    const expectedUserId = await firstStartButton.getAttribute('data-user-id');
    await firstStartButton.click();

    expect(requestBody?.userId).toBe(expectedUserId);
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

  test('existing DM conversations expose voice and video call buttons', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(authRedirectPattern);

    const frame = await getMessagesIframe(page);
    const dmLinks = frame.locator(`${messagesSidebar} a[href*="/dm/"]`);
    const dmCount = await dmLinks.count();
    test.skip(dmCount === 0, 'Messages needs at least one existing DM for call-button coverage');

    await dmLinks.first().click();
    await expect(frame.getByLabel('Voice call')).toBeVisible();
    await expect(frame.getByLabel('Video call')).toBeVisible();
  });
});
