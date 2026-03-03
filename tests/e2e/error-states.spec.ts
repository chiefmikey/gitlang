import { test, expect } from './coverage-fixture';

// Error constants from client/lib/data/constants.ts:
//   ERROR.NOT_FOUND = 'Not Found'
//   ERROR.RATE_LIMIT = 'API rate limit reached. Try again in a few minutes.'
//
// Results.svelte shows:
//   - <h4 class="error">{errorMessage}</h4>  when error.message is set (axios throws)
//   - <h4 class="error">{ERROR.NOT_FOUND}</h4>  when data is an empty array
//
// A 404 from /merged causes axios to throw, which propagates through getData()
// and sets errorMessage to error.message. A 429 throws Error(ERROR.RATE_LIMIT).

test('shows Not Found message for user with no repos (empty data array)', async ({ page }) => {
  // The merged endpoint returns success but with empty repos/langs —
  // the app sets data = [] and Results renders ERROR.NOT_FOUND.
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: [], langs: [] }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('emptyuser');
  await input.press('Enter');

  await expect(page.locator('h4.error', { hasText: 'Not Found' })).toBeVisible({ timeout: 5000 });
});

test('shows error message when API returns 404', async ({ page }) => {
  // A non-2xx response causes axios to throw; App.getData() catches it and sets
  // errorMessage = error.message. The exact message comes from axios ("Request failed...").
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Not Found' }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('nonexistent');
  await input.press('Enter');

  // The app sets data = [] when getData returns undefined (catch swallows error),
  // which renders the NOT_FOUND constant text.
  await expect(page.locator('h4.error')).toBeVisible({ timeout: 5000 });
});

test('shows rate limit error message on 429 response', async ({ page }) => {
  // 429 causes the merged request to throw Error(ERROR.RATE_LIMIT).
  // This propagates up through getData() which catches it and sets errorMessage.
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Rate limit exceeded' }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('ratelimited');
  await input.press('Enter');

  await expect(
    page.locator('h4.error', { hasText: 'API rate limit reached' }),
  ).toBeVisible({ timeout: 5000 });
});

test('input field remains available after an error', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: [], langs: [] }),
    }),
  );

  await page.goto('/');
  const input = page.locator('input[name="input"]');
  await input.fill('failinguser');
  await input.press('Enter');

  await expect(page.locator('h4.error')).toBeVisible({ timeout: 5000 });

  // The input field should still be present and usable after an error
  await expect(page.locator('input[name="input"]')).toBeVisible();
});

test('error clears when a new successful query is submitted', async ({ page }) => {
  let callCount = 0;
  await page.route('**/gitlang/github/merged*', (route) => {
    callCount++;
    if (callCount === 1) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ repos: [], langs: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['repo1'], langs: [{ TypeScript: 5000 }] }),
    });
  });

  await page.goto('/');
  const input = page.locator('input[name="input"]');

  // First query — triggers Not Found
  await input.fill('emptyuser');
  await input.press('Enter');
  await expect(page.locator('h4.error', { hasText: 'Not Found' })).toBeVisible({ timeout: 5000 });

  // Second query — should succeed and clear the error
  await input.fill('realuser');
  await input.press('Enter');
  await expect(page.locator('h4.error')).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'TypeScript' })).toBeVisible();
});
