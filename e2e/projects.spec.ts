import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e@aip-test.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'E2eTest@123!';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

test.describe('Projects', () => {
  test('unauthenticated access to /dashboard/projects redirects away', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(2000);
    // Should redirect to login or root
    expect(page.url()).not.toMatch(/\/dashboard\/projects$/);
  });

  test('projects page loads when authenticated', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/login');
  });

  test('projects page shows content when authenticated', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(2000);
    const content = await page.textContent('body');
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('unauthenticated user cannot access /dashboard/investors', async ({ page }) => {
    await page.goto('/dashboard/investors');
    await page.waitForTimeout(2000);
    expect(page.url()).not.toMatch(/\/dashboard\/investors$/);
  });
});
