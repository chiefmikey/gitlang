import { test, expect } from './coverage-fixture';

// The random button picks from RANDOM_USERS list (torvalds, gaearon, sindresorhus, etc.)
// and calls submit() with that username. It always hits the /merged endpoint.

test('random button loads a random user and shows language bars', async ({ page }) => {
  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['repo1'], langs: [{ Rust: 7000 }] }),
    }),
  );

  await page.goto('/');
  await page.locator('button.random-btn').click();

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.name span', { hasText: 'Rust' })).toBeVisible();
});

test('random button updates the URL to the selected user', async ({ page }) => {
  const knownUsers = [
    'torvalds', 'gaearon', 'sindresorhus', 'tj', 'mrdoob',
    'antirez', 'jakubroztocil', 'jessfraz', 'ThePrimeagen', 'tpope',
    'mitchellh', 'fatih', 'BurntSushi', 'dtolnay', 'matklad',
    'wez', 'sharkdp', 'ogham', 'JakeWharton', 'yyx990803',
    'Rich-Harris', 'getify', 'mpj', 'kentcdodds', 'chrisbiscardi',
    'wesbos', 'benawad', 'rwieruch', 'bradtraversy', 'florinpop17',
  ];

  await page.route('**/gitlang/github/merged*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['repo1'], langs: [{ C: 9000 }] }),
    }),
  );

  await page.goto('/');
  await page.locator('button.random-btn').click();

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });

  // URL path should be one of the known random users (case-insensitive path match)
  const urlPath = new URL(page.url()).pathname.slice(1).toLowerCase();
  const knownLower = knownUsers.map((u) => u.toLowerCase());
  expect(knownLower).toContain(urlPath);
});

test('random button calls merged endpoint with a username param', async ({ page }) => {
  let capturedUsername: string | null = null;

  await page.route('**/gitlang/github/merged*', (route) => {
    const url = new URL(route.request().url());
    capturedUsername = url.searchParams.get('username');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repos: ['r'], langs: [{ Python: 4000 }] }),
    });
  });

  await page.goto('/');
  await page.locator('button.random-btn').click();

  await expect(page.locator('.bar-row').first()).toBeVisible({ timeout: 5000 });

  expect(capturedUsername).not.toBeNull();
  expect(capturedUsername!.length).toBeGreaterThan(0);
});
