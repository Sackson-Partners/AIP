import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e@aip-test.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'E2eTest@123!';

async function login(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

test.describe('Navigation', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page loads correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test('dashboard loads after authentication', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/login');
  });

  test('mobile viewport: login page renders at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('authenticated user can navigate to projects page', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/login');
  });

  test('authenticated user can navigate to analytics page', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/login');
  });
});
