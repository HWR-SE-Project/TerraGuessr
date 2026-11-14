import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameStoreProvider } from '../../state/gameStore';
import { RoundScreen } from './RoundScreen';
import { createStubRoundDataSource } from './roundDataSource';

function renderRoundScreen() {
  return render(
    <GameStoreProvider
      initialState={{ gameId: 'game-1', playerToken: null, difficulty: 'easy', mode: 'solo' }}
    >
      <RoundScreen dataSource={createStubRoundDataSource()} />
    </GameStoreProvider>,
  );
}

describe('RoundScreen', () => {
  it('renders the 4 weather fields in the fixed layout', async () => {
    renderRoundScreen();

    expect(await screen.findByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('12.4 °C')).toBeInTheDocument();

    expect(screen.getByText('Precipitation')).toBeInTheDocument();
    expect(screen.getByText('0.8 mm')).toBeInTheDocument();

    expect(screen.getByText('Humidity')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();

    expect(screen.getByText('Wind speed')).toBeInTheDocument();
    expect(screen.getByText('14.3 km/h')).toBeInTheDocument();
  });

  it('reveals score and distance after submit', async () => {
    renderRoundScreen();

    await screen.findByText('Temperature');

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '48.85' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '2.35' } });

    const submit = screen.getByRole('button', { name: 'Submit guess' });
    expect(submit).toBeEnabled();

    fireEvent.submit(screen.getByTestId('guess-form'));

    expect(await screen.findByText('Score: 3225')).toBeInTheDocument();
    expect(screen.getByText('Distance: 877.2 km')).toBeInTheDocument();
    expect(screen.getByText('Actual location: 48.8566, 2.3522')).toBeInTheDocument();
  });
});
