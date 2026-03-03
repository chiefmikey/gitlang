import { describe, it, expect } from 'vitest';

describe('Progress', () => {
  it('exports the component module', async () => {
    const mod = await import(
      '../../../../client/src/components/Progress.svelte'
    );
    expect(mod.default).toBeDefined();
  });
});
