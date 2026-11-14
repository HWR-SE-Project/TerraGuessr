import { useEffect, useReducer, useState } from 'react';
import type { FormEvent } from 'react';
import type { LatLon } from '../../api/types';
import { WeatherPanel } from '../../components/WeatherPanel';
import { CandidateList } from '../list/CandidateList';
import { MapPicker } from '../map/MapPicker';
import { useGameState } from '../../state/gameStore';
import { RevealView } from './RevealView';
import { apiRoundDataSource } from './roundDataSource';
import type { RoundDataSource } from './roundDataSource';
import { createInitialRoundState, roundReducer } from './roundReducer';

export interface RoundScreenProps {
  /** Injectable data source (W-02). Defaults to the real API client. */
  dataSource?: RoundDataSource;
  /** Overrides the gameId read from the game store (test/dev seam). */
  gameId?: string;
}

function parseCoordinate(raw: string): number | null {
  if (raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

function isLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

export function RoundScreen({ dataSource = apiRoundDataSource, gameId }: RoundScreenProps) {
  const { gameId: storeGameId } = useGameState();
  const effectiveGameId = gameId ?? storeGameId;

  const [state, dispatch] = useReducer(roundReducer, createInitialRoundState());
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [guess, setGuess] = useState<LatLon | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'round/loadStarted' });
    void dataSource
      .startRound(effectiveGameId ?? '')
      .then((round) => {
        if (!cancelled) {
          dispatch({ type: 'round/loaded', round });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'round/loadFailed',
            message: cause instanceof Error ? cause.message : 'Failed to load round',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, effectiveGameId]);

  // R08 — the guess is client-side state, editable until final submit.
  function syncGuess(nextLat: string, nextLon: string) {
    const lat = parseCoordinate(nextLat);
    const lon = parseCoordinate(nextLon);
    setGuess(
      lat !== null && lon !== null && isLatitude(lat) && isLongitude(lon)
        ? { lat, lon }
        : null,
    );
  }

  function handleLatitudeChange(raw: string) {
    setLatInput(raw);
    syncGuess(raw, lonInput);
  }

  function handleLongitudeChange(raw: string) {
    setLonInput(raw);
    syncGuess(latInput, raw);
  }

  /** MapPicker and CandidateList share this contract: they emit {lat, lon}. */
  function handleGuessPick(next: LatLon) {
    setLatInput(String(next.lat));
    setLonInput(String(next.lon));
    setGuess(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.round || !guess) {
      return;
    }
    dispatch({ type: 'round/submitStarted' });
    try {
      const result = await dataSource.submitGuess(state.round.roundId, guess);
      dispatch({ type: 'round/submitted', result });
    } catch (cause) {
      dispatch({
        type: 'round/submitFailed',
        message: cause instanceof Error ? cause.message : 'Failed to submit guess',
      });
    }
  }

  if (state.status === 'loading') {
    return <p>Loading round...</p>;
  }

  if (!state.round) {
    return <p role="alert">{state.error ?? 'Round unavailable'}</p>;
  }

  const revealed = state.status === 'revealed' && state.result !== null;
  // Reflect a picked candidate as the highlighted item (R07).
  const selectedCandidateId =
    guess === null || !state.round.candidates
      ? null
      : state.round.candidates.find(
          (candidate) => candidate.lat === guess.lat && candidate.lon === guess.lon,
        )?.id ?? null;

  return (
    <section aria-labelledby="round-heading">
      <h2 id="round-heading">Round {state.round.roundNumber}</h2>
      <WeatherPanel weather={state.round.weather} />
      {state.round.selectionMode === 'map' ? (
        <MapPicker guess={guess} onChange={handleGuessPick} />
      ) : (
        <CandidateList
          candidates={state.round.candidates ?? []}
          onChange={handleGuessPick}
          selectedId={selectedCandidateId}
        />
      )}
      {revealed && state.result ? (
        <RevealView result={state.result} />
      ) : (
        <form onSubmit={handleSubmit} aria-label="Guess submission" data-testid="guess-form">
          <div>
            <label htmlFor="guess-latitude">Latitude</label>
            <input
              id="guess-latitude"
              type="number"
              step="any"
              inputMode="decimal"
              value={latInput}
              onChange={(event) => handleLatitudeChange(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="guess-longitude">Longitude</label>
            <input
              id="guess-longitude"
              type="number"
              step="any"
              inputMode="decimal"
              value={lonInput}
              onChange={(event) => handleLongitudeChange(event.target.value)}
            />
          </div>
          <button type="submit" disabled={!guess || state.status === 'submitting'}>
            {state.status === 'submitting' ? 'Submitting...' : 'Submit guess'}
          </button>
          {state.error ? <p role="alert">{state.error}</p> : null}
        </form>
      )}
    </section>
  );
}

export default RoundScreen;
