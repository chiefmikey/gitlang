import { test, expect } from './coverage-fixture';

// Compare mode: user1?user2 in input becomes user1~user2 in URL.
// The data module splits on ~ to create two groups, each processed independently.
// The App renders a .compare-divider with "vs" between the two Results panels.

test('displays side-by-side comparison for two users', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) => {
    const url = new URL(route.request().url());
    const username = url.searchParams.get('username');
    if (username === 'user1') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ repos: ['r1'], langs: [{ TypeScript: 8000 }] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['r2'], langs: [{ Python: 6000 }] }),
    });
  });

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('user1?user2');
  await input.press('Enter');

  // Compare mode renders a "vs" divider between the two groups
  await expect(page.locator('.compare-divider', { hasText: 'vs' })).toBeVisible({ timeout: 5000 });

  // Both user labels appear as compare-label elements
  await expect(page.locator('.compare-label', { hasText: 'user1' })).toBeVisible();
  await expect(page.locator('.compare-label', { hasText: 'user2' })).toBeVisible();

  // Both languages are visible in their respective panels
  await expect(page.locator('.name span', { hasText: 'TypeScript' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'Python' })).toBeVisible();

  // URL uses ~ as the compare delimiter
  expect(page.url()).toContain('/user1~user2');
});

test('URL changes to tilde-separated path for compare mode', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['r1'], langs: [{ JavaScript: 5000 }] }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('alice?bob');
  await input.press('Enter');

  await expect(page.locator('.compare-divider', { hasText: 'vs' })).toBeVisible({ timeout: 5000 });
  expect(page.url()).toContain('/alice~bob');
  expect(page.url()).not.toContain('?');
});

test('compare mode uses merged endpoint for each group independently', async ({ page }) => {
  const requestedUsernames: string[] = [];

  await page.route('**/gitlang/github/merged*', (route) => {
    const url = new URL(route.request().url());
    const username = url.searchParams.get('username');
    if (username) {
      requestedUsernames.push(username);
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['repo'], langs: [{ Go: 3000 }] }),
    });
  });

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('devA?devB');
  await input.press('Enter');

  await expect(page.locator('.compare-divider', { hasText: 'vs' })).toBeVisible({ timeout: 5000 });

  expect(requestedUsernames).toContain('devA');
  expect(requestedUsernames).toContain('devB');
});
