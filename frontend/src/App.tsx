import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { GameDataSource } from './api/gameDataSource';
import { AccountRoute } from './app/AccountRoute';
import { AuthRoute } from './app/AuthRoute';
import { ChallengeRoute } from './app/ChallengeRoute';
import { DuelsPage } from './app/DuelsPage';
import { HomePage } from './app/HomePage';
import { PlayerRoute } from './app/PlayerRoute';
import { RootLayout } from './app/RootLayout';
import { GameStoreProvider } from './state/gameStore';

export interface AppProps {
  /** Test seam: inject a deterministic data source. Defaults to the real API. */
  dataSource?: GameDataSource;
}

export function App({ dataSource }: AppProps) {
  return (
    <GameStoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/challenge/:challengeId" element={<ChallengeRoute />} />
          <Route element={<RootLayout />}>
            <Route index element={<HomePage dataSource={dataSource} />} />
            <Route path="duels" element={<DuelsPage />} />
            <Route path="auth" element={<AuthRoute />} />
            <Route path="profile" element={<AccountRoute page="profile" />} />
            <Route path="settings" element={<AccountRoute page="settings" />} />
            <Route path="statistics" element={<PlayerRoute page="statistics" />} />
            <Route path="leaderboard" element={<PlayerRoute page="leaderboard" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GameStoreProvider>
  );
}

export default App;
