import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MEDIUM_SELECTION_MODE,
  DifficultyPicker,
  defaultSelection,
  normalizeSelection,
} from './DifficultyPicker';

describe('normalizeSelection (R05)', () => {
  it('forces list mode for Easy', () => {
    expect(normalizeSelection('easy', 'map')).toEqual({ difficulty: 'easy', selectionMode: 'list' });
  });

  it('forces map mode for Hard', () => {
    expect(normalizeSelection('hard', 'list')).toEqual({ difficulty: 'hard', selectionMode: 'map' });
  });

  it('keeps both modes for Medium and defaults to the documented mode', () => {
    expect(normalizeSelection('medium', 'list')).toEqual({
      difficulty: 'medium',
      selectionMode: 'list',
    });
    expect(normalizeSelection('medium', 'map')).toEqual({
      difficulty: 'medium',
      selectionMode: 'map',
    });
    expect(normalizeSelection('medium')).toEqual({
      difficulty: 'medium',
      selectionMode: DEFAULT_MEDIUM_SELECTION_MODE,
    });
  });

  it('defaults to Easy + list', () => {
    expect(defaultSelection()).toEqual({ difficulty: 'easy', selectionMode: 'list' });
  });
});

describe('DifficultyPicker', () => {
  it('renders all three difficulty options with Easy selected and no mode toggle', () => {
    const onChange = vi.fn();
    render(<DifficultyPicker onChange={onChange} />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByTestId('difficulty-easy')).toBeChecked();
    expect(screen.getByTestId('difficulty-medium')).not.toBeChecked();
    expect(screen.getByTestId('difficulty-hard')).not.toBeChecked();

    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('selection-mode-locked')).toHaveTextContent(/list/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selecting Easy forces list mode even when the previous mode was map', () => {
    const onChange = vi.fn();
    render(
      <DifficultyPicker
        defaultValue={{ difficulty: 'hard', selectionMode: 'map' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('difficulty-easy'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'easy', selectionMode: 'list' });
    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('selection-mode-locked')).toHaveTextContent(/list/i);
    expect(screen.getByTestId('difficulty-easy')).toBeChecked();
  });

  it('selecting Hard forces map mode even when the previous mode was list', () => {
    const onChange = vi.fn();
    render(
      <DifficultyPicker
        defaultValue={{ difficulty: 'medium', selectionMode: 'list' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('difficulty-hard'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'hard', selectionMode: 'map' });
    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('selection-mode-locked')).toHaveTextContent(/map/i);
    expect(screen.getByTestId('difficulty-hard')).toBeChecked();
  });

  it('reveals the map/list toggle for Medium and defaults it to map', () => {
    const onChange = vi.fn();
    render(<DifficultyPicker onChange={onChange} />);

    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('difficulty-medium'));

    expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      difficulty: 'medium',
      selectionMode: DEFAULT_MEDIUM_SELECTION_MODE,
    });
    expect(screen.getByTestId('mode-option-map')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mode-option-list')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('selection-mode-locked')).not.toBeInTheDocument();
  });

  it('toggles Medium between map and list and emits each mode', () => {
    const onChange = vi.fn();
    render(<DifficultyPicker onChange={onChange} />);

    fireEvent.click(screen.getByTestId('difficulty-medium'));

    fireEvent.click(screen.getByTestId('mode-option-list'));
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'medium', selectionMode: 'list' });
    expect(screen.getByTestId('mode-option-list')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mode-option-map')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('mode-option-map'));
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'medium', selectionMode: 'map' });
    expect(screen.getByTestId('mode-option-map')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mode-option-list')).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the toggle again when switching from Medium to Easy or Hard', () => {
    const onChange = vi.fn();
    render(<DifficultyPicker onChange={onChange} />);

    fireEvent.click(screen.getByTestId('difficulty-medium'));
    expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('difficulty-easy'));
    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'easy', selectionMode: 'list' });

    fireEvent.click(screen.getByTestId('difficulty-hard'));
    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'hard', selectionMode: 'map' });
  });

  it('reflects a controlled value and normalizes illegal mode/difficulty pairs', () => {
    render(
      <DifficultyPicker
        value={{ difficulty: 'easy', selectionMode: 'map' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('difficulty-easy')).toBeChecked();
    expect(screen.getByTestId('selection-mode-locked')).toHaveTextContent(/list/i);
    expect(screen.queryByTestId('mode-toggle')).not.toBeInTheDocument();
  });

  it('shows the controlled Medium mode in the toggle', () => {
    const onChange = vi.fn();
    render(
      <DifficultyPicker
        value={{ difficulty: 'medium', selectionMode: 'list' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('mode-option-list')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mode-option-map')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('mode-option-map'));
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'medium', selectionMode: 'map' });
  });

  it('disables every control when disabled', () => {
    render(<DifficultyPicker onChange={vi.fn()} disabled />);

    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(screen.getByTestId(`difficulty-${difficulty}`)).toBeDisabled();
    }
  });
});
