import { useState } from 'react';
import { DifficultyPicker } from '../difficulty';
import type { DifficultySelection } from '../difficulty';

interface GameSetupProps {
  initialSelection: DifficultySelection;
  initialRoundsTotal: number;
  language: 'en' | 'de';
  loading: boolean;
  onBack: () => void;
  onStart: (selection: DifficultySelection, roundsTotal: number) => void;
}

export function GameSetup({ initialSelection, initialRoundsTotal, language, loading, onBack, onStart }: GameSetupProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [roundsTotal, setRoundsTotal] = useState(initialRoundsTotal);
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
        <div className="tg-setup-round-label"><h2>{de ? 'Runden' : 'Rounds'}</h2><output htmlFor="round-count">{roundsTotal}</output></div>
        <input className="tg-range" id="round-count" aria-label={de ? 'Anzahl Runden' : 'Number of rounds'} type="range" min="1" max="20" step="1" value={roundsTotal} disabled={loading} onChange={(event) => setRoundsTotal(Number(event.target.value))} />
        <div className="tg-range-ends"><span>1</span><span>20</span></div>
      </div>
      <button type="button" className="tg-button tg-button-primary" disabled={loading} onClick={() => onStart(selection, roundsTotal)}>{loading ? (de ? 'Wird vorbereitet…' : 'Preparing…') : (de ? 'Solo-Spiel starten' : 'Start solo game')}</button>
    </section>
  );
}
