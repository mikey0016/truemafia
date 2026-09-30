import { useEffect } from 'react';
import { ROLES } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;
  const yesterday = new Date(today.getTime() - 86400_000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

const WINNER_LABEL: Record<string, string> = {
  TOWN: 'TOWN WON',
  MAFIA: 'MAFIA WON',
  INDEPENDENT: 'CHAOS WON',
};

export function History() {
  const { history, historyLoading, loadHistory } = useGameStore();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="screen">
      <div className="h1">HISTORY</div>

      {historyLoading ? (
        <>
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 64 }} />
        </>
      ) : history.length === 0 ? (
        <div className="empty-state">
          No games yet. Play your first match and it will show up here!
        </div>
      ) : (
        history.map((g) => {
          const role = ROLES[g.role];
          return (
            <div key={g.gameId} className="list-row">
              <div
                className="rank-num"
                style={{ fontSize: '1.3rem' }}
                title={role?.name}
              >
                {g.won ? '✅' : '❌'}
                </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {WINNER_LABEL[g.winner ?? ''] ?? 'FINISHED'} ·{' '}
                  <span style={{ color: role?.color ?? 'inherit' }}>{role?.name ?? g.role}</span>
                </div>
                <div className="label">
                  {formatWhen(g.finishedAt)} · {g.rounds} rounds · {g.alive ? 'survived' : 'died'}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
