import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Vite transform plugin that strips the outer <template>...</template>
 * wrapper from Svelte components that use Svelte 4 syntax.
 *
 * In Svelte 5, <template> is treated as a native HTML element (which is
 * inert in the DOM), so components authored with <template> as the markup
 * root need this wrapper removed before the Svelte compiler sees the file.
 */
const stripSvelteTemplateTag = (): Plugin => ({
  name: 'strip-svelte-template-tag',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('.svelte')) {
      return null;
    }
    // Replace <template> root wrapper with a plain fragment.
    // Only strip when <template> appears as the outermost markup element
    // (i.e., outside of <script> and <style> blocks).
    const stripped = code.replace(
      /(<template[^>]*>)([\s\S]*?)(<\/template>)/,
      '$2',
    );
    if (stripped !== code) {
      return { code: stripped, map: null };
    }
    return null;
  },
});

export default defineConfig({
  plugins: [stripSvelteTemplateTag(), svelte({ hot: false })],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup/vitest.setup.ts'],
    environment: 'jsdom',
    globals: true,
    css: true,
    server: {
      deps: {
        inline: [/svelte/],
      },
    },
  },
});
