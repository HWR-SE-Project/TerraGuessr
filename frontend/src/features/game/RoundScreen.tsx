import { useEffect, useReducer, useState } from 'react';
import type { FormEvent } from 'react';
import type { LatLon } from '../../api/types';
import { WeatherPanel } from '../../components/WeatherPanel';
import { CandidateList } from '../list/CandidateList';
import { MapPicker } from '../map/MapPicker';
import { useGameState } from '../../state/gameStore';
import { RevealView } from './RevealView';
import type { RoundDataSource } from './roundDataSource';
import type { RoundAttemptDTO } from './roundDataSource';
import { createInitialRoundState, roundReducer } from './roundReducer';

export interface RoundScreenProps {
  dataSource: RoundDataSource;
  /** Overrides the gameId read from the game store (test/dev seam). */
  gameId?: string;
  onAttemptChange?: (current: number, total: number) => void;
}

export function RoundScreen({ dataSource, gameId, onAttemptChange }: RoundScreenProps) {
  const { gameId: storeGameId } = useGameState();
  const effectiveGameId = gameId ?? storeGameId;
  const [state, dispatch] = useReducer(roundReducer, createInitialRoundState());
  const [guess, setGuess] = useState<LatLon | null>(null);
  const [attemptFeedback, setAttemptFeedback] = useState<RoundAttemptDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'round/loadStarted' });
    void dataSource.startRound(effectiveGameId ?? '').then((round) => {
      if (!cancelled) dispatch({ type: 'round/loaded', round });
      if (!cancelled) onAttemptChange?.(1, round.attemptsTotal);
    }).catch((cause: unknown) => {
      if (!cancelled) dispatch({
        type: 'round/loadFailed',
        message: cause instanceof Error ? cause.message : 'Failed to load round',
      });
    });
    return () => { cancelled = true; };
  }, [dataSource, effectiveGameId, onAttemptChange]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.round || !guess || state.status === 'submitting') return;
    dispatch({ type: 'round/submitStarted' });
    const submittedRound = state.round;
    const submittedGuess = guess;
    const request = submittedRound.attemptsTotal > 1 && dataSource.submitAttempt
      ? dataSource.submitAttempt(submittedRound.roundId, submittedGuess)
      : dataSource.submitGuess(submittedRound.roundId, submittedGuess).then((result) => ({ result }));
    void request.then((response) => {
      if (response.result) {
        dispatch({ type: 'round/submitted', result: response.result });
        return;
      }
      setAttemptFeedback(response as RoundAttemptDTO);
      onAttemptChange?.((response as RoundAttemptDTO).attemptNumber, submittedRound.attemptsTotal);
      setGuess(null);
      dispatch({ type: 'round/loaded', round: submittedRound });
    }).catch((cause: unknown) => {
      dispatch({ type: 'round/submitFailed', message: cause instanceof Error ? cause.message : 'Failed to submit guess' });
    });
  }

  async function finishRound(): Promise<void> {
    if (!state.round || !dataSource.finishRound || state.status === 'submitting') return;
    dispatch({ type: 'round/submitStarted' });
    try {
      const result = await dataSource.finishRound(state.round.roundId);
      dispatch({ type: 'round/submitted', result });
      setAttemptFeedback(null);
    } catch (cause) {
      dispatch({ type: 'round/submitFailed', message: cause instanceof Error ? cause.message : 'Failed to finish round' });
    }
  }

  if (state.status === 'loading') return <div className="tg-game-stage"><h2 className="tg-sr-only">Round 1</h2><div className="tg-selection-panel" role="status">Loading round…</div></div>;
  if (!state.round) return <div className="tg-game-stage"><h2 className="tg-sr-only">Round unavailable</h2><div className="tg-selection-panel tg-error" role="alert">{state.error ?? 'Round unavailable'}</div></div>;

  const revealed = state.status === 'revealed' && state.result !== null;
  const selectedCandidateId = guess === null || !state.round.candidates ? null : state.round.candidates.find(
    (candidate) => candidate.lat === guess.lat && candidate.lon === guess.lon,
  )?.id ?? null;

  return (
    <div className="tg-game-stage" data-testid="round-screen">
      <h2 className="tg-sr-only">Round {state.round.roundNumber}</h2>
      <div className="tg-panorama" aria-hidden="true" />
      <WeatherPanel weather={state.round.weather} />
      {revealed && state.result ? (
        <div className="tg-game-area">
          <RevealView result={state.result} />
        </div>
      ) : attemptFeedback ? (
        <div className="tg-game-area">
          <section className="tg-selection-panel tg-attempt-result" aria-live="polite" data-testid="attempt-result">
            <div className="tg-eyebrow">Attempt {attemptFeedback.attemptNumber} of {attemptFeedback.attemptsTotal}</div>
            <h2>{attemptFeedback.score.toLocaleString()} pts</h2>
            <p>Distance: {attemptFeedback.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</p>
            <p className="tg-muted">The location stays hidden until you finish this round.</p>
            <div className="tg-hero-cta">
              {attemptFeedback.attemptsRemaining > 0 ? <button type="button" className="tg-button tg-button-primary" data-testid="next-attempt" onClick={() => { const next = attemptFeedback.attemptNumber + 1; onAttemptChange?.(next, attemptFeedback.attemptsTotal); setAttemptFeedback(null); }}>Next attempt</button> : null}
              <button type="button" className="tg-button tg-button-secondary" data-testid="finish-round" disabled={state.status === 'submitting'} onClick={() => void finishRound()}>{state.status === 'submitting' ? 'Finishing…' : 'Finish round'}</button>
            </div>
            {state.error ? <p role="alert" className="tg-error">{state.error}</p> : null}
          </section>
        </div>
      ) : state.round.selectionMode === 'map' ? (
        <form className="tg-game-area" onSubmit={handleSubmit} aria-label="Guess submission" data-testid="guess-form">
          <div className="tg-guess-footer">
            <span className="tg-submit-hint">{guess ? 'Marker placed · ready to lock in' : 'Tap the map to place your guess'}</span>
            <button className="tg-button tg-button-primary" type="submit" disabled={!guess || state.status === 'submitting'} data-testid="submit-guess">
              {state.status === 'submitting' ? 'Submitting…' : 'Submit guess'}
            </button>
          </div>
          <div className="tg-map-dock">
            <div className="tg-map-label"><span>◉ World map</span><span>Click to place a marker</span></div>
            <MapPicker guess={guess} onChange={setGuess} zoom={1} />
          </div>
          {state.error ? <p role="alert" className="tg-error">{state.error}</p> : null}
        </form>
      ) : (
        <form className="tg-game-area" onSubmit={handleSubmit} aria-label="Guess submission" data-testid="guess-form">
          <div className="tg-selection-panel">
            <CandidateList
              candidates={state.round.candidates ?? []}
              onChange={setGuess}
              selectedId={selectedCandidateId}
            />
            <div className="tg-submit-row">
              <span className="tg-submit-hint">{guess ? 'Selection locked in when you confirm.' : 'Choose one location to continue.'}</span>
              <button className="tg-button tg-button-primary" type="submit" disabled={!guess || state.status === 'submitting'} data-testid="submit-guess">
                {state.status === 'submitting' ? 'Submitting…' : 'Submit guess'}
              </button>
            </div>
            {state.error ? <p role="alert" className="tg-error">{state.error}</p> : null}
          </div>
        </form>
      )}
    </div>
  );
}

export default RoundScreen;
