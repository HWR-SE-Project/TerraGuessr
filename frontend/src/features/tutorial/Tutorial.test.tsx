import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { createStubGameDataSource } from '../../api/gameDataSource';
import { Tutorial, TutorialDialog } from './Tutorial';

beforeEach(() => {
  localStorage.clear();
});

describe('Tutorial (R14)', () => {
  it('explains the mechanics, the selection modes and distance-based scoring', () => {
    render(<Tutorial />);

    expect(screen.getByRole('heading', { name: 'How to play' })).toBeInTheDocument();

    const mechanics = screen.getByTestId('tutorial-mechanics');
    expect(mechanics).toHaveTextContent(/weather/i);
    expect(mechanics).toHaveTextContent(/guess the location/i);
    expect(mechanics).toHaveTextContent(/five rounds/i);

    const modes = screen.getByTestId('tutorial-selection-modes');
    expect(modes).toHaveTextContent(/map/i);
    expect(modes).toHaveTextContent(/list/i);
    expect(modes).toHaveTextContent(/easy/i);
    expect(modes).toHaveTextContent(/hard/i);
    expect(modes).toHaveTextContent(/medium/i);

    const scoring = screen.getByTestId('tutorial-scoring');
    expect(scoring).toHaveTextContent(/distance-based/i);
    expect(scoring).toHaveTextContent(/closer/i);
    expect(scoring).toHaveTextContent(/5000/);
  });

  it('renders no close button when used inline', () => {
    render(<Tutorial />);
    expect(screen.queryByTestId('tutorial-close')).not.toBeInTheDocument();
  });

  it('only mounts the dialog while open and closes on Escape, backdrop and close button', () => {
    const onClose = vi.fn();
    const { rerender } = render(<TutorialDialog open={false} onClose={onClose} />);
    expect(screen.queryByTestId('tutorial-dialog')).not.toBeInTheDocument();

    rerender(<TutorialDialog open onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: 'How to play' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByTestId('tutorial-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('tutorial-close'));
    expect(onClose).toHaveBeenCalledTimes(3);

    // Closing is the parent's call: the dialog stays mounted until open flips.
    expect(screen.getByTestId('tutorial-dialog')).toBeInTheDocument();
    rerender(<TutorialDialog open={false} onClose={onClose} />);
    expect(screen.queryByTestId('tutorial-dialog')).not.toBeInTheDocument();
  });
});

describe('App home -> How to play', () => {
  it('opens the tutorial from the home screen and closes it again', () => {
    render(<App dataSource={createStubGameDataSource()} />);

    expect(screen.queryByTestId('tutorial-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('how-to-play'));

    const dialog = screen.getByTestId('tutorial-dialog');
    expect(within(dialog).getByRole('heading', { name: 'How to play' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('tutorial-mechanics')).toBeInTheDocument();
    expect(within(dialog).getByTestId('tutorial-selection-modes')).toBeInTheDocument();
    expect(within(dialog).getByTestId('tutorial-scoring')).toHaveTextContent(/closer/i);

    fireEvent.click(within(dialog).getByTestId('tutorial-close'));
    expect(screen.queryByTestId('tutorial-dialog')).not.toBeInTheDocument();

    // The home screen is still usable after closing the tutorial.
    expect(screen.getByTestId('start-game')).toBeEnabled();
  });
});
