import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';

import ScrollTop from '../../../../client/src/components/ScrollTop.svelte';

describe('ScrollTop', () => {
  beforeEach(() => {
    // onMount queries for '.scroll-top' to set its animation style.
    // jsdom returns null for querySelector unless we provide the element,
    // but the element is rendered into a detached container. We stub
    // querySelector to return an object with a settable style property so
    // the onMount callback does not throw.
    const styleHolder: { style: string } = { style: '' };
    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '.scroll-top') {
        return styleHolder as unknown as Element;
      }
      return null;
    });
  });

  it('renders "[ top ]" text', () => {
    render(ScrollTop);

    expect(screen.getByText(/\[\s*top\s*\]/i)).toBeInTheDocument();
  });

  it('has a button element', () => {
    render(ScrollTop);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('the button contains the "[ top ]" label', () => {
    render(ScrollTop);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(/\[\s*top\s*\]/i);
  });
});
