import { useState } from 'react';
import { DifficultyPicker } from '../difficulty';
import type { DifficultySelection } from '../difficulty';
import type { AdditionalDataUnlockMode } from '../../api/types';

interface GameSetupProps {
  initialSelection: DifficultySelection;
  initialRoundsTotal: number;
  initialAttemptsPerRound: number;
  initialGeography: 'world' | 'AFRICA' | 'EUROPE' | 'ASIA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA';
  initialCandidateCount?: number;
  initialAdditionalDataUnlockMode: AdditionalDataUnlockMode;
  initialAdditionalDataUnlockCost?: number;
  language: 'en' | 'de';
  loading: boolean;
  onBack: () => void;
  onStart: (selection: DifficultySelection, roundsTotal: number, geography: GameSetupProps['initialGeography'], candidateCount?: number, attemptsPerRound?: number, unlockMode?: AdditionalDataUnlockMode, unlockCost?: number) => void;
}

export function GameSetup({ initialSelection, initialRoundsTotal, initialAttemptsPerRound, initialGeography, initialCandidateCount, initialAdditionalDataUnlockMode, initialAdditionalDataUnlockCost, language, loading, onBack, onStart }: GameSetupProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [roundsTotal, setRoundsTotal] = useState(initialRoundsTotal);
  const [attemptsPerRound, setAttemptsPerRound] = useState(initialAttemptsPerRound);
  const [geography, setGeography] = useState<GameSetupProps['initialGeography']>(initialGeography);
  const [customizeCandidateCount, setCustomizeCandidateCount] = useState(initialCandidateCount !== undefined);
  const [candidateCount, setCandidateCount] = useState(initialCandidateCount ?? 4);
  const [unlockMode, setUnlockMode] = useState<AdditionalDataUnlockMode>(initialAdditionalDataUnlockMode);
  const [unlockCost, setUnlockCost] = useState(initialAdditionalDataUnlockCost ?? (initialAdditionalDataUnlockMode === 'time' ? 30 : 500));
  const de = language === 'de';
  return (
    <section className="tg-setup tg-panel" aria-labelledby="setup-heading">
      <button type="button" className="tg-button tg-button-quiet" onClick={onBack}>← {de ? 'Zurück' : 'Back'}</button>
      <div className="tg-eyebrow tg-mt-6">{de ? 'Deine Runde, deine Regeln' : 'Your session, your rules'}</div>
      <h1 id="setup-heading">{de ? 'Spiel einrichten' : 'Game setup'}</h1>
      <p className="tg-muted">{de ? 'Wähle den Schwierigkeitsgrad und die Länge deiner Solo-Expedition.' : 'Choose the difficulty and length of your solo expedition.'}</p>

      <div className="tg-setup-mode tg-setup-mode-row" aria-label={de ? 'Spielmodus' : 'Game mode'}><span className="tg-dot" />{de ? 'Solo-Expedition' : 'Solo expedition'}<small>{de ? 'Einzelspieler' : 'Single player'}</small></div>

      <div className="tg-setup-group-label">{de ? 'Deine Wahl' : 'Your choices'}</div>
      <div className="tg-setup-section"><DifficultyPicker value={selection} onChange={setSelection} disabled={loading} legend={de ? 'Schwierigkeit' : 'Difficulty'} /></div>
      <div className="tg-setup-section">
        <h2>{de ? 'Geografie' : 'Geography'}</h2>
        <label className="tg-setup-label">{de ? 'Gebiet' : 'Area'}
          <select aria-label={de ? 'Gebiet' : 'Area'} value={geography} disabled={loading} onChange={(event) => setGeography(event.target.value as GameSetupProps['initialGeography'])}>
            <option value="world">{de ? 'Ganze Welt' : 'Entire world'}</option>
            <option value="AFRICA">{de ? 'Afrika' : 'Africa'}</option><option value="EUROPE">{de ? 'Europa' : 'Europe'}</option><option value="ASIA">{de ? 'Asien' : 'Asia'}</option>
            <option value="NORTH_AMERICA">{de ? 'Nordamerika' : 'North America'}</option><option value="SOUTH_AMERICA">{de ? 'Südamerika' : 'South America'}</option><option value="OCEANIA">{de ? 'Ozeanien' : 'Oceania'}</option>
          </select>
        </label>
        <p className="tg-muted tg-setup-note">{de ? 'Länderauswahl ist noch nicht verfügbar, da der Ortskatalog keine verlässlichen Länderkennungen enthält.' : 'Country selection is not available yet because the current location catalog has no verified country identifiers.'}</p>
      </div>
      <div className="tg-setup-section">
        <div className="tg-setup-round-label"><h2>{de ? 'Runden' : 'Rounds'}</h2><output htmlFor="round-count">{roundsTotal}</output></div>
        <input className="tg-range" id="round-count" aria-label={de ? 'Anzahl Runden' : 'Number of rounds'} type="range" min="1" max="20" step="1" value={roundsTotal} disabled={loading} onChange={(event) => setRoundsTotal(Number(event.target.value))} />
        <div className="tg-range-ends"><span>1</span><span>20</span></div>
      </div>

      <details className="tg-setup-advanced" open>
        <summary>{de ? 'Erweiterte Optionen' : 'Advanced options'}</summary>
        <div className="tg-setup-advanced-body">
          <div className="tg-setup-section">
            <div className="tg-setup-round-label"><h2>{de ? 'Versuche pro Runde' : 'Attempts per round'}</h2><output htmlFor="attempt-count">{attemptsPerRound}</output></div>
            <input className="tg-range" id="attempt-count" aria-label={de ? 'Versuche pro Runde' : 'Attempts per round'} type="range" min="1" max="5" step="1" value={attemptsPerRound} disabled={loading} onChange={(event) => setAttemptsPerRound(Number(event.target.value))} />
            <div className="tg-range-ends"><span>1</span><span>5</span></div>
            <p className="tg-muted tg-setup-note">{de ? 'Zwischenergebnisse zeigen Distanz und Punkte. Die Lösung erscheint erst beim Beenden der Runde.' : 'Intermediate feedback shows distance and points. The location is revealed when you finish the round.'}</p>
          </div>
          {selection.selectionMode === 'list' ? <div className="tg-setup-section">
            <label className="tg-setup-checkbox"><input type="checkbox" checked={customizeCandidateCount} disabled={loading} onChange={(event) => setCustomizeCandidateCount(event.target.checked)} />{de ? 'Antwortmöglichkeiten anpassen' : 'Customize answer choices'}</label>
            {customizeCandidateCount ? <label className="tg-setup-label tg-mt-3">{de ? 'Anzahl Optionen' : 'Number of choices'}<select aria-label={de ? 'Anzahl Optionen' : 'Number of choices'} value={candidateCount} disabled={loading} onChange={(event) => setCandidateCount(Number(event.target.value))}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label> : null}
          </div> : null}

          <details className="tg-setup-subsection">
            <summary>{de ? 'Zusatzhinweise freischalten' : 'Unlock additional clues'}</summary>
            <label className="tg-setup-label">{de ? 'Freischaltregel' : 'Unlock rule'}
              <select aria-label={de ? 'Freischaltregel' : 'Unlock rule'} value={unlockMode} disabled={loading} onChange={(event) => setUnlockMode(event.target.value as AdditionalDataUnlockMode)}>
                <option value="immediate">{de ? 'Sofort verfügbar' : 'Available immediately'}</option>
                <option value="time">{de ? 'Wartezeit' : 'Wait to unlock'}</option>
                <option value="points">{de ? 'Punkte bezahlen' : 'Spend points'}</option>
              </select>
            </label>
            {unlockMode === 'time' ? <>
              <div className="tg-setup-round-label tg-mt-3"><label htmlFor="unlock-cost-time">{de ? 'Wartezeit (Sekunden)' : 'Wait time (seconds)'}</label><output>{unlockCost}s</output></div>
              <input className="tg-range" id="unlock-cost-time" aria-label={de ? 'Wartezeit (Sekunden)' : 'Wait time (seconds)'} type="range" min="10" max="60" step="1" value={unlockCost} disabled={loading} onChange={(event) => setUnlockCost(Number(event.target.value))} />
              <div className="tg-range-ends"><span>10 s</span><span>60 s</span></div>
              <p className="tg-muted tg-setup-note">{de ? 'Zusatzhinweise werden nach Ablauf der Wartezeit freigeschaltet. Der Server prüft die Zeit.' : 'Additional clues unlock after the wait. The server enforces the timer.'}</p>
            </> : null}
            {unlockMode === 'points' ? <>
              <div className="tg-setup-round-label tg-mt-3"><label htmlFor="unlock-cost-points">{de ? 'Punktekosten' : 'Point cost'}</label><output>{unlockCost.toLocaleString()}</output></div>
              <input className="tg-range" id="unlock-cost-points" aria-label={de ? 'Punktekosten' : 'Point cost'} type="range" min="100" max="4000" step="100" value={unlockCost} disabled={loading} onChange={(event) => setUnlockCost(Number(event.target.value))} />
              <div className="tg-range-ends"><span>100</span><span>4,000</span></div>
              <p className="tg-muted tg-setup-note">{de ? 'Die Kosten werden einmalig vom Rundenergebnis abgezogen.' : 'The cost is deducted once from this round’s score.'}</p>
            </> : null}
          </details>
        </div>
      </details>

      <button type="button" className="tg-button tg-button-primary tg-mt-6" disabled={loading} onClick={() => onStart(selection, roundsTotal, geography, customizeCandidateCount && selection.selectionMode === 'list' ? candidateCount : undefined, attemptsPerRound, unlockMode, unlockMode === 'immediate' ? undefined : unlockCost)}>{loading ? (de ? 'Wird vorbereitet…' : 'Preparing…') : (de ? 'Solo-Spiel starten' : 'Start solo game')}</button>
    </section>
  );
}
