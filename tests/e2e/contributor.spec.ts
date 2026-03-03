import { test, expect } from './coverage-fixture';

// Contributor mode: user/repo@author in input.
// parseEntry returns { owner: 'user', repos: ['repo'], author: 'author' }.
// Since repos is already known from input, fetchEntryData skips /repos and goes
// straight to contributorLanguages(owner, repo, author) → /contributor-langs.

test('shows contributor language stats for user/repo@author input', async ({ page }) => {
  await page.route('**/gitlang/github/contributor-langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ TypeScript: 5000, JavaScript: 3000, CSS: 1000 }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('user/repo@author');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'TypeScript' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'JavaScript' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'CSS' })).toBeVisible();
});

test('contributor mode encodes author in URL path', async ({ page }) => {
  await page.route('**/gitlang/github/contributor-langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Go: 8000 }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('owner/myrepo@myauthor');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  expect(page.url()).toContain('/owner/myrepo@myauthor');
});

test('contributor mode calls contributor-langs with correct params', async ({ page }) => {
  let capturedParams: URLSearchParams | null = null;

  await page.route('**/gitlang/github/contributor-langs*', (route) => {
    capturedParams = new URL(route.request().url()).searchParams;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Python: 6000, Shell: 2000 }),
    });
  });

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('octocat/Spoon-Knife@torvalds');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });

  expect(capturedParams).not.toBeNull();
  expect(capturedParams!.get('owner')).toBe('octocat');
  expect(capturedParams!.get('repo')).toBe('Spoon-Knife');
  expect(capturedParams!.get('author')).toBe('torvalds');
});

test('contributor mode does not call merged or repos endpoints', async ({ page }) => {
  let mergedCalled = false;
  let reposCalled = false;

  await page.route('**/gitlang/github/merged*', (route) => {
    mergedCalled = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: [], langs: [] }),
    });
  });

  await page.route('**/gitlang/github/repos*', (route) => {
    reposCalled = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/gitlang/github/contributor-langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Rust: 10000 }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('user/repo@dev');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });

  expect(mergedCalled).toBe(false);
  expect(reposCalled).toBe(false);
});
