import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { haptic } from '../services/telegram';
import { playSound, unlockAudio } from '../services/sound';

export function Home() {
  const { profile, profileLoading, tgName, tgPhoto, loadProfile, navigate } = useGameStore();

  useEffect(() => {
    if (profile === null && !profileLoading) void loadProfile();
  }, [loadProfile, profile, profileLoading]);

  const level = profile?.level ?? 1;
  const xpPct = profile ? Math.min(100, Math.round((profile.xp / Math.max(1, profile.xpToNext)) * 100)) : 0;

  return (
    <div className="screen">
      {/* header / identity */}
      <div
        className="card-press row"
        style={{ gap: 14, padding: '6px 2px', cursor: 'pointer' }}
        onClick={() => {
          haptic('light');
          playSound('click');
          navigate('profile');
        }}
      >
        <Avatar src={profile?.photoUrl ?? tgPhoto} name={tgName} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tgName}
          </div>
          <div className="row" style={{ gap: 8, margin: '6px 0' }}>
            <span className="badge badge-gold">LEVEL {level}</span>
            <span className="badge">{profile ? `${profile.coins} 🪙` : '— 🪙'}</span>
          </div>
          <div className="xp-bar">
            <div style={{ width: `${xpPct}%` }} />
          </div>
          <div className="label" style={{ marginTop: 4 }}>
            {profile ? `${profile.xp}/${profile.xpToNext} XP` : 'LOADING'}
          </div>
        </div>
      </div>

      {/* PLAY hero */}
      <button
        className="play-hero"
        onPointerDown={() => {
          unlockAudio();
        }}
        onClick={() => {
          haptic('medium');
          playSound('click');
          navigate('join');
        }}
      >
        <div className="play-title">PLAY</div>
        <div className="label" style={{ color: 'var(--text-dim)', marginTop: 6 }}>
          FIND A GAME
        </div>
      </button>

      {/* quick actions */}
      <div className="row" style={{ gap: 10 }}>
        <button
          className="btn card-press"
          style={{ flex: 1, flexDirection: 'column', height: 76 }}
          onClick={() => {
            haptic('light');
            playSound('click');
            navigate('create');
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>＋</span> CREATE ROOM
        </button>
        <button
          className="btn card-press"
          style={{ flex: 1, flexDirection: 'column', height: 76 }}
          onClick={() => {
            haptic('light');
            playSound('click');
            navigate('join');
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🔗</span> JOIN ROOM
        </button>
      </div>

      {/* stats */}
      <div className="stat-grid">
        <div className="stat-box">
          <div className="v gold">{profile?.wins ?? 0}</div>
          <div className="k">Wins</div>
        </div>
        <div className="stat-box">
          <div className="v">{profile?.games ?? 0}</div>
          <div className="k">Games</div>
        </div>
        <div className="stat-box">
          <div className="v">{profile ? `${profile.winRate}%` : '—'}</div>
          <div className="k">Winrate</div>
        </div>
      </div>

      {/* menu list */}
      <div className="spacer" />      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(
          [
            ['PROFILE', 'profile', '👤'],
            ['HISTORY', 'history', '📜'],
            ['LEADERBOARD', 'leaderboard', '🏆'],
            ['ACHIEVEMENTS', 'achievements', '🎖️'],
            ['SETTINGS', 'settings', '⚙️'],
          ] as const
        ).map(([label, target, icon]) => (
          <button
            key={target}
            className="list-row card-press"
            style={{ justifyContent: 'flex-start' }}
            onClick={() => {
              haptic('light');
              playSound('click');
              navigate(target);
            }}
          >
            <span style={{ width: 24, textAlign: 'center' }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '0.04em' }}>{label}</span>
            <span className="spacer" />
            <span className="dim">›</span>
          </button>
        ))}
      </div>
      <div className="ghost-chat-note" style={{ textAlign: 'center', marginTop: 12 }}>v1.0.6</div>
    </div>
  );
}
