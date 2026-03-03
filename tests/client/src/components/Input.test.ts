import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

import Input from '../../../../client/src/components/Input.svelte';

describe('Input', () => {
  it('renders the text input with placeholder text', () => {
    render(Input, {
      props: {
        input: '',
        randomize: vi.fn(),
        submit: vi.fn(),
      },
    });

    const inputEl = screen.getByRole('textbox');
    expect(inputEl).toBeInTheDocument();
    expect(inputEl).toHaveAttribute(
      'placeholder',
      '[ user/repo ] [ user ? user ] [ repo@author ]',
    );
  });

  it('renders the Submit button', () => {
    render(Input, {
      props: {
        input: '',
        randomize: vi.fn(),
        submit: vi.fn(),
      },
    });

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders the random button', () => {
    render(Input, {
      props: {
        input: '',
        randomize: vi.fn(),
        submit: vi.fn(),
      },
    });

    expect(
      screen.getByRole('button', { name: /random/i }),
    ).toBeInTheDocument();
  });

  it('calls submit handler when Submit button is clicked', async () => {
    const submitFn = vi.fn();
    render(Input, {
      props: {
        input: 'torvalds',
        randomize: vi.fn(),
        submit: submitFn,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(submitFn).toHaveBeenCalledOnce();
  });

  it('calls randomize handler when random button is clicked', async () => {
    const randomizeFn = vi.fn();
    render(Input, {
      props: {
        input: '',
        randomize: randomizeFn,
        submit: vi.fn(),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: /random/i }));
    expect(randomizeFn).toHaveBeenCalledOnce();
  });

  it('calls submit handler when Enter is pressed inside the text input', async () => {
    const submitFn = vi.fn();
    render(Input, {
      props: {
        input: 'torvalds',
        randomize: vi.fn(),
        submit: submitFn,
      },
    });

    const inputEl = screen.getByRole('textbox');
    await fireEvent.keyDown(inputEl, { key: 'Enter' });
    expect(submitFn).toHaveBeenCalledOnce();
  });
});
