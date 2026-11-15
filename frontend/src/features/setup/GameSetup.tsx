import { useState } from 'react';
import { DifficultyPicker } from '../difficulty';
import type { DifficultySelection } from '../difficulty';

interface GameSetupProps {
  initialSelection: DifficultySelection;
  initialRoundsTotal: number;
  initialAttemptsPerRound: number;
  initialGeography: 'world' | 'AFRICA' | 'EUROPE' | 'ASIA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA';
  initialCandidateCount?: number;
  language: 'en' | 'de';
  loading: boolean;
  onBack: () => void;
  onStart: (selection: DifficultySelection, roundsTotal: number, geography: GameSetupProps['initialGeography'], candidateCount?: number, attemptsPerRound?: number) => void;
}

export function GameSetup({ initialSelection, initialRoundsTotal, initialAttemptsPerRound, initialGeography, initialCandidateCount, language, loading, onBack, onStart }: GameSetupProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [roundsTotal, setRoundsTotal] = useState(initialRoundsTotal);
  const [attemptsPerRound, setAttemptsPerRound] = useState(initialAttemptsPerRound);
  const [geography, setGeography] = useState<GameSetupProps['initialGeography']>(initialGeography);
  const [customizeCandidateCount, setCustomizeCandidateCount] = useState(initialCandidateCount !== undefined);
  const [candidateCount, setCandidateCount] = useState(initialCandidateCount ?? 4);
  const de = language === 'de';
  return (
    <section className="tg-setup tg-panel" aria-labelledby="setup-heading">
      <button type="button" className="tg-button tg-button-quiet" onClick={onBack}>← {de ? 'Zurück' : 'Back'}</button>
      <div className="tg-eyebrow" style={{ marginTop: 24 }}>{de ? 'Deine Runde, deine Regeln' : 'Your session, your rules'}</div>
      <h1 id="setup-heading">{de ? 'Spiel einrichten' : 'Game setup'}</h1>
      <p className="tg-muted">{de ? 'Wähle den Schwierigkeitsgrad und die Länge deiner Solo-Expedition.' : 'Choose the difficulty and length of your solo expedition.'}</p>
      <div className="tg-setup-section">
        <h2>{de ? 'Modus' : 'Mode'}</h2>
        <div className="tg-setup-mode" aria-label={de ? 'Spielmodus' : 'Game mode'}><span className="tg-dot" />{de ? 'Solo-Expedition' : 'Solo expedition'}<small>{de ? 'Einzelspieler' : 'Single player'}</small></div>
        <p className="tg-muted tg-setup-note">{de ? 'Live-Mehrspieler-Räume werden verfügbar, sobald die Synchronisierung serverseitig fertig ist.' : 'Live multiplayer rooms will be available after their server synchronization is implemented.'}</p>
      </div>
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
      {selection.selectionMode === 'list' ? <div className="tg-setup-section">
        <label className="tg-setup-checkbox"><input type="checkbox" checked={customizeCandidateCount} disabled={loading} onChange={(event) => setCustomizeCandidateCount(event.target.checked)} />{de ? 'Antwortmöglichkeiten anpassen' : 'Customize answer choices'}</label>
        {customizeCandidateCount ? <label className="tg-setup-label" style={{ marginTop: 12 }}>{de ? 'Anzahl Optionen' : 'Number of choices'}<select aria-label={de ? 'Anzahl Optionen' : 'Number of choices'} value={candidateCount} disabled={loading} onChange={(event) => setCandidateCount(Number(event.target.value))}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label> : null}
      </div> : null}
      <div className="tg-setup-section">
        <div className="tg-setup-round-label"><h2>{de ? 'Runden' : 'Rounds'}</h2><output htmlFor="round-count">{roundsTotal}</output></div>
        <input className="tg-range" id="round-count" aria-label={de ? 'Anzahl Runden' : 'Number of rounds'} type="range" min="1" max="20" step="1" value={roundsTotal} disabled={loading} onChange={(event) => setRoundsTotal(Number(event.target.value))} />
        <div className="tg-range-ends"><span>1</span><span>20</span></div>
      </div>
      <div className="tg-setup-section">
        <div className="tg-setup-round-label"><h2>{de ? 'Versuche pro Runde' : 'Attempts per round'}</h2><output htmlFor="attempt-count">{attemptsPerRound}</output></div>
        <input className="tg-range" id="attempt-count" aria-label={de ? 'Versuche pro Runde' : 'Attempts per round'} type="range" min="1" max="5" step="1" value={attemptsPerRound} disabled={loading} onChange={(event) => setAttemptsPerRound(Number(event.target.value))} />
        <div className="tg-range-ends"><span>1</span><span>5</span></div>
        <p className="tg-muted tg-setup-note">{de ? 'Zwischenergebnisse zeigen Distanz und Punkte. Die Lösung erscheint erst beim Beenden der Runde.' : 'Intermediate feedback shows distance and points. The location is revealed when you finish the round.'}</p>
      </div>
      <button type="button" className="tg-button tg-button-primary" disabled={loading} onClick={() => onStart(selection, roundsTotal, geography, customizeCandidateCount && selection.selectionMode === 'list' ? candidateCount : undefined, attemptsPerRound)}>{loading ? (de ? 'Wird vorbereitet…' : 'Preparing…') : (de ? 'Solo-Spiel starten' : 'Start solo game')}</button>
    </section>
  );
}
