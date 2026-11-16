import { useParams } from 'react-router-dom';
import { ChallengeJoinFlow } from '../features/challenge';

/**
 * P0-3: a shared-link challenge recipient is an independent participant, not
 * the original creator — this route intentionally renders outside the main
 * app nav/session chrome (its own minimal brand header only) and never
 * touches the visiting browser's own game/token state.
 */
export function ChallengeRoute() {
  const { challengeId } = useParams<{ challengeId: string }>();

  if (!challengeId) {
    return null;
  }

  return (
    <div className="tg-shell">
      <header className="tg-topbar">
        <a className="tg-brand" href="/">
          <span className="tg-brand-mark" aria-hidden="true">⌖</span>
          <span className="tg-brand-name">Terra<span>Guessr</span></span>
        </a>
      </header>
      <main className="tg-main">
        <ChallengeJoinFlow challengeId={challengeId} />
      </main>
    </div>
  );
}

export default ChallengeRoute;
