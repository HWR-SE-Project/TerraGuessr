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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <h2 id={id} style={{ marginTop: 0 }}>
          How to play
        </h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            data-testid="tutorial-close"
            aria-label="Close how to play"
          >
            Close
          </button>
        ) : null}
      </div>

      <section data-testid="tutorial-mechanics" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>The mechanics</h3>
        <p style={{ marginTop: 0 }}>
          Each round gives you the current weather at a secret place — temperature, conditions and
          wind — but not where it is. Read the weather and guess the location on the globe.
        </p>
        <p style={{ marginTop: 0 }}>
          A solo game is five rounds. You get one guess per round; after you submit it the real
          location is revealed and you move on to the next round.
        </p>
      </section>

      <section data-testid="tutorial-selection-modes" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>Two ways to guess</h3>
        <ul style={{ marginTop: 0 }}>
          <li>
            <strong>Map</strong> — click anywhere on the world map to drop your pin. Best when you
            have a rough idea of the region.
          </li>
          <li>
            <strong>List</strong> — pick one of the offered candidate places from a list. Best when
            you want to compare a few specific cities.
          </li>
        </ul>
        <p style={{ marginTop: 0 }}>
          Easy uses the list, Hard uses the map, and Medium lets you switch between both before
          starting a game.
        </p>
      </section>

      <section data-testid="tutorial-scoring">
        <h3 style={{ marginBottom: '0.25rem' }}>How scoring works</h3>
        <p style={{ marginTop: 0 }}>
          Scoring is distance-based: the closer your guess is to the real location, the higher the
          score. Every kilometre away costs points, and the drop-off is steep at first and flattens
          out for very distant guesses.
        </p>
        <p style={{ marginTop: 0 }}>
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
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
        style={{
          background: '#ffffff',
          color: '#1c1c1c',
          borderRadius: '0.5rem',
          border: '1px solid #d9d6d0',
          padding: '1.25rem 1.5rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <Tutorial headingId={headingId} onClose={onClose} />
      </div>
    </div>
  );
}

export default Tutorial;
