import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';

import Footer from '../../../../client/src/components/Footer.svelte';

describe('Footer', () => {
  it('renders the footer text', () => {
    render(Footer);

    expect(screen.getByText('made by Chief Mikey')).toBeInTheDocument();
  });

  it('link points to the correct URL', () => {
    render(Footer);

    const link = screen.getByRole('link', { name: /made by Chief Mikey/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/chiefmikey');
  });

  it('link opens in a new tab', () => {
    render(Footer);

    const link = screen.getByRole('link', { name: /made by Chief Mikey/i });
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('link has rel="noopener noreferrer"', () => {
    render(Footer);

    const link = screen.getByRole('link', { name: /made by Chief Mikey/i });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
