import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('exports the component module', async () => {
    const mod = await import('../../../../client/src/components/App.svelte');
    expect(mod.default).toBeDefined();
  });
});
