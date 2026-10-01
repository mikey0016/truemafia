import { useEffect, useMemo, useState } from 'react';
import type { PlayerCardView } from '@truemafia/shared';
import { ROLES } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { PlayerCard } from '../components/PlayerCard';
import { Chat } from '../components/Chat';
import { RoleCard } from '../components/RoleCard';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound, vibrate } from '../services/sound';

function useCountdown(endsAt: number | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, []);
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function Game() {
  const snapshot = useGameStore((s) => s.snapshot);
  const roleCardVisible = useGameStore((s) => s.roleCardVisible);
  const dismissRoleCard = useGameStore((s) => s.dismissRoleCard);
  const achievementPopup = useGameStore((s) => s.achievementPopup);
  const resetTo = useGameStore((s) => s.resetTo);

  const leaveGame = () => {
    haptic('light');
    getSocket().emit('room:leave', {}, () => {});
    const s = useGameStore.getState();
    s.clearRoom();
    s.resetTo('home');
  };

  if (!snapshot) {
    return (
      <div className="screen">
        <div className="skeleton" style={{ height: 60 }} />
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 60 }} />
      </div>
    );
  }

  const phase = snapshot.phase.phase;
  const secondsLeft = useCountdown(snapshot.phase.endsAt);

  return (
    <div className="screen" style={{ gap: 10 }}>
      {/* HUD */}
      <Hud snapshot={snapshot} secondsLeft={secondsLeft} />

      {phase !== 'GAME_OVER' && (
        <button className="btn btn-ghost" style={{ color: '#ff6b6b', padding: '6px 14px', alignSelf: 'flex-end' }} onClick={leaveGame}>
          CHIQISH
        </button>
      )}

      {phase === 'ROLE_REVEAL' && !roleCardVisible && <RoleRevealPrompt />}

      {phase === 'GAME_OVER' ? (
        <GameOver snapshot={snapshot} onHome={() => resetTo('home')} />
      ) : (
        <>
          {phase === 'NIGHT' && <NightPhase snapshot={snapshot} secondsLeft={secondsLeft} />}
          {phase === 'NIGHT_RESULT' && <NightResult snapshot={snapshot} />}
          {(phase === 'DAY' || phase === 'DISCUSSION') && <DayPhase snapshot={snapshot} />}
          {phase === 'VOTING' && <VotingPhase snapshot={snapshot} secondsLeft={secondsLeft} />}
          {phase === 'VOTE_RESULT' && <VoteResult snapshot={snapshot} />}
        </>
      )}

      {roleCardVisible && snapshot.you.role && (
        <Overlay>
          <RoleCard role={snapshot.you.role} onClose={dismissRoleCard} />
        </Overlay>
      )}
      {achievementPopup && <AchievementPopup />}
    </div>
  );
}

/* ---------- HUD ---------- */

function Hud({ snapshot, secondsLeft }: { snapshot: NonNullable<ReturnType<typeof useGameStore.getState>['snapshot']>; secondsLeft: number }) {
  const phase = snapshot.phase.phase;
  const night = phase === 'NIGHT' || phase === 'NIGHT_RESULT';
  const label =
    phase === 'ROLE_REVEAL' ? 'ROLLAR' : phase.startsWith('NIGHT') ? `TUN ${snapshot.phase.round}` : phase === 'GAME_OVER' ? 'TUGADI' : `KUN ${snapshot.phase.round}`;
  const alive = snapshot.players.filter((p) => p.alive).length;
  const urgent = secondsLeft > 0 && secondsLeft <= 10 && phase !== 'GAME_OVER';

  return (
    <>
      <div className="hud">
        <span className={`phase-title ${night ? 'night' : 'day'}`} style={{ fontSize: '1.05rem' }}>
          {label}
        </span>
        <span className={`timer mono ${urgent ? 'urgent' : ''}`}>
          {phase === 'GAME_OVER' ? '—' : formatTime(secondsLeft)}
        </span>
        <span className="badge">TIRIK {alive}</span>
      </div>
      <style>{`@keyframes hueShift { from { filter: hue-rotate(0); } }`}</style>
    </>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ---------- ROLE REVEAL prompt ---------- */

function RoleRevealPrompt() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 24 }}>
      <div className="h2">Rolingizni tekshiring</div>
      <div className="dim" style={{ marginTop: 6 }}>
        Yuqoridagi kartani bosib maxfiy rolingizni oching.
      </div>
    </div>
  );
}

/* ---------- NIGHT ---------- */

function NightPhase({ snapshot, secondsLeft }: { snapshot: GameSnap; secondsLeft: number }) {
  const myRole = snapshot.you.role ? ROLES[snapshot.you.role] : null;
  const canAct = !!myRole?.nightAction && snapshot.you.alive;
  const actionDone = snapshot.you.hasActed;
  const isMafiaTeam = myRole && (snapshot.you.role === 'MAFIA' || snapshot.you.role === 'DON');
  const isDetective = snapshot.you.role === 'DETECTIVE';
  const shotLeft = snapshot.you.shotLeft === true;
  const [pendingTarget, setPendingTarget] = useState<PlayerCardView | null>(null);

  const doAction = (targetId: number, mode?: 'kill' | 'investigate') => {
    haptic('medium');
    setPendingTarget(null);
    getSocket().emit('game:action', { targetId, ...(mode ? { mode } : {}) }, (res) => {
      if (!res.ok) {
        hapticNotify('error');
        useGameStore.getState().pushToast('error', res.error ?? 'Harakat bajarilmadi');
      } else {
        playSound('click');
      }
    });
  };

  const select = (target: PlayerCardView) => {
    if (!canAct || actionDone || !target.alive || target.userId === snapshot.you.userId) return;
    // Detektiv o‘qi bor bo‘lsa — avval OTASIZMI yoki TEKSHIRASIZMI deb so‘raymiz
    if (isDetective && shotLeft) {
      haptic('light');
      setPendingTarget(target);
      return;
    }
    doAction(target.userId);
  };

  const isSelectable = (p: PlayerCardView): boolean => {
    if (!canAct || actionDone) return false;
    if (!p.alive) return false;
    if (p.userId === snapshot.you.userId) return myRole?.actionKind === 'protect';
    if (isMafiaTeam && (p.role === 'MAFIA' || p.role === 'DON')) return false; // ally reveal via role
    return true;
  };

  return (
    <>
      <PhaseBanner title={`TUN ${snapshot.phase.round}`} night />
      {canAct ? (
        actionDone ? (
          <div className="saved-banner" style={{ padding: 14 }}>
            ✔ HARAKAT BAJARILDI — BOSHQALAR KUTILMOQDA
          </div>
        ) : (
          <div className="card">
            <div className="row-between">
              <span className="label">
                {myRole?.actionKind === 'kill' && (isMafiaTeam ? 'NISHONNI TANLANG — YO‘Q QILING' : 'O‘LDIRISH')}
                {myRole?.actionKind === 'protect' && 'O‘YINCHINI HIMOYA QILING'}
                {myRole?.actionKind === 'save' && 'O‘YINCHINI QO‘RIQLANG'}
                {myRole?.actionKind === 'investigate' && (isDetective && shotLeft ? 'TEKSHIRISH YOKI OTISH 🔫' : 'O‘YINCHINI TEKSHIRING')}
              </span>
              <span className="timer mono" style={{ fontSize: '0.9rem' }}>{formatTime(secondsLeft)}</span>
            </div>
          </div>
        )
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="dim">{snapshot.you.alive ? 'Bu tun osoyishta uxlang. Ko‘zlaringizni yuming.' : 'Nariqdan kuzatyapsiz…'}</div>
        </div>
      )}

      <div className="player-grid">
        {snapshot.players.map((p) => (
          <PlayerCard
            key={p.userId}
            player={p}
            selectable={isSelectable(p)}
            selected={false}
            disabled={false}
            showRole={!!p.role}
            onClick={() => select(p)}
          />
        ))}
      </div>

      {isMafiaTeam && <Chat snapshot={snapshot} />}

      {pendingTarget && (
        <Overlay>
          <div className="card-strong" style={{ textAlign: 'center', padding: 26, maxWidth: 300 }}>
            <div style={{ fontSize: '2.2rem' }}>🎯</div>
            <div className="h2" style={{ margin: '8px 0 2px' }}>{pendingTarget.displayName}</div>
            <div className="label gold" style={{ marginBottom: 14 }}>NIMA QILASIZ?</div>
            <button
              className="btn btn-block"
              style={{ marginBottom: 8 }}
              onClick={() => doAction(pendingTarget.userId, 'investigate')}
            >
              🔍 TEKSHIRISH
            </button>
            <button
              className="btn btn-primary btn-block"
              style={{ marginBottom: 8 }}
              onClick={() => doAction(pendingTarget.userId, 'kill')}
            >
              🔫 OTISH (1 o‘q)
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setPendingTarget(null)}>
              BEKOR QILISH
            </button>
          </div>
        </Overlay>
      )}
    </>
  );
}

/* ---------- NIGHT RESULT ---------- */

function NightResult({ snapshot }: { snapshot: GameSnap }) {
  const alive = snapshot.players.filter((p) => p.alive);
  const deathsThisGame = snapshot.players.filter((p) => !p.alive);
  const lastDeath = deathsThisGame[deathsThisGame.length - 1];

  return (
    <>
      {lastDeath ? (
        <div className="eliminated-banner">
          <div style={{ fontSize: '2rem' }}>🥀</div>
          <div className="h2" style={{ margin: '6px 0' }}>{lastDeath.displayName}</div>
          <div className="label">TUNDA CHETLATILDI</div>
          {lastDeath.role && (
            <div className="badge badge-red" style={{ marginTop: 8 }}>
              {ROLES[lastDeath.role].name.toUpperCase()} EDI
            </div>
          )}
        </div>
      ) : (
        <div className="saved-banner">
          <div style={{ fontSize: '2rem' }}>☀️</div>
          <div className="h2" style={{ margin: '6px 0' }}>HECH KIM O‘LMADI</div>
          <div className="label">DOKTOR SHAHARNI QUTQARDI</div>
        </div>
      )}
      <div className="player-grid">
        {alive.map((p) => (
          <PlayerCard key={p.userId} player={p} showRole={!!p.role} />
        ))}
      </div>
    </>
  );
}

/* ---------- DAY / DISCUSSION ---------- */

function DayPhase({ snapshot }: { snapshot: GameSnap }) {
  const alive = snapshot.players.filter((p) => p.alive).length;
  const eliminated = snapshot.players.length - alive;

  return (
    <>
      <PhaseBanner title={`KUN ${snapshot.phase.round}`} />
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="stat-box"><div className="v gold">{alive}</div><div className="k">Tirik</div></div>
        <div className="stat-box"><div className="v">{eliminated}</div><div className="k">Chiqarilgan</div></div>
        <div className="stat-box"><div className="v">{snapshot.phase.round}</div><div className="k">Kun</div></div>
      </div>
      <Chat snapshot={snapshot} />
    </>
  );
}

/* ---------- VOTING ---------- */

function VotingPhase({ snapshot, secondsLeft }: { snapshot: GameSnap; secondsLeft: number }) {
  const [pending, setPending] = useState<number | null>(null);
  const myVote = snapshot.myVote ?? null;
  const dead = !snapshot.you.alive;

  const vote = (target: PlayerCardView) => {
    if (dead || !target.alive) return;
    haptic('medium');
    setPending(target.userId);
    getSocket().emit('game:vote', { targetId: target.userId }, (res) => {
      if (!res.ok) {
        hapticNotify('error');
        setPending(null);
          useGameStore.getState().pushToast('error', res.error ?? 'Ovoz berilmadi');
      } else {
        playSound('vote');
        setPending(null);
      }
    });
  };

  return (
    <>
      <PhaseBanner title="MAFIYA KIM?" />
      {!snapshot.you.alive && (
        <div className="ghost-chat-note">O‘lganlar ovoz berolmaydi. Shahar qarorini kuzating.</div>
      )}
      {myVote !== null && (
        <div className="saved-banner" style={{ padding: 12 }}>
          ✔ OVOZ QULFLANDI — {formatTime(secondsLeft)} QOLDI
        </div>
      )}
      <div className="player-grid">
        {snapshot.players.map((p) => (
          <PlayerCard
            key={p.userId}
            player={p}
            selectable={!!p.alive && !dead && myVote === null}
            selected={myVote === p.userId || pending === p.userId}
            showRole={!!p.role}
            voteCount={snapshot.voteCounts?.[String(p.userId)]}
            onClick={() => vote(p)}
          />
        ))}
      </div>
    </>
  );
}

/* ---------- VOTE RESULT ---------- */

function VoteResult({ snapshot }: { snapshot: GameSnap }) {
  const tally = snapshot.voteCounts ?? {};
  const entries = Object.entries(tally)
    .map(([id, count]) => ({ player: snapshot.players.find((p) => p.userId === Number(id)), count }))
    .filter((e) => e.player)
    .sort((a, b) => b.count - a.count);
  // most-recently-voted-out player: derive from votes received this round
  const eliminated = snapshot.players.find((p) => !p.alive && (snapshot.voteCounts?.[String(p.userId)] ?? 0) > 0);

  return (
    <>
      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>OVOZ NATIJALARI</div>
        {entries.length === 0 ? (
          <div className="empty-state">Hech kim ovoz bermadi.</div>
        ) : (
          entries.map(({ player, count }) => (
            <div key={player!.userId} className="row-between" style={{ padding: '8px 0' }}>
              <span style={{ fontWeight: 700 }}>{player!.displayName}</span>
              <span className="mono gold">{count} ovoz</span>
            </div>
          ))
        )}
      </div>
      {eliminated ? (
        <div className="eliminated-banner">
          <div style={{ fontSize: '2rem' }}>⚖️</div>
          <div className="h2" style={{ margin: '6px 0' }}>{eliminated.displayName}</div>
          <div className="label">CHETLATILDI</div>
          {eliminated.role ? (
            <div className={`badge ${ROLES[eliminated.role].team === 'MAFIA' ? 'badge-red' : 'badge-green'}`} style={{ marginTop: 8 }}>
              {ROLES[eliminated.role].name.toUpperCase()}
            </div>
          ) : (
            <div className="badge" style={{ marginTop: 8 }}>ROL NOMA’LUM</div>
          )}
        </div>
      ) : (
        <div className="saved-banner">
          <div className="h2">YAKDILLIK YO‘Q</div>
          <div className="label" style={{ marginTop: 4 }}>HECH KIM CHIQARILMADI</div>
        </div>
      )}
    </>
  );
}

/* ---------- GAME OVER ---------- */

function GameOver({ snapshot, onHome }: { snapshot: GameSnap; onHome: () => void }) {
  const winner = snapshot.winner;
  const you = snapshot.players.find((p) => p.userId === snapshot.you.userId);
  const yourRole = you?.role ? ROLES[you.role] : null;
  const won = you?.role && winner && roleWon(you.role, winner);
  const survivors = snapshot.players.filter((p) => p.alive);
  const eliminated = snapshot.players.filter((p) => !p.alive);

  const playAgain = () => {
    getSocket().emit('game:continue', {}, () => {});
  };

  return (
    <>
      <div className={won ? 'saved-banner' : 'eliminated-banner'} style={{ padding: 28 }}>
        <div style={{ fontSize: '2.6rem' }}>{won ? '🏆' : '🥀'}</div>
        <div className="h1" style={{ margin: '8px 0' }}>
          {winner === 'MAFIA' ? 'MAFIYA YUTDI' : winner === 'TOWN' ? 'SHAHAR YUTDI' : 'MUSTAQIL YUTDI'}
        </div>
        <div className="label">{won ? 'SIZ G‘OLIBSIZ' : 'KEYINGI SAFAR OMAD'}</div>
      </div>

      {yourRole && (
        <div className="card row" style={{ gap: 12 }}>
          <div className="achievement-icon" style={{ fontSize: '1.5rem' }}>
            {ROLE_ICONS[yourRole.icon] ?? '🎭'}
          </div>
            <div>
              <div className="label">SIZNING ROLINGIZ</div>
              <div className="h2" style={{ color: yourRole.color }}>{yourRole.name}</div>
            </div>
        </div>
      )}

      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>OMON QOLDI ({survivors.length})</div>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {survivors.map((p) => (
            <span key={p.userId} className="chip">{p.displayName}</span>
          ))}
        </div>
        <div className="label" style={{ marginBottom: 8 }}>CHETLATILDI ({eliminated.length})</div>
        <div className="chip-row">
          {eliminated.map((p) => (
            <span key={p.userId} className="chip" style={{ opacity: 0.55 }}>
              {p.displayName}{p.role ? ` — ${ROLES[p.role].name}` : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="spacer" />
      <button className="btn btn-primary btn-block btn-lg" onClick={playAgain}>YANA O‘YNASH</button>
      <button className="btn btn-ghost btn-block" onClick={onHome}>BOSH SAHIFA</button>
    </>
  );
}

function roleWon(role: string, winner: string): boolean {
  if (role === 'MAFIA' || role === 'DON') return winner === 'MAFIA';
  if (role === 'SERIAL_KILLER' || role === 'JESTER') return winner === 'INDEPENDENT';
  return winner === 'TOWN';
}

const ROLE_ICONS: Record<string, string> = {
  user: '🧑', skull: '💀', crown: '👑', plus: '⚕️', search: '🔍', shield: '🛡️', knife: '🔪', masks: '🎭', drop: '🩸',
};

/* ---------- shared bits ---------- */

type GameSnap = NonNullable<ReturnType<typeof useGameStore.getState>['snapshot']>;

function PhaseBanner({ title, night }: { title: string; night?: boolean }) {
  return (
    <div className="phase-banner">
      <div className={`phase-title ${night ? 'night' : 'day'}`}>{title}</div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 6, 10, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        animation: 'screenIn 0.3s ease',
      }}
    >
      {children}
    </div>
  );
}

function AchievementPopup() {
  const popup = useGameStore((s) => s.achievementPopup);
  if (!popup) return null;
  return (
    <Overlay>
      <div className="card-strong" style={{ textAlign: 'center', padding: 30, maxWidth: 300 }}>
        <div style={{ fontSize: '2.4rem' }}>🎖️</div>
        <div className="label gold" style={{ margin: '8px 0 4px' }}>YUTUQ OCHILDI</div>
        <div className="h2">{popup.name}</div>
        <div className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>{popup.description}</div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 18 }} onClick={() => useGameStore.setState({ achievementPopup: null })}>
          ZO‘R
        </button>
      </div>
    </Overlay>
  );
}
