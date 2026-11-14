import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChallengePanel } from './ChallengePanel';
import { createStubChallengeDataSource } from './challengeDataSource';

describe('ChallengePanel', () => {
  it('creates a challenge and renders the share URL plus leaderboard rows', async () => {
    render(<ChallengePanel roundId="round-1" dataSource={createStubChallengeDataSource()} />);

    fireEvent.click(screen.getByTestId('create-challenge'));

    expect(await screen.findByTestId('share-url')).toHaveValue(
      'https://terraguessr.example/c/stub-challenge-1',
    );

    const rows = await screen.findAllByTestId('leaderboard-row');
    expect(rows).toHaveLength(3);

    const [firstRow] = rows;
    if (!firstRow) {
      throw new Error('Expected at least one leaderboard row');
    }
    expect(firstRow).toHaveTextContent('Ada');
    expect(firstRow).toHaveTextContent('4800');
    expect(firstRow).toHaveTextContent('12.4 km');

    // Anonymous entries (displayName: null) get a readable fallback label.
    const anonymousRow = rows[2];
    if (!anonymousRow) {
      throw new Error('Expected an anonymous leaderboard row');
    }
    expect(anonymousRow).toHaveTextContent('Anonymous');
  });

  it('joins the challenge with a display name and shows the assigned rank', async () => {
    render(
      <ChallengePanel
        roundId="round-1"
        resultId="result-1"
        dataSource={createStubChallengeDataSource()}
      />,
    );

    fireEvent.click(screen.getByTestId('create-challenge'));
    await screen.findByTestId('share-url');
    await screen.findAllByTestId('leaderboard-row');

    fireEvent.change(screen.getByTestId('display-name'), { target: { value: 'Max' } });
    fireEvent.click(screen.getByTestId('join-challenge'));

    expect(await screen.findByTestId('join-result')).toHaveTextContent('You are ranked #4');

    // The leaderboard re-fetches after a successful join, so wait for the new row.
    expect(await screen.findByText('Max')).toBeInTheDocument();
    const rows = screen.getAllByTestId('leaderboard-row');
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveTextContent('Max');
  });
});
