import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, NavItem, StatusPill, Surface, TextField } from '..';

describe('New UI primitives', () => {
  it('renders a button with variant and click behavior', async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick}>Launch</Button>);
    const button = screen.getByRole('button', { name: 'Launch' });
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(button.className).toContain('gt-button');
  });

  it('renders a surface as a semantic region when labelled', () => {
    render(<Surface aria-label="Profile panel">Profile</Surface>);
    expect(screen.getByRole('region', { name: 'Profile panel' })).toBeVisible();
  });

  it('renders a text field with a label', () => {
    render(<TextField label="Search" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Search')).toBeVisible();
  });

  it('renders a nav item with active state', () => {
    render(<NavItem active label="Friends" />);
    expect(screen.getByText('Friends')).toBeVisible();
    expect(screen.getByText('Friends').closest('.gt-nav-item')).toHaveAttribute('data-active', 'true');
  });

  it('renders a status pill', () => {
    render(<StatusPill tone="success">Online</StatusPill>);
    expect(screen.getByText('Online')).toBeVisible();
  });
});
