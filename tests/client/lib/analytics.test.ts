import { afterEach, describe, expect, it, vi } from 'vitest';

import { capture, searchMode } from '../../../client/src/lib/analytics';

describe('capture', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'wolfeTelemetry');
  });

  it('forwards to window.wolfeTelemetry.capture', () => {
    const spy = vi.fn();
    Reflect.set(globalThis, 'wolfeTelemetry', { capture: spy });
    capture('random_clicked', { source: 'x' });

    expect(spy).toHaveBeenCalledWith('random_clicked', { source: 'x' });
  });

  it('is a no-op when the loader is absent', () => {
    expect(() => capture('random_clicked')).not.toThrow();
  });
});

describe('searchMode', () => {
  it.each([
    ['torvalds', 'user'],
    ['torvalds/linux', 'repo'],
    ['torvalds/linux,git', 'multi_repo'],
    ['@vercel', 'org'],
    ['org:vercel', 'org'],
    ['a+b', 'aggregate'],
    ['a b', 'aggregate'],
    ['a~b', 'compare'],
    ['a?b', 'compare'],
    ['torvalds/linux@someone', 'contributor'],
  ])('%s -> %s', (input, mode) => {
    expect(searchMode(input)).toBe(mode);
  });
});
