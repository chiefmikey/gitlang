import { test, expect } from './coverage-fixture';

test('displays language bars after username lookup', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repos: ['repo1', 'repo2'],
        langs: [
          { TypeScript: 5000, JavaScript: 3000 },
          { CSS: 2000 },
        ],
      }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('testuser');
  await input.press('Enter');

  // Wait for bars to appear — bar-row starts at height 0 and animates open
  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });

  // Check language names appear inside the bars
  await expect(page.locator('.name span', { hasText: 'TypeScript' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'JavaScript' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'CSS' })).toBeVisible();

  // URL should reflect the submitted username
  expect(page.url()).toContain('/testuser');
});

test('shows loading state before data arrives', async ({ page }) => {
  let resolveRoute: (value: unknown) => void;
  const routeHeld = new Promise((resolve) => {
    resolveRoute = resolve;
  });

  await page.route('**/gitlang/github/merged*', async (route) => {
    await routeHeld;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repos: ['repo1'],
        langs: [{ TypeScript: 5000 }],
      }),
    });
  });

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('loadinguser');
  await input.press('Enter');

  // While request is pending, Card shows "Loading..."
  await expect(page.locator('h5', { hasText: 'Loading...' })).toBeVisible({ timeout: 3000 });

  // Unblock the route and confirm data arrives
  resolveRoute!(undefined);
  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
});

test('shows repo and lang counts in card', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repos: ['repo1', 'repo2'],
        langs: [
          { TypeScript: 5000 },
          { JavaScript: 3000 },
        ],
      }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('testuser');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });

  // Card displays the username as a link and counts
  await expect(page.locator('a.owner', { hasText: 'testuser' })).toBeVisible();
  await expect(page.locator('.lang', { hasText: 'Langs: 2' })).toBeVisible();
  await expect(page.locator('.repos', { hasText: 'Repos: 2' })).toBeVisible();
});
