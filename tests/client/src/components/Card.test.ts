import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';

import Card from '../../../../client/src/components/Card.svelte';

describe('Card', () => {
  it('renders a link with the correct GitHub URL', () => {
    render(Card, {
      props: {
        current: 'torvalds',
        data: [],
        count1: 0,
        count2: 0,
      },
    });

    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/torvalds');
    expect(link).toHaveTextContent('torvalds');
  });

  it('shows "Loading..." when data is undefined', () => {
    render(Card, {
      props: {
        current: 'torvalds',
        data: undefined,
        count1: undefined,
        count2: undefined,
      },
    });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows language and repo counts when data has items', () => {
    render(Card, {
      props: {
        current: 'torvalds',
        data: [{ name: 'C', percent: 0.8 }],
        count1: 3,
        count2: 12,
      },
    });

    expect(screen.getByText('Langs: 3')).toBeInTheDocument();
    expect(screen.getByText('Repos: 12')).toBeInTheDocument();
  });

  it('does not show counts when data is an empty array', () => {
    render(Card, {
      props: {
        current: 'torvalds',
        data: [],
        count1: 3,
        count2: 12,
      },
    });

    expect(screen.queryByText(/Langs:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Repos:/)).not.toBeInTheDocument();
  });

  it('does not render the link when current is falsy', () => {
    render(Card, {
      props: {
        current: '',
        data: undefined,
        count1: undefined,
        count2: undefined,
      },
    });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
