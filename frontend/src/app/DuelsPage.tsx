import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { RootOutletContext } from './RootLayout';

const COPY = {
  en: {
    eyebrow: 'Async · no live matchmaking',
    title: 'Duels',
    subtitle: 'Challenge a friend to the exact location you just played, and compare scores on a shared leaderboard.',
    joinLabel: 'Have a duel link or code?',
    joinPlaceholder: 'Paste a challenge link or code',
    joinButton: 'Join duel',
    joinError: 'Enter a challenge link or code first.',
    createTitle: 'Start your own duel',
    createCopy: 'Duels are created from a round you just finished — play a solo expedition, finish any round, then tap "Challenge a friend" on the results screen to get a shareable link.',
    createCta: 'Play a solo expedition',
  },
  de: {
    eyebrow: 'Asynchron · kein Live-Matchmaking',
    title: 'Duelle',
    subtitle: 'Fordere einen Freund für genau den Ort heraus, den du gerade gespielt hast, und vergleicht eure Punkte auf einer gemeinsamen Bestenliste.',
    joinLabel: 'Hast du einen Duell-Link oder Code?',
    joinPlaceholder: 'Duell-Link oder Code einfügen',
    joinButton: 'Duell beitreten',
    joinError: 'Bitte zuerst einen Duell-Link oder Code eingeben.',
    createTitle: 'Starte dein eigenes Duell',
    createCopy: 'Duelle entstehen aus einer gerade beendeten Runde — spiele eine Solo-Expedition, beende eine Runde und tippe auf "Freund herausfordern" im Ergebnis-Bildschirm, um einen teilbaren Link zu erhalten.',
    createCta: 'Solo-Expedition spielen',
  },
};

function extractChallengeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /\/challenge\/([^/?#]+)/.exec(trimmed);
  if (match?.[1]) return decodeURIComponent(match[1]);
  // Bare code (no slashes) — accept as-is.
  if (!trimmed.includes('/')) return trimmed;
  return null;
}

/**
 * Top-level "Duels" destination. TerraGuessr's duel feature is the real,
 * already-shipped async challenge flow (create from a finished round, share
 * a link, join, compare on one leaderboard) — there is no ranked ladder or
 * live matchmaking backend, so this page only exposes what actually exists:
 * joining a duel by code/link, and pointing new players at how to create one.
 */
export function DuelsPage() {
  const { language } = useOutletContext<RootOutletContext>();
  const navigate = useNavigate();
  const copy = COPY[language];
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = extractChallengeId(code);
    if (!id) {
      setError(copy.joinError);
      return;
    }
    setError(null);
    navigate(`/challenge/${encodeURIComponent(id)}`);
  }

  return (
    <main className="tg-main tg-duels-page">
      <section className="tg-panel tg-duels-hero">
        <div className="tg-eyebrow">{copy.eyebrow}</div>
        <h1 className="tg-heading-lg">{copy.title}</h1>
        <p className="tg-muted tg-lead">{copy.subtitle}</p>

        <form className="tg-challenge-join" onSubmit={handleJoin}>
          <label htmlFor="duel-code">{copy.joinLabel}</label>
          <div className="tg-challenge-row">
            <input
              id="duel-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={copy.joinPlaceholder}
              data-testid="duel-code-input"
            />
            <button type="submit" className="tg-button tg-button-primary" data-testid="duel-join-button">{copy.joinButton}</button>
          </div>
          {error ? <p role="alert" className="tg-challenge-error">{error}</p> : null}
        </form>
      </section>

      <section className="tg-panel tg-duels-create">
        <h2 className="tg-heading-md">{copy.createTitle}</h2>
        <p className="tg-muted">{copy.createCopy}</p>
        <Link to="/" className="tg-button tg-button-secondary">{copy.createCta}</Link>
      </section>
    </main>
  );
}

export default DuelsPage;
