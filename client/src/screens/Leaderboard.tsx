import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';

type Range = 'GLOBAL' | 'WEEKLY' | 'MONTHLY';

export function Leaderboard() {
  const [range, setRange] = useState<Range>('GLOBAL');
  const { leaderboard, leaderboardLoading, loadLeaderboard } = useGameStore();

  useEffect(() => {
    void loadLeaderboard(range);
  }, [range, loadLeaderboard]);

  return (
    <div className="screen">
      <div className="h1">LEADERBOARD</div>
      <div className="tabbar">
        {(['GLOBAL', 'WEEKLY', 'MONTHLY'] as Range[]).map((r) => (
          <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>

      {leaderboardLoading ? (
        <>
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 64 }} />
</>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          No ranked players yet. Play games to appear here!
        </div>
      ) : (
        leaderboard.map((e, i) => (
          <div key={e.userId} className={`list-row rank-${i + 1}`}>
            <div className="rank-num">#{i + 1}</div>
            <Avatar src={e.photoUrl} name={e.username} size="md" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.username}
              </div>
              <div className="label">{e.wins} WINS · {e.games} GAMES</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="gold mono" style={{ fontWeight: 800 }}>{e.rating}</div>
              <div className="label">RATING</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
