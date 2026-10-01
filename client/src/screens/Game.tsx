import { useEffect, useState } from 'react';
import type { PlayerCardView } from '@truemafia/shared';
import { ROLES } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { PlayerCard } from '../components/PlayerCard';
import { Chat } from '../components/Chat';
import { RoleCard } from '../components/RoleCard';
import { TimerRing } from '../components/TimerRing';
import { Icon } from '../components/Icon';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

function useCountdown(endsAt: number | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, []);
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

type GameSnap = NonNullable<ReturnType<typeof useGameStore.getState>['snapshot']>;

export function Game() {
  const snapshot = useGameStore((s) => s.snapshot);
  const roleCardVisible = useGameStore((s) => s.roleCardVisible);
  const dismissedRoleRound = useGameStore((s) => s.dismissedRoleRound);
  const showRoleCard = useGameStore((s) => s.showRoleCard);
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

  // Tizim: ROLE_REVEAL paytida rol kartasi ishonchli ochilsin
  // (socket poygasi tufayli birinchi ko'rsatish o'tkazib yuborilsa — qayta ochamiz)
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.phase.phase === 'ROLE_REVEAL' && !roleCardVisible && dismissedRoleRound !== snapshot.phase.round) {
      showRoleCard();
    }
  }, [snapshot?.phase.phase, snapshot?.phase.round, roleCardVisible, dismissedRoleRound]);

  const secondsLeft = useCountdown(snapshot?.phase.endsAt ?? null);

  if (!snapshot) {
    return (
      <div className="screen">
        <div className="skeleton" style={{ height: 72 }} />
        <div className="skeleton" style={{ height: 260 }} />
        <div className="skeleton" style={{ height: 72 }} />
      </div>
    );
  }

  const phase = snapshot.phase.phase;
  const phaseTotal = (() => {
    switch (phase) {
      case 'NIGHT':
        return snapshot.settings.nightSeconds;
      case 'DISCUSSION':
        return snapshot.settings.discussionSeconds;
      case 'VOTING':
        return snapshot.settings.votingSeconds;
      default:
        return Math.max(secondsLeft, 60);
    }
  })();

  return (
    <div className="screen" style={{ gap: 12 }}>
      <Hud snapshot={snapshot} secondsLeft={secondsLeft} totalSeconds={phaseTotal} onOpenRole={() => showRoleCard()} />

      {phase !== 'GAME_OVER' && (
        <button
          className="btn btn-ghost"
          style={{ color: 'var(--blood-2)', padding: '7px 14px', minHeight: 0, alignSelf: 'flex-end', fontSize: '0.78rem' }}
          onClick={leaveGame}
        >
          CHIQISH
        </button>
      )}

      {phase === 'GAME_OVER' ? (
        <GameOver snapshot={snapshot} onHome={() => resetTo('home')} />
      ) : (
        <>
          {phase === 'ROLE_REVEAL' && <RoleRevealPrompt onOpen={() => showRoleCard()} />}
          {phase === 'NIGHT' && <NightPhase snapshot={snapshot} secondsLeft={secondsLeft} />}
          {phase === 'NIGHT_RESULT' && <NightResult snapshot={snapshot} />}
          {(phase === 'DAY' || phase === 'DISCUSSION') && <DayPhase snapshot={snapshot} />}
          {phase === 'VOTING' && <VotingPhase snapshot={snapshot} secondsLeft={secondsLeft} />}
          {phase === 'VOTE_RESULT' && <VoteResult snapshot={snapshot} />}
        </>
      )}

      {roleCardVisible && snapshot.you.role && (
        <div className="overlay">
          <RoleCard role={snapshot.you.role} onClose={() => dismissRoleCard(snapshot.phase.round)} />
        </div>
      )}
      {achievementPopup && <AchievementPopup />}
    </div>
  );
}

/* ---------- HUD ---------- */

function Hud({
  snapshot,
  secondsLeft,
  totalSeconds,
  onOpenRole,
}: {
  snapshot: GameSnap;
  secondsLeft: number;
  totalSeconds: number;
  onOpenRole: () => void;
}) {
  const phase = snapshot.phase.phase;
  const night = phase === 'NIGHT' || phase === 'NIGHT_RESULT' || phase === 'ROLE_REVEAL';
  const label =
    phase === 'ROLE_REVEAL'
      ? 'ROLLAR'
      : phase.startsWith('NIGHT')
        ? `TUN ${snapshot.phase.round}`
        : phase === 'GAME_OVER'
          ? 'TUGADI'
          : `KUN ${snapshot.phase.round}`;
  const alive = snapshot.players.filter((p) => p.alive).length;
  const urgent = secondsLeft > 0 && secondsLeft <= 10 && phase !== 'GAME_OVER';
  const myRole = snapshot.you.role ? ROLES[snapshot.you.role] : null;

  const hudIcon =
    phase === 'GAME_OVER' ? 'skull' : night ? 'moon' : phase === 'VOTING' || phase === 'VOTE_RESULT' ? 'gavel' : 'sun';

  return (
    <div className="hud">
      <TimerRing
        secondsLeft={secondsLeft}
        totalSeconds={totalSeconds}
        night={night}
        urgent={urgent}
      />
      <div className="hud-phase">
        <span className="label">{night ? 'OY OSTIDA' : phase === 'GAME_OVER' ? 'FINAL' : 'QUYOSH OSTIDA'}</span>
        <span className={`phase-name ${phase === 'GAME_OVER' ? 'over' : night ? 'night' : 'day'}`}>{label}</span>
      </div>
      {myRole && (
        <button
          className="badge badge-gold"
          style={{ padding: '7px 11px', gap: 5 }}
          onClick={() => {
            haptic('light');
            onOpenRole();
          }}
        >
          <Icon name={myRole.icon} size={13} />
          {myRole.name.toUpperCase()}
        </button>
      )}
      <span className="badge">
        <Icon name="user" size={12} />
        {alive}
      </span>
    </div>
  );
}

/* ---------- ROLE REVEAL ---------- */

function RoleRevealPrompt({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="card card-press" style={{ textAlign: 'center', padding: 26, cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ color: 'var(--gold)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name="eye" size={30} />
      </div>
      <div className="h2 serif" style={{ letterSpacing: '0.06em' }}>Rolingizni oching</div>
      <div className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>
        Karta yopiq — maxfiy rolingizni ko‘rish uchun bosing.
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
    if (isMafiaTeam && (p.role === 'MAFIA' || p.role === 'DON')) return false;
    return true;
  };

  const actLabel = () => {
    if (myRole?.actionKind === 'kill') return isMafiaTeam ? 'QURBONNI TANLANG' : 'O‘LDIRISH';
    if (myRole?.actionKind === 'protect') return 'KIMNI DAVOLAYSIZ?';
    if (myRole?.actionKind === 'save') return 'KIMNI QO‘RIQLAYSIZ?';
    if (myRole?.actionKind === 'investigate') return shotLeft ? 'TEKSHIRISH YOKI OTISH' : 'KIMNI TEKSHIRASIZ?';
    return '';
  };

  const actIcon = myRole?.actionKind === 'protect' || myRole?.actionKind === 'save' ? 'plus' : isMafiaTeam ? 'knife' : isDetective ? 'search' : 'target';

  return (
    <>
      <PhaseBanner
        icon="moon"
        title={`TUN ${snapshot.phase.round}`}
        sub={canAct && !actionDone ? 'SHAHAR UXLAYDI — HARAKAT QILING' : 'SHAHAR UXLAMOQDA'}
        night
      />

      {canAct ? (
        actionDone ? (
          <div className="done-banner">
            <Icon name="check" size={16} />
            HARAKAT BAJARILDI — BOSHQALAR KUTILMOQDA
          </div>
        ) : (
          <div className="action-panel">
            <div className="act-icon">
              <Icon name={actIcon} size={22} />
            </div>
            <div className="act-text">
              <div className="act-title">{actLabel()}</div>
              <div className="act-hint">O‘yinchini tanlang — {secondsLeft}s qoldi</div>
            </div>
          </div>
        )
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div className="dim" style={{ fontSize: '0.9rem' }}>
            {snapshot.you.alive
              ? 'Bu tun osoyishta uxlang. Ertaga shahar yig‘iladi.'
              : 'Nariqdan shaharni kuzatyapsiz…'}
          </div>
        </div>
      )}

      {isDetective && snapshot.you.investigations.length > 0 && <DetectiveNotebook snapshot={snapshot} />}

      <div className="player-grid">
        {snapshot.players.map((p) => (
          <PlayerCard
            key={p.userId}
            player={p}
            selectable={isSelectable(p)}
            selected={false}
            showRole={!!p.role}
            me={p.userId === snapshot.you.userId}
            ally={!!p.ally}
            onClick={() => select(p)}
          />
        ))}
      </div>

      {isMafiaTeam && <Chat snapshot={snapshot} />}

      {pendingTarget && (
        <div className="overlay">
          <div className="card-strong" style={{ textAlign: 'center', padding: 26, maxWidth: 300 }}>
            <div style={{ color: 'var(--blood-2)', display: 'flex', justifyContent: 'center' }}>
              <Icon name="target" size={34} />
            </div>
            <div className="h2 serif" style={{ margin: '8px 0 2px', letterSpacing: '0.04em' }}>{pendingTarget.displayName}</div>
            <div className="label gold" style={{ marginBottom: 14 }}>NIMA QILASIZ?</div>
            <button
              className="btn btn-block"
              style={{ marginBottom: 8 }}
              onClick={() => doAction(pendingTarget.userId, 'investigate')}
            >
              <Icon name="search" size={17} /> TEKSHIRISH
            </button>
            <button
              className="btn btn-danger btn-block"
              style={{ marginBottom: 8 }}
              onClick={() => doAction(pendingTarget.userId, 'kill')}
            >
              <Icon name="knife" size={17} /> OTISH — 1 O‘Q
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setPendingTarget(null)}>
              BEKOR QILISH
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Detektiv daftari ---------- */

function DetectiveNotebook({ snapshot }: { snapshot: GameSnap }) {
  const invs = [...snapshot.you.investigations].reverse();
  return (
    <div className="notebook">
      <div className="nb-title">
        <Icon name="search" size={14} /> DETEKTIV DAFTARI
      </div>
      {invs.slice(0, 4).map((inv, i) => {
        const target = snapshot.players.find((p) => p.userId === inv.targetId);
        return (
          <div key={`${inv.targetId}-${i}`} className="nb-row">
            <span className="dim">{target?.displayName ?? `#${inv.targetId}`}</span>
            <span className={inv.result === 'MAFIA' ? 'tag-mafia' : 'tag-clean'}>
              {inv.result === 'MAFIA' ? '● MAFIYA' : '● MAFIYA EMAS'}
            </span>
          </div>
        );
      })}
    </div>
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
          <div style={{ color: 'var(--blood-2)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Icon name="heart" size={30} />
          </div>
          <div className="h2 serif" style={{ margin: '4px 0', letterSpacing: '0.05em' }}>{lastDeath.displayName}</div>
          <div className="label">TUNDA HALOK BO‘LDI</div>
          {lastDeath.role && (
            <div
              className="badge"
              style={{
                color: ROLES[lastDeath.role].color,
                borderColor: `${ROLES[lastDeath.role].color}66`,
                background: `${ROLES[lastDeath.role].color}1c`,
                marginTop: 10,
              }}
            >
              {ROLES[lastDeath.role].name.toUpperCase()} EDI
            </div>
          )}
        </div>
      ) : (
        <div className="saved-banner">
          <div style={{ color: 'var(--green-2)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Icon name="sun" size={30} />
          </div>
          <div className="h2 serif" style={{ margin: '4px 0', letterSpacing: '0.05em' }}>HECH KIM O‘LMADI</div>
          <div className="label">SHAHAR TUNNI OMON O‘TKAZDI</div>
        </div>
      )}
      <div className="player-grid">
        {alive.map((p) => (
          <PlayerCard key={p.userId} player={p} showRole={!!p.role} me={p.userId === snapshot.you.userId} ally={!!p.ally} />
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
      <PhaseBanner
        icon="sun"
        title={`KUN ${snapshot.phase.round}`}
        sub="MUHOKAMA — MAFIYANI TOPING"
      />
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="stat-box"><div className="v gold">{alive}</div><div className="k">Tirik</div></div>
        <div className="stat-box"><div className="v">{eliminated}</div><div className="k">Ketdi</div></div>
        <div className="stat-box"><div className="v">{snapshot.phase.round}</div><div className="k">Kun</div></div>
      </div>
      <Chat snapshot={snapshot} />
    </>
  );
}

/* ---------- VOTING ---------- */

function VotingPhase({ snapshot, secondsLeft }: { snapshot: GameSnap; secondsLeft: number }) {
  const myVote = snapshot.myVote ?? null;
  const dead = !snapshot.you.alive;
  const runoff = snapshot.runoff ?? null;
  const anonymous = snapshot.settings.anonymousVoting === true;
  const [justVoted, setJustVoted] = useState(false);

  const vote = (target: PlayerCardView) => {
    if (dead || !target.alive || myVote !== null) return;
    if (runoff && !runoff.includes(target.userId)) return;
    haptic('medium');
    setJustVoted(true);
    getSocket().emit('game:vote', { targetId: target.userId }, (res) => {
      if (!res.ok) {
        hapticNotify('error');
        setJustVoted(false);
        useGameStore.getState().pushToast('error', res.error ?? 'Ovoz berilmadi');
      } else {
        playSound('vote');
      }
    });
  };

  const totalVotes = Object.values(snapshot.voteCounts ?? {}).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(1, ...Object.values(snapshot.voteCounts ?? {}).map(Number));
  const runoffPlayers = runoff
    ? runoff.map((id) => snapshot.players.find((p) => p.userId === id)).filter(Boolean)
    : [];

  return (
    <>
      <PhaseBanner icon="gavel" title={runoff ? 'QAYTA OVOZ' : 'MAFIYA KIM?'} sub={`OVOZ BERISH — ${secondsLeft}S`} />
      {runoff && (
        <div className="action-panel runoff-panel">
          <div className="act-icon" style={{ color: 'var(--gold)', background: 'rgba(217,180,91,.12)', borderColor: 'rgba(217,180,91,.4)' }}>
            <Icon name="refresh" size={20} />
          </div>
          <div className="act-text">
            <div className="act-title" style={{ color: 'var(--gold)' }}>
              OVOZLAR TENGGI — QAYTA OVOZ
            </div>
            <div className="act-hint">
              Faqat {runoffPlayers.map((p) => p!.displayName).join(' va ')} orasida tanlang
            </div>
          </div>
        </div>
      )}
      {anonymous && <div className="ghost-chat-note">🔒 YASHIRIN OVOZ — kim kimga bergani ko‘rinmaydi</div>}
      {!snapshot.you.alive && (
        <div className="ghost-chat-note">O‘lganlar ovoz berolmaydi. Shahar qarorini kuzating.</div>
      )}
      {(myVote !== null || justVoted) && (
        <div className="done-banner">
          <Icon name="check" size={16} />
          OVOZINGIZ QULFLANDI — {totalVotes} OVOZ TO‘PLANDI
        </div>
      )}
      <div className="player-grid">
        {snapshot.players.map((p) => {
          const cnt = Number(snapshot.voteCounts?.[String(p.userId)] ?? 0);
          const runoffLocked = !!runoff && !runoff.includes(p.userId);
          return (
            <PlayerCard
              key={p.userId}
              player={p}
              selectable={!!p.alive && !dead && myVote === null && !runoffLocked}
              selected={myVote === p.userId}
              showRole={!!p.role}
              voteCount={cnt > 0 ? cnt : undefined}
              voteFraction={cnt / maxVotes}
              me={p.userId === snapshot.you.userId}
              ally={!!p.ally}
              onClick={() => vote(p)}
            />
          );
        })}
      </div>
      {!anonymous && <VoteLogPanel snapshot={snapshot} />}
    </>
  );
}

/* ---------- kim kimga ovoz bergan ---------- */

function VoteLogPanel({ snapshot }: { snapshot: GameSnap }) {
  const log = snapshot.voteLog ?? [];
  if (log.length === 0) return null;
  const nameOf = (id: number) =>
    snapshot.players.find((p) => p.userId === id)?.displayName ?? `#${id}`;
  return (
    <div className="vote-log">
      <div className="vl-title">
        <Icon name="eye" size={13} /> KIM KIMGA OVOZ BERGAN
      </div>
      <div className="vl-rows">
        {log.map((v, i) => (
          <span key={`${v.voterId}-${i}`} className="vl-row">
            {nameOf(v.voterId)} <span className="vl-arrow">→</span> {nameOf(v.targetId)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- VOTE RESULT ---------- */

function VoteResult({ snapshot }: { snapshot: GameSnap }) {
  const tally = snapshot.voteCounts ?? {};
  const entries = Object.entries(tally)
    .map(([id, count]) => ({ player: snapshot.players.find((p) => p.userId === Number(id)), count }))
    .filter((e) => e.player)
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...entries.map((e) => e.count));
  const anonymous = snapshot.settings.anonymousVoting === true;
  const votersFor = (id: number) =>
    (snapshot.voteLog ?? []).filter((v) => v.targetId === id).map((v) => v.voterId);
  // shu raundda chiqarilgan o'yinchi
  const eliminated = snapshot.players.find((p) => !p.alive && (snapshot.voteCounts?.[String(p.userId)] ?? 0) > 0);

  return (
    <>
      {entries.length > 0 && (
        <div className="card">
          <div className="label" style={{ marginBottom: 10 }}>OVOZ NATIJALARI</div>
          {entries.map(({ player, count }) => {
            const voters = anonymous ? [] : votersFor(player!.userId);
            return (
              <div key={player!.userId} style={{ marginBottom: 10 }}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{player!.displayName}</span>
                  <span className="mono gold" style={{ fontWeight: 800 }}>{count}</span>
                </div>
                <div className="vote-bar" style={{ height: 5 }}>
                  <div style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                </div>
                {voters.length > 0 && (
                  <div className="vl-inline">ovoz berganlar: {voters.map((vid) => snapshot.players.find((p) => p.userId === vid)?.displayName ?? '?').join(', ')}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {eliminated ? (
        <div className="eliminated-banner">
          <div style={{ color: 'var(--blood-2)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Icon name="gavel" size={30} />
          </div>
          <div className="h2 serif" style={{ margin: '4px 0', letterSpacing: '0.05em' }}>{eliminated.displayName}</div>
          <div className="label">SHAHAR QARORI BILAN CHIQARILDI</div>
          {eliminated.role ? (
            <div
              className="badge"
              style={{
                color: ROLES[eliminated.role].color,
                borderColor: `${ROLES[eliminated.role].color}66`,
                background: `${ROLES[eliminated.role].color}1c`,
                marginTop: 10,
              }}
            >
              {ROLES[eliminated.role].name.toUpperCase()}
            </div>
          ) : (
            <div className="badge" style={{ marginTop: 10 }}>ROL NOMA’LUM</div>
          )}
        </div>
      ) : (
        <div className="saved-banner">
          <div style={{ color: 'var(--gold-2)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Icon name="check" size={30} />
          </div>
          <div className="h2 serif" style={{ letterSpacing: '0.05em' }}>YAKDILLIK YO‘Q</div>
          <div className="label" style={{ marginTop: 6 }}>HECH KIM CHIQARILMADI</div>
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
  const won = !!(you?.role && winner && roleWon(you.role, winner));
  const teamClass = winner === 'MAFIA' ? 'mafia' : winner === 'TOWN' ? 'town' : 'indep';

  const playAgain = () => {
    haptic('medium');
    getSocket().emit('game:continue', {}, (res) => {
      if (!res.ok) {
        // server restart bo'lsa xona xotiradan yo'qoladi — bosh sahifaga qaytamiz
        useGameStore.getState().pushToast('info', 'Xona tugadi — yangi o‘yin oching');
        const s = useGameStore.getState();
        s.clearRoom();
        s.resetTo('home');
      }
    });
  };

  return (
    <>
      <div className={`gameover-hero ${teamClass}`}>
        <div style={{ color: winner === 'MAFIA' ? 'var(--blood-2)' : winner === 'TOWN' ? 'var(--gold-2)' : 'var(--pink)', display: 'flex', justifyContent: 'center' }}>
          <Icon name={winner === 'MAFIA' ? 'skull' : winner === 'TOWN' ? 'sun' : 'masks'} size={44} />
        </div>
        <div className="go-title" style={{ color: winner === 'MAFIA' ? 'var(--blood-2)' : winner === 'TOWN' ? 'var(--gold-2)' : 'var(--pink)' }}>
          {winner === 'MAFIA' ? 'MAFIYA YUTDI' : winner === 'TOWN' ? 'SHAHAR YUTDI' : 'MUSTAQIL YUTDI'}
        </div>
        <div className="go-sub serif">{won ? '◆ SIZ G‘OLIB BO‘LDINGIZ ◆' : 'KEYINGI SAFAR OMAD'}</div>
      </div>

      {yourRole && (
        <div className="card row" style={{ gap: 12 }}>
          <div className="achievement-icon" style={{ color: yourRole.color }}>
            <Icon name={yourRole.icon} size={24} />
          </div>
          <div>
            <div className="label">SIZNING ROLINGIZ</div>
            <div className="h2" style={{ color: yourRole.color }}>{yourRole.name}</div>
          </div>
          <span className="spacer" />
          <span className={`badge ${won ? 'badge-green' : 'badge-red'}`}>{won ? 'G‘ALABA' : 'MAG‘LUBIYAT'}</span>
        </div>
      )}

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>HAMMA ROLLAR OCHILDI</div>
        <div className="reveal-list">
          {snapshot.players.map((p) => {
            const rd = p.role ? ROLES[p.role] : null;
            return (
              <div key={p.userId} className="reveal-row" style={{ opacity: p.alive ? 1 : 0.62 }}>
                <span className="badge" style={{ width: 34, justifyContent: 'center' }}>#{p.seat}</span>
                <span className="rv-name">
                  {p.displayName}
                  {p.userId === snapshot.you.userId ? <span className="gold"> — SIZ</span> : ''}
                </span>
                {rd && (
                  <span
                    className="badge"
                    style={{ color: rd.color, borderColor: `${rd.color}66`, background: `${rd.color}1c` }}
                  >
                    {rd.name}
                  </span>
                )}
                {!p.alive && <Icon name="skull" size={13} className="faint" />}
              </div>
            );
          })}
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

/* ---------- PhaseBanner ---------- */

function PhaseBanner({ icon, title, sub, night }: { icon: string; title: string; sub?: string; night?: boolean }) {
  return (
    <div className="phase-banner">
      <span className="phase-icon" style={{ color: night ? 'var(--moon)' : 'var(--gold-2)', display: 'flex', justifyContent: 'center' }}>
        <Icon name={icon} size={30} />
      </span>
      <div className={`phase-title ${night ? 'night' : 'day'}`}>{title}</div>
      {sub && <div className="phase-sub">{sub}</div>}
    </div>
  );
}

/* ---------- Achievement popup ---------- */

function AchievementPopup() {
  const popup = useGameStore((s) => s.achievementPopup);
  if (!popup) return null;
  return (
    <div className="overlay">
      <div className="card-strong" style={{ textAlign: 'center', padding: 30, maxWidth: 300 }}>
        <div className="achievement-icon" style={{ margin: '0 auto 10px', width: 64, height: 64 }}>
          <Icon name="medal" size={30} />
        </div>
        <div className="label gold" style={{ margin: '8px 0 4px' }}>YUTUQ OCHILDI</div>
        <div className="h2 serif">{popup.name}</div>
        <div className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>{popup.description}</div>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 18 }}
          onClick={() => useGameStore.setState({ achievementPopup: null })}
        >
          ZO‘R
        </button>
      </div>
    </div>
  );
}
