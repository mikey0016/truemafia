import { useEffect } from 'react';
import { ACHIEVEMENTS } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';

export function Profile() {
  const { profile, profileLoading, profileError, tgName, tgPhoto, loadProfile } = useGameStore();

  useEffect(() => {
    if (profile === null && !profileLoading) void loadProfile();
  }, [loadProfile, profile, profileLoading]);

  if (profileLoading && profile === null) {
    return (
      <div className="screen">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 160 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="screen">
        <div className="row" style={{ gap: 14 }}>
          <Avatar src={tgPhoto} name={tgName} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tgName}
            </div>
            <div className="label" style={{ marginTop: 4 }}>GUEST MODE</div>
          </div>
        </div>
        <div className="card" style={{ borderColor: 'var(--danger, #e5484d)' }}>
          <div className="h2">Profil yuklanmadi</div>
          <div className="dim" style={{ fontSize: '0.85rem', margin: '8px 0' }}>
            {profileError === 'Unauthorized'
              ? "Serverga ulanib bo'lmadi (auth). Telegram Mini App ichida yoki backend URL to'g'ri sozlanganda oching."
              : `Xato: ${profileError ?? 'Network error'}. Backend (VITE_BACKEND_URL) sozlanmagan bo'lishi mumkin.`}
          </div>
          <button className="btn btn-primary btn-block" onClick={() => void loadProfile()}>
            QAYTA URINISH
          </button>
        </div>
      </div>
    );
  }

  const xpPct = Math.min(100, Math.round((profile.xp / Math.max(1, profile.xpToNext)) * 100));
  const unlocked = new Map(profile.achievements.map((a) => [a.id, a.unlockedAt]));

  return (
    <div className="screen">
      <div className="row" style={{ gap: 14 }}>
        <Avatar src={profile.photoUrl ?? tgPhoto} name={profile.username} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.username}
          </div>
          <div className="row" style={{ gap: 8, margin: '8px 0' }}>
            <span className="badge badge-gold">LEVEL {profile.level}</span>
            <span className="badge">{profile.coins} 🪙</span>
            <span className="badge">{profile.reputation} REP</span>
          </div>
          <div className="xp-bar">
            <div style={{ width: `${xpPct}%` }} />
          </div>
          <div className="label" style={{ marginTop: 4 }}>
            {profile.xp}/{profile.xpToNext} XP
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-box"><div className="v">{profile.games}</div><div className="k">Games</div></div>
        <div className="stat-box"><div className="v gold">{profile.wins}</div><div className="k">Wins</div></div>
        <div className="stat-box"><div className="v">{profile.mafiaWins}</div><div className="k">Mafia Wins</div></div>
        <div className="stat-box"><div className="v">{profile.townWins}</div><div className="k">Town Wins</div></div>
        <div className="stat-box"><div className="v">{profile.independentWins}</div><div className="k">Indep. Wins</div></div>
        <div className="stat-box"><div className="v">{profile.winRate}%</div><div className="k">Win Rate</div></div>
        <div className="stat-box"><div className="v">{profile.bestStreak}</div><div className="k">Best Streak</div></div>
        <div className="stat-box"><div className="v">{profile.currentStreak}</div><div className="k">Streak</div></div>
      </div>

      <div className="label" style={{ marginTop: 4 }}>ACHIEVEMENTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACHIEVEMENTS.map((a) => {
          const has = unlocked.has(a.id);
          return (
            <div key={a.id} className={`achievement-card ${has ? '' : 'locked'} ${a.rare ? 'rare' : ''}`}>
              <div className="achievement-icon">🎖️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{a.name}</div>
                <div className="dim" style={{ fontSize: '0.8rem' }}>{a.description}</div>
              </div>
              {has && <span className="badge badge-green">UNLOCKED</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
