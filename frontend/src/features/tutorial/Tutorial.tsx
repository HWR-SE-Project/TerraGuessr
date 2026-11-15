import { useEffect, useId } from 'react';

/**
 * R14 — static "How to play" content. No backend, no state: the same component
 * is used inline (e.g. a docs page) and inside {@link TutorialDialog}.
 *
 * Kept in one place so the copy stays consistent: what a round is, how the two
 * selection modes work, and how the distance-based score is computed.
 */
export interface TutorialProps {
  /** Heading id for aria-labelledby when embedded in a dialog. */
  headingId?: string;
  /** When provided, renders a close button (used by the dialog). */
  onClose?: () => void;
}

/** ADR-0006: score = round(5000 * exp(-distanceKm / 2000)). */
export const MAX_SCORE_PER_ROUND = 5000;

export function Tutorial({ headingId, onClose }: TutorialProps) {
  const generatedId = useId();
  const id = headingId ?? generatedId;

  return (
    <div data-testid="tutorial">
      <div className="tg-tutorial-header">
        <h2 id={id}>
          How to play
        </h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            data-testid="tutorial-close"
            className="tg-button tg-button-quiet"
            aria-label="Close how to play"
          >
            Close
          </button>
        ) : null}
      </div>

      <section data-testid="tutorial-mechanics" className="tg-tutorial-section">
        <h3 className="tg-mb-1">The mechanics</h3>
        <p>
          Each round gives you the current weather at a secret place — temperature, conditions and
          wind — but not where it is. Read the weather and guess the location on the globe.
        </p>
        <p className="tg-mt-2">
          A solo game is five rounds. You get one guess per round; after you submit it the real
          location is revealed and you move on to the next round.
        </p>
      </section>

      <section data-testid="tutorial-selection-modes" className="tg-tutorial-section">
        <h3 className="tg-mb-1">Two ways to guess</h3>
        <ul>
          <li>
            <strong>Map</strong> — click anywhere on the world map to drop your pin. Best when you
            have a rough idea of the region.
          </li>
          <li>
            <strong>List</strong> — pick one of the offered candidate places from a list. Best when
            you want to compare a few specific cities.
          </li>
        </ul>
        <p className="tg-mt-2">
          Easy uses the list, Hard uses the map, and Medium lets you switch between both before
          starting a game.
        </p>
      </section>

      <section data-testid="tutorial-scoring" className="tg-tutorial-section">
        <h3 className="tg-mb-1">How scoring works</h3>
        <p>
          Scoring is distance-based: the closer your guess is to the real location, the higher the
          score. Every kilometre away costs points, and the drop-off is steep at first and flattens
          out for very distant guesses.
        </p>
        <p className="tg-mt-2">
          The formula is <code>score = round(5000 × e^(−distanceKm / 2000))</code>, so a perfect
          guess scores {MAX_SCORE_PER_ROUND} points and a guess 2000 km away scores about 1839.
          Scores are always between 0 and {MAX_SCORE_PER_ROUND} per round, and the five round scores
          add up to your game total.
        </p>
      </section>
    </div>
  );
}

export interface TutorialDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Accessible modal wrapper around {@link Tutorial}: labelled dialog, Escape to
 * close, backdrop click to close, and focus moved to the close button on open.
 */
export function TutorialDialog({ open, onClose }: TutorialDialogProps) {
  const headingId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="tutorial-overlay"
      className="tg-tutorial-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="tutorial-dialog"
        className="tg-tutorial-dialog tg-panel"
      >
        <Tutorial headingId={headingId} onClose={onClose} />
      </div>
    </div>
  );
}

export default Tutorial;
