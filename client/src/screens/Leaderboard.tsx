import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';

type Range = 'GLOBAL' | 'WEEKLY' | 'MONTHLY';

export function Leaderboard() {
  const [range, setRange] = useState<Range>('GLOBAL');
  const { leaderboard, leaderboardLoading, loadLeaderboard } = useGameStore();

  useEffect(() => {
    void loadLeaderboard(range);
  }, [range, loadLeaderboard]);

  return (
    <div className="screen">
      <ScreenHeader title="REYTING" />
      <div className="tabbar">
        {(['GLOBAL', 'WEEKLY', 'MONTHLY'] as Range[]).map((r) => (
          <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
            {r === 'GLOBAL' ? 'UMUMIY' : r === 'WEEKLY' ? 'HAFTALIK' : 'OYLIK'}
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
          Hali reytingda hech kim yo‘q. O‘ynang va shu yerda chiqing!
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
              <div className="label">{e.wins} G‘ALABA · {e.games} O‘YIN</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="gold mono" style={{ fontWeight: 800 }}>{e.rating}</div>
              <div className="label">REYTING</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
