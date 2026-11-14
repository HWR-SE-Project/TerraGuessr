// Routed shell placeholder (M0). Feature routes are added by later tasks; this
// task only proves the toolchain (build + Vitest/RTL) is wired.
import { GameStoreProvider } from './state/gameStore';

const shellStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#1c1c1c',
  background: '#f6f5f2',
} as const;

export function App() {
  return (
    <GameStoreProvider>
      <div style={shellStyle}>
        <header style={{ padding: '12px 20px', borderBottom: '1px solid #d9d6d0' }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>TerraGuessr</h1>
        </header>
        <main style={{ flex: 1, padding: '24px 20px' }}>
          <section aria-labelledby="home-heading">
            <h2 id="home-heading" style={{ marginTop: 0 }}>
              Home
            </h2>
            <p>Guess the place from its weather. The first game screen lands here.</p>
          </section>
        </main>
      </div>
    </GameStoreProvider>
  );
}

export default App;
