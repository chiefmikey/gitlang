import fs from 'node:fs';
import path from 'node:path';

import { test as base } from '@playwright/test';

const NYC_OUTPUT = path.resolve('.nyc_output');

/**
 * Extended Playwright test that collects Istanbul coverage from the browser
 * after each test. Requires the app to be built with COVERAGE=true so that
 * babel-plugin-istanbul instruments the code and exposes window.__coverage__.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);

    // Collect coverage deposited by babel-plugin-istanbul
    const coverage = await page
      .evaluate(() => (window as any).__coverage__)
      .catch(() => undefined);

    if (coverage) {
      if (!fs.existsSync(NYC_OUTPUT)) {
        fs.mkdirSync(NYC_OUTPUT, { recursive: true });
      }
      const fileName = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
      fs.writeFileSync(
        path.join(NYC_OUTPUT, fileName),
        JSON.stringify(coverage),
      );
    }
  },
});

export { expect } from '@playwright/test';
