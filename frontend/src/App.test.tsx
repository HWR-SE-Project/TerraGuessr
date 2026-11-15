import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { ApiError } from './api/client';
import { ROUNDS_PER_GAME, createStubGameDataSource } from './api/gameDataSource';
import type { GameDataSource } from './api/gameDataSource';

beforeEach(() => {
  localStorage.clear();
});

function renderApp(dataSource: GameDataSource = createStubGameDataSource()) {
  return render(<App dataSource={dataSource} />);
}

function pickFirstCandidateAndSubmit() {
  const [item] = screen.getAllByTestId('candidate-item');
  if (!item) {
    throw new Error('Expected at least one candidate');
  }
  fireEvent.click(item);
  fireEvent.submit(screen.getByTestId('guess-form'));
}

describe('App solo flow', () => {
  it('starts from the difficulty picker and reveals a round after a guess', async () => {
    renderApp();

    // Home: choose Medium + list mode, then start.
    expect(screen.getByRole('heading', { level: 1, name: /explore the\s*world!/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('difficulty-medium'));
    fireEvent.click(await screen.findByTestId('mode-option-list'));
    fireEvent.click(screen.getByTestId('start-game'));

    // Round appears with weather + list mode candidates.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Round 1' }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('weather-panel')).toBeInTheDocument();
    expect(await screen.findByTestId('candidate-list')).toBeInTheDocument();

    // Submit a guess -> reveal (distance, score, actual location).
    pickFirstCandidateAndSubmit();

    const reveal = await screen.findByTestId('reveal-view');
    expect(within(reveal).getByTestId('reveal-score')).toHaveTextContent(/Score: \d+/);
    expect(within(reveal).getByTestId('reveal-distance')).toHaveTextContent(/Distance: [\d.]+ km/);
    expect(within(reveal).getByTestId('reveal-actual')).toHaveTextContent(
      'Actual location: 48.8566, 2.3522',
    );

    // Not the last round yet -> the player can advance.
    expect(screen.getByTestId('advance')).toHaveTextContent('Next round');
  });

  it('plays all five rounds and shows the final results', async () => {
    renderApp();
    fireEvent.click(screen.getByTestId('start-game'));

    for (let roundNumber = 1; roundNumber <= ROUNDS_PER_GAME; roundNumber += 1) {
      expect(
        await screen.findByRole('heading', { level: 2, name: `Round ${roundNumber}` }),
      ).toBeInTheDocument();

      await screen.findByTestId('candidate-list');
      pickFirstCandidateAndSubmit();
      await screen.findByTestId('reveal-view');

      const advance = screen.getByTestId('advance');
      if (roundNumber < ROUNDS_PER_GAME) {
        expect(advance).toHaveTextContent('Next round');
        fireEvent.click(advance);
      } else {
        expect(advance).toHaveTextContent('See final results');
        fireEvent.click(advance);
      }
    }

    const results = await screen.findByTestId('results-view');
    expect(within(results).getAllByTestId('result-row')).toHaveLength(ROUNDS_PER_GAME);
    expect(within(results).getByTestId('total-score')).not.toBeEmptyDOMElement();
    expect(screen.queryByTestId('guess-form')).not.toBeInTheDocument();
  });

  it('shows a friendly message when the server rejects game creation', async () => {
    const failing: GameDataSource = {
      ...createStubGameDataSource(),
      createGame: async () => {
        throw new ApiError('SERVICE_UNAVAILABLE', 'weather upstream down', 503);
      },
    };
    renderApp(failing);

    fireEvent.click(screen.getByTestId('start-game'));

    const alert = await screen.findByTestId('error-banner');
    expect(alert).toHaveTextContent(/weather service is busy/i);
    expect(screen.getByTestId('start-game')).toBeEnabled();
  });

  it.runIf(import.meta.env.DEV)('falls back to the offline demo when the backend is unreachable', async () => {
    const offline: GameDataSource = {
      ...createStubGameDataSource(),
      createGame: async () => {
        throw new ApiError('NETWORK_ERROR', 'fetch failed', 0);
      },
    };
    renderApp(offline);

    fireEvent.click(screen.getByTestId('start-game'));

    expect(await screen.findByTestId('demo-notice')).toHaveTextContent(/offline demo mode/i);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Round 1' }),
    ).toBeInTheDocument();
  });
});
