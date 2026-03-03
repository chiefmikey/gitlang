import { test, expect } from './coverage-fixture';

// The app reads window.location.pathname on mount and auto-submits if a path is present.
// Navigating directly to /username triggers a lookup without any user interaction.

test('loads user from URL path on mount', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['repo1'], langs: [{ Go: 10000 }] }),
    }),
  );

  await page.goto('/directuser');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'Go' })).toBeVisible();

  // The owner link in Card should show the path-derived username
  await expect(page.locator('a.owner', { hasText: 'directuser' })).toBeVisible();
});

test('loads user/repo from URL path on mount', async ({ page }) => {
  await page.route('**/gitlang/github/langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ Rust: 7500, TOML: 500 }]),
    }),
  );

  await page.goto('/someowner/somerepo');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'Rust' })).toBeVisible();
});

test('loads compare mode from URL path on mount', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) => {
    const url = new URL(route.request().url());
    const username = url.searchParams.get('username');
    if (username === 'alpha') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ repos: ['ra'], langs: [{ Kotlin: 4000 }] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['rb'], langs: [{ Swift: 5000 }] }),
    });
  });

  await page.goto('/alpha~beta');

  await expect(page.locator('.compare-divider', { hasText: 'vs' })).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'Kotlin' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'Swift' })).toBeVisible();
});

test('index page with no path does not auto-submit', async ({ page }) => {
  let apiCalled = false;
  await page.route('**/gitlang/github/**', (route) => {
    apiCalled = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: [], langs: [] }),
    });
  });

  await page.goto('/');

  // Give the app time to mount and potentially call the API
  await page.waitForTimeout(500);
  expect(apiCalled).toBe(false);

  // Input should be visible and empty
  await expect(page.locator('input[name="input"]')).toBeVisible();
});
