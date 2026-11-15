// P0-3 regression: a second, independent player opening a shared challenge
// link must be able to join (own token, own round pinned to the same
// location/weather), submit a guess, and see the leaderboard — without any
// of App.tsx's solo-game state or the original creator's token involved.
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameStoreProvider } from '../../state/gameStore';
import { ChallengeJoinFlow } from './ChallengeJoinFlow';
import { createStubChallengeDataSource } from './challengeDataSource';

function renderFlow(dataSource = createStubChallengeDataSource()) {
  return render(
    <GameStoreProvider>
      <ChallengeJoinFlow challengeId="challenge-1" dataSource={dataSource} />
    </GameStoreProvider>,
  );
}

describe('ChallengeJoinFlow', () => {
  it('joins the challenge, plays the pinned round, and hands off to the leaderboard', async () => {
    renderFlow();

    // Joining is asynchronous; the round appears once startChallengeRound resolves.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Round 1' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('weather-panel')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-list')).toBeInTheDocument();

    const [candidate] = screen.getAllByTestId('candidate-item');
    if (!candidate) {
      throw new Error('Expected at least one candidate');
    }
    fireEvent.click(candidate);
    fireEvent.submit(screen.getByTestId('guess-form'));

    // Reveal, then the leaderboard/entry panel takes over (ChallengePanel).
    expect(await screen.findByTestId('reveal-view')).toBeInTheDocument();
    expect(await screen.findByTestId('challenge-panel')).toBeInTheDocument();
    expect(await screen.findAllByTestId('leaderboard-row')).toHaveLength(3);
  });

  it('shows an error when the challenge link is invalid', async () => {
    const failing = createStubChallengeDataSource({
      async startChallengeRound() {
        const { ApiError } = await import('../../api/client');
        throw new ApiError('NOT_FOUND', 'Challenge not found', 404);
      },
    });

    renderFlow(failing);

    expect(await screen.findByTestId('error-banner')).toHaveTextContent(
      /invalid or no longer available/i,
    );
  });
});
