import { useNavigate, useOutletContext } from 'react-router-dom';
import { PlayerPages } from '../features/players/PlayerPages';
import type { RootOutletContext } from './RootLayout';

export function PlayerRoute({ page }: { page: 'statistics' | 'leaderboard' }) {
  const navigate = useNavigate();
  const { language } = useOutletContext<RootOutletContext>();

  return (
    <main className="tg-main">
      <PlayerPages page={page} language={language} onBack={() => navigate('/')} />
    </main>
  );
}

export default PlayerRoute;
