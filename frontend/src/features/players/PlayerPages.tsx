import { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';

type Page = 'statistics' | 'leaderboard';
type Mode = 'solo' | 'multiplayer' | 'ranked' | 'daily';
interface Entry {
  id: string;
  date: string;
  roundNumber: number;
  locationName: string | null;
  actual: { lat: number; lon: number };
  guess: { lat: number; lon: number };
  score: number;
  distanceKm: number;
  createdAt: string;
}
interface Stats {
  available: boolean;
  entries: Entry[];
  total: number;
  offset: number;
  limit: number;
  averageScore: number | null;
  averageDistanceKm: number | null;
}
interface DailyBoard {
  entries: Array<{ rank: number; displayName: string; score: number; distanceKm: number; isCurrentUser: boolean }>;
  total: number;
  offset: number;
  limit: number;
  myRank: number | null;
}

export function PlayerPages({ page, language, onBack }: { page: Page; language: 'en' | 'de'; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>('solo');
  const [stats, setStats] = useState<Stats | null>(null);
  const [offset, setOffset] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [boardMode, setBoardMode] = useState<'daily' | 'ranked'>('daily');
  const [boardOffset, setBoardOffset] = useState(0);
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const de = language === 'de';

  useEffect(() => {
    if (page !== 'statistics') return;
    let cancelled = false;
    setLoading(true); setError(null);
    void apiFetch<Stats>(`/statistics?mode=${mode}&limit=20&offset=${offset}`).then((data) => { if (!cancelled) setStats(data); }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load statistics.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, mode, offset]);

  useEffect(() => {
    if (page !== 'leaderboard') return;
    let cancelled = false;
    setLoading(true); setError(null); setBoard(null);
    const request = boardMode === 'daily'
      ? apiFetch<DailyBoard>(`/daily/${date}/leaderboard?limit=20&offset=${boardOffset}`)
      : apiFetch<never>('/leaderboards/ranked');
    void request.then((data) => { if (!cancelled) setBoard(data as DailyBoard); }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load leaderboard.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, date, boardMode, boardOffset]);

  return (
    <section className="tg-account-page tg-panel tg-player-page" aria-labelledby="player-page-heading">
      <button className="tg-button tg-button-quiet" type="button" onClick={onBack}>← {de ? 'Zurück' : 'Back'}</button>
      <div className="tg-eyebrow tg-mt-6">{page === 'statistics' ? (de ? 'Dein Spielverlauf' : 'Your game history') : (de ? 'TerraGuessr-Ranglisten' : 'TerraGuessr leaderboards')}</div>
      <h1 id="player-page-heading">{page === 'statistics' ? (de ? 'Statistik' : 'Statistics') : (de ? 'Bestenlisten' : 'Leaderboards')}</h1>
      {page === 'statistics' ? <>
        <label className="tg-setup-label">{de ? 'Spielmodus' : 'Game mode'}<select aria-label={de ? 'Spielmodus' : 'Game mode'} value={mode} onChange={(event) => { setMode(event.target.value as Mode); setOffset(0); }}><option value="solo">Solo</option><option value="multiplayer">{de ? 'Mehrspieler' : 'Multiplayer'}</option><option value="ranked">Ranked</option><option value="daily">Daily</option></select></label>
        <div className="tg-stats-summary"><div><span>{de ? 'Durchschnittspunkte' : 'Average score'}</span><strong>{stats?.averageScore?.toLocaleString() ?? '—'}</strong></div><div><span>{de ? 'Durchschnittsdistanz' : 'Average distance'}</span><strong>{stats?.averageDistanceKm === null || stats?.averageDistanceKm === undefined ? '—' : `${stats.averageDistanceKm.toFixed(1)} km`}</strong></div><div><span>{de ? 'Abgeschlossene Runden' : 'Completed rounds'}</span><strong>{stats?.total ?? '—'}</strong></div></div>
        {loading ? <p role="status">{de ? 'Wird geladen…' : 'Loading…'}</p> : null}
        {error ? <p className="tg-auth-error" role="alert">{error}</p> : null}
        {!loading && !error && stats && !stats.available ? <p className="tg-auth-note">{de ? 'Ranked-Spiele und Wertungen sind noch nicht verfügbar.' : 'Ranked games and ratings are not available yet.'}</p> : null}
        {!loading && !error && stats?.available && stats.entries.length === 0 ? <p className="tg-muted">{de ? 'Für diesen Modus gibt es noch keine abgeschlossenen Runden.' : 'No completed rounds for this mode yet.'}</p> : null}
        <div className="tg-player-table-wrap"><table className="tg-player-table"><thead><tr><th>{de ? 'Zeit' : 'Date'}</th><th>{de ? 'Ort' : 'Location'}</th><th>{de ? 'Punkte' : 'Score'}</th><th>{de ? 'Distanz' : 'Distance'}</th><th>{de ? 'Details' : 'Details'}</th></tr></thead><tbody>{stats?.entries.map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString(de ? 'de-DE' : 'en-US')}</td><td>{entry.locationName ?? `${entry.actual.lat.toFixed(2)}, ${entry.actual.lon.toFixed(2)}`}</td><td>{entry.score.toLocaleString()}</td><td>{entry.distanceKm.toFixed(1)} km</td><td><details><summary>{de ? 'Runde' : `Round ${entry.roundNumber}`}</summary><p>{de ? 'Tipp' : 'Guess'}: {entry.guess.lat.toFixed(2)}, {entry.guess.lon.toFixed(2)}</p><p>{de ? 'Lösung' : 'Actual'}: {entry.actual.lat.toFixed(2)}, {entry.actual.lon.toFixed(2)}</p></details></td></tr>)}</tbody></table></div>
        <div className="tg-form-actions"><button className="tg-button tg-button-secondary" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>{de ? 'Zurück' : 'Previous'}</button><span>{stats ? `${stats.total === 0 ? 0 : offset + 1}–${Math.min(offset + 20, stats.total)} / ${stats.total}` : ''}</span><button className="tg-button tg-button-secondary" disabled={loading || !stats || offset + stats.limit >= stats.total} onClick={() => setOffset(offset + 20)}>{de ? 'Weiter' : 'Next'}</button></div>
      </> : <>
        <div className="tg-player-toolbar"><label>{de ? 'Rangliste' : 'Leaderboard'}<select aria-label={de ? 'Rangliste' : 'Leaderboard'} value={boardMode} onChange={(event) => { setBoardMode(event.target.value as 'daily' | 'ranked'); setBoardOffset(0); }}><option value="daily">Daily</option><option value="ranked">Ranked</option></select></label>{boardMode === 'daily' ? <label>{de ? 'UTC-Datum' : 'UTC date'}<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setBoardOffset(0); }} /></label> : null}</div>
        {loading ? <p role="status">{de ? 'Wird geladen…' : 'Loading…'}</p> : null}
        {error ? <p className="tg-auth-error" role="alert">{boardMode === 'ranked' ? (de ? 'Ranked-Matchmaking und Wertungen sind noch nicht verfügbar.' : 'Ranked matchmaking and ratings are not available yet.') : error}</p> : null}
        {boardMode === 'daily' && board ? <><p className="tg-muted">{date} · UTC · {board.total} {de ? 'Teilnehmende' : 'participants'} · {de ? 'Dein Platz' : 'Your placement'}: {board.myRank ? `#${board.myRank}` : (de ? 'noch nicht platziert' : 'not placed yet')}</p><div className="tg-player-table-wrap"><table className="tg-player-table tg-leaderboard-table"><thead><tr><th>#</th><th>{de ? 'Spielername' : 'Player'}</th><th>{de ? 'Punkte' : 'Score'}</th><th>{de ? 'Distanz' : 'Distance'}</th></tr></thead><tbody>{board.entries.map((entry) => <tr key={entry.rank} className={entry.isCurrentUser ? 'tg-current-player' : undefined}><td>{entry.rank}</td><td>{entry.displayName}{entry.isCurrentUser ? ` · ${de ? 'Du' : 'You'}` : ''}</td><td>{entry.score.toLocaleString()}</td><td>{entry.distanceKm.toFixed(1)} km</td></tr>)}</tbody></table></div><div className="tg-form-actions"><button className="tg-button tg-button-secondary" disabled={loading || boardOffset === 0} onClick={() => setBoardOffset(Math.max(0, boardOffset - 20))}>{de ? 'Zurück' : 'Previous'}</button><span>{board.total === 0 ? 0 : boardOffset + 1}–{Math.min(boardOffset + board.entries.length, board.total)} / {board.total}</span><button className="tg-button tg-button-secondary" disabled={loading || boardOffset + board.limit >= board.total} onClick={() => setBoardOffset(boardOffset + 20)}>{de ? 'Weiter' : 'Next'}</button></div></> : null}
      </>}
    </section>
  );
}
