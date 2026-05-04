import { expect, test } from '@playwright/test';

const messagesFrame = 'iframe[title="Street Voices Messages"]';
const messagesSidebar = 'aside[aria-label="Messages workspace"]';

test.describe('Social Messages smoke', () => {
  test('LibreChat /messages uses one shell auth and renders both sidebars', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/api\/auth\/error|\/social\/login|\/login/);
    await expect(page.locator('nav[aria-label="Chat History"]')).toHaveCount(1);
    await expect(page.locator('#sv-standalone-sidebar')).toHaveCount(0);
    await expect(page.locator(messagesFrame)).toHaveCount(1);

    const frame = page.frameLocator(messagesFrame);
    await expect(frame.locator(messagesSidebar)).toBeVisible();
    await expect(frame.getByText('Direct messages').first()).toBeVisible();
  });

  test('embedded Social messages supports light and dark themes', async ({ page }) => {
    await page.goto('/social/dm?embed=true&theme=light', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/api\/auth\/error|\/social\/login|\/login/);

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
    await expect(page).not.toHaveURL(/\/api\/auth\/error|\/social\/login|\/login/);
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
});
