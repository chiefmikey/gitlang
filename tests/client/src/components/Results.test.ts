import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

import Results from '../../../../client/src/components/Results.svelte';

// Progress uses onMount with querySelector for specific IDs and tweened stores.
// We mock Progress to avoid those DOM dependencies in unit tests.
vi.mock('../../../../client/src/components/Progress.svelte', () => ({
  default: {
    name: 'MockProgress',
  },
}));

describe('Results', () => {
  it('shows error message when errorMessage is set', () => {
    render(Results, {
      props: {
        current: 'torvalds',
        data: undefined,
        count1: undefined,
        count2: undefined,
        errorMessage: 'API rate limit reached. Try again in a few minutes.',
        isDone: vi.fn(),
        langBreakdown: undefined,
      },
    });

    expect(
      screen.getByText('API rate limit reached. Try again in a few minutes.'),
    ).toBeInTheDocument();
  });

  it('shows "Not Found" when data is an empty array and there is no error', () => {
    render(Results, {
      props: {
        current: 'unknownuser99999',
        data: [],
        count1: 0,
        count2: 0,
        errorMessage: '',
        isDone: vi.fn(),
        langBreakdown: undefined,
      },
    });

    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('does not render Card when current is falsy', () => {
    render(Results, {
      props: {
        current: '',
        data: undefined,
        count1: undefined,
        count2: undefined,
        errorMessage: '',
        isDone: vi.fn(),
        langBreakdown: undefined,
      },
    });

    // Card renders a link to github.com/<current> — no link means no Card
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders Card (GitHub link) when current is provided', () => {
    render(Results, {
      props: {
        current: 'torvalds',
        data: undefined,
        count1: undefined,
        count2: undefined,
        errorMessage: '',
        isDone: vi.fn(),
        langBreakdown: undefined,
      },
    });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/torvalds');
  });

  it('does not show "Not Found" when errorMessage is set', () => {
    render(Results, {
      props: {
        current: '',
        data: [],
        count1: 0,
        count2: 0,
        errorMessage: 'Some error',
        isDone: vi.fn(),
        langBreakdown: undefined,
      },
    });

    expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
    expect(screen.getByText('Some error')).toBeInTheDocument();
  });
});
