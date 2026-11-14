import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the placeholder home heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'TerraGuessr' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Home' })).toBeInTheDocument();
  });
});
