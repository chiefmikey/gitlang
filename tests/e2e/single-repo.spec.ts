import { test, expect } from './coverage-fixture';

// For user/repo input, the app already knows the repo names from the input string.
// It skips the repos endpoint and calls /langs directly with owner + repos params.

test('displays languages for a single repo', async ({ page }) => {
  await page.route('**/gitlang/github/langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ Python: 8000, Shell: 2000 }]),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('user/specific-repo');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'Python' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'Shell' })).toBeVisible();

  // URL should encode the repo path
  expect(page.url()).toContain('/user/specific-repo');
});

test('displays languages for multiple repos specified by name', async ({ page }) => {
  await page.route('**/gitlang/github/langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { Go: 6000, Python: 2000 },
        { TypeScript: 4000 },
      ]),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('user/repo1,repo2');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'Go' })).toBeVisible();
  await expect(page.locator('.name span', { hasText: 'TypeScript' })).toBeVisible();
});

test('does not call merged endpoint for user/repo input', async ({ page }) => {
  let mergedCalled = false;
  await page.route('**/gitlang/github/merged*', (route) => {
    mergedCalled = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: [], langs: [] }),
    });
  });

  await page.route('**/gitlang/github/langs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ Rust: 9000 }]),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('user/repo');
  await input.press('Enter');

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  expect(mergedCalled).toBe(false);
});
