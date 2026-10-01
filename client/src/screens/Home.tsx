import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { haptic } from '../services/telegram';
import { playSound, unlockAudio } from '../services/sound';
import { APP_VERSION } from '@truemafia/shared';

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
        style={{ gap: 14, padding: '8px 4px', cursor: 'pointer' }}
        onClick={() => {
          haptic('light');
          playSound('click');
          navigate('profile');
        }}
      >
        <Avatar src={profile?.photoUrl ?? tgPhoto} name={tgName} size="lg" frame={profile?.frame} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h2 row" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', gap: 8 }}>
            {tgName}
            {profile?.title && (
              <span className="badge badge-gold" style={{ fontSize: '0.56rem' }}>«{profile.title}»</span>
            )}
          </div>
          <div className="row" style={{ gap: 8, margin: '7px 0' }}>
            <span className="badge badge-gold">★ DARAJA {level}</span>
            <span className="badge">{profile ? `${profile.coins} 🪙` : '— 🪙'}</span>
          </div>
          <div className="xp-bar">
            <div style={{ width: `${xpPct}%` }} />
          </div>
          <div className="label" style={{ marginTop: 6 }}>
            {profile ? `${profile.xp} / ${profile.xpToNext} XP` : 'YUKLANMOQDA…'}
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
        <div className="play-wordmark">NIGHTFALL</div>
        <div style={{ marginBottom: 4, color: 'var(--gold)' }}>
          <Icon name="masks" size={40} />
        </div>
        <div className="play-title">O‘YNASH</div>
        <div className="label" style={{ color: 'var(--text-2)', marginTop: 10, letterSpacing: '0.24em' }}>
          O‘YIN TOPISH
        </div>
      </button>

      {/* quick actions */}
      <div className="row" style={{ gap: 10 }}>
        <button
          className="btn card-press"
          style={{ flex: 1, flexDirection: 'column', height: 76, gap: 5 }}
          onClick={() => {
            haptic('light');
            playSound('click');
            navigate('create');
          }}
        >
          <Icon name="spark" size={22} />
          <span style={{ fontSize: '0.74rem' }}>XONA OCHISH</span>
        </button>
        <button
          className="btn card-press"
          style={{ flex: 1, flexDirection: 'column', height: 76, gap: 5 }}
          onClick={() => {
            haptic('light');
            playSound('click');
            navigate('join');
          }}
        >
          <Icon name="door" size={22} />
          <span style={{ fontSize: '0.74rem' }}>XONAGA KIRISH</span>
        </button>
      </div>

      {/* stats */}
      <div className="stat-grid">
        <div className="stat-box">
          <div className="v gold">{profile?.wins ?? 0}</div>
          <div className="k">G‘alaba</div>
        </div>
        <div className="stat-box">
          <div className="v">{profile?.games ?? 0}</div>
          <div className="k">O‘yin</div>
        </div>
        <div className="stat-box">
          <div className="v">{profile ? `${profile.winRate}%` : '—'}</div>
          <div className="k">Foiz</div>
        </div>
      </div>

      {/* menu list */}
      <div className="spacer" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(
          [
            ['PROFIL', 'profile', 'user'],
            ['MARKET', 'market', 'cart'],
            ['TARIX', 'history', 'scroll'],
            ['REYTING', 'leaderboard', 'trophy'],
            ['YUTUQLAR', 'achievements', 'medal'],
            ['SOZLAMALAR', 'settings', 'gear'],
            ...(profile?.isAdmin ? ([['ADMIN PANEL', 'admin', 'gear']] as const) : []),
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
            <span style={{ width: 28, display: 'flex', justifyContent: 'center', color: 'var(--text-2)' }}>
              <Icon name={icon} size={19} />
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.08em' }}>{label}</span>
            <span className="spacer" />
            <span className="faint">›</span>
          </button>
        ))}
      </div>
      <div className="ghost-chat-note" style={{ textAlign: 'center', marginTop: 12 }}>{APP_VERSION} · NOIR</div>
    </div>
  );
}
