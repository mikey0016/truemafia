import { useEffect, useState } from 'react';
import { MIN_PLAYERS, ROLES, isPremiumRole, shopItemForRole, suggestedRolePlan, type RoleId } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

const ROLE_ICONS: Record<string, string> = {
  user: '👤', skull: '💀', crown: '👑', plus: '➕', search: '🔎',
  shield: '🛡️', knife: '🔪', masks: '🎭', drop: '🩸',
};

export function Lobby() {
  const { roomCode, roomPlayers, roomSettings, rolePicks, myPick, isHost, ready, pickRole } = useGameStore();
  const shopItems = useGameStore((s) => s.shopItems);
  const loadShop = useGameStore((s) => s.loadShop);
  const navigate = useGameStore((s) => s.navigate);

  useEffect(() => {
    if (roomSettings?.roleDraft) void loadShop();
  }, [loadShop, roomSettings?.roleDraft]);
  const pushToast = useGameStore((s) => s.pushToast);
  const navigate = useGameStore((s) => s.navigate);
  const [copied, setCopied] = useState(false);
  const [addingBots, setAddingBots] = useState(false);
  const isDev = import.meta.env.DEV;

  const count = roomPlayers.length;
  const target = roomSettings?.playerCount ?? MIN_PLAYERS;
  const allHere = count >= target;
  const humans = roomPlayers.filter((p) => !p.isBot).length;
  const canStart = isHost && count >= MIN_PLAYERS;

  useEffect(() => {
    if (allHere) {
      playSound('notify');
      hapticNotify('success');
    }
  }, [allHere]);

  const toggleReady = () => {
    haptic('light');
    getSocket().emit('room:ready', { ready: !ready }, () => {});
  };

  const start = (withBots: boolean) => {
    playSound('click');
    haptic('heavy');
    setAddingBots(false);
    getSocket().emit('room:start', { addBots: withBots ? target - count : 0 }, (res) => {
      if (!res.ok) pushToast('error', res.error ?? 'Cannot start');
    });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode ?? '');
      setCopied(true);
      hapticNotify('success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const leave = () => {
    haptic('light');
    getSocket().emit('room:leave', {}, () => {});
    useGameStore.getState().clearRoom();
    useGameStore.getState().resetTo('home');
  };

  if (!roomCode) {
    return (
      <div className="screen">
        <div className="error-state">Not connected to a room. Go back and join one.</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row-between">
        <div>
          <div className="label">ROOM</div>
          <div className="h1 mono gold" onClick={copyCode} style={{ cursor: 'pointer' }}>
            #{roomCode}
          </div>
        </div>
        <button className="badge badge-gold" style={{ padding: '10px 16px', fontSize: '0.75rem' }} onClick={copyCode}>
          {copied ? 'COPIED ✓' : 'COPY CODE'}
        </button>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="label">PLAYERS</span>
          <span className="badge">{count}/{target}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roomPlayers.map((p) => (
            <div key={p.userId} className="list-row" style={{ animation: 'msgIn 0.3s ease' }}>
              <Avatar src={p.photoUrl} name={p.displayName} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.displayName}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className={`dot ${p.connected ? '' : 'off'}`} />
                  <span className="label">{p.connected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
              </div>
              {p.isBot && <span className="badge">BOT</span>}
              {p.ready && <span className="badge badge-green">READY</span>}
              {p.isHost && <span className="crown">👑</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, target - count) }).map((_, i) => (
            <div key={`slot-${i}`} className="list-row" style={{ opacity: 0.45 }}>
              <div className="avatar avatar-md skeleton" />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="spacer" />

      {roomSettings?.roleDraft && (
        <RoleDraftCard
          settings={roomSettings}
          pickedCount={rolePicks.length}
          myPick={myPick}
          onPick={(r) => {
            haptic('light');
            playSound('click');
            pickRole(r);
          }}
        />
      )}

      {allHere && (
        <div className="saved-banner" style={{ padding: 12 }}>
          <span className="gold" style={{ fontWeight: 800, letterSpacing: '0.1em' }}>READY TO START</span>
        </div>
      )}

      {isHost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary btn-block btn-lg" disabled={count < MIN_PLAYERS} onClick={() => start(false)}>
            START GAME
          </button>
          {isDev && count < target && (
            <button className="btn btn-ghost btn-block" onClick={() => start(true)}>
              START WITH BOTS (DEV — ADD {target - count})
            </button>
          )}
          {count < MIN_PLAYERS && (
            <div className="ghost-chat-note">Waiting for at least {MIN_PLAYERS} players…</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-block btn-lg" onClick={toggleReady}>
            {ready ? 'READY ✓' : 'MARK READY'}
          </button>
          <div className="ghost-chat-note">WAITING FOR HOST…</div>
        </div>
      )}
      {humans === 1 && !isDev && (
        <div className="ghost-chat-note">Share the code so friends can join!</div>
      )}
      {isDev && !isHost && (
        <button className="btn btn-ghost btn-block" onClick={() => setAddingBots(!addingBots)}>
          {addingBots ? 'HIDE' : 'DEV: need bots?'}
        </button>
      )}

      <button className="btn btn-ghost btn-block" style={{ color: '#ff6b6b' }} onClick={leave}>
        LEAVE ROOM
      </button>
    </div>
  );
}

function RoleDraftCard({
  settings,
  pickedCount,
  myPick,
  onPick,
}: {
  settings: NonNullable<ReturnType<typeof useGameStore.getState>['roomSettings']>;
  pickedCount: number;
  myPick: RoleId | null;
  onPick: (roleId: RoleId | null) => void;
}) {
  const pool = suggestedRolePlan(settings.playerCount, settings.mafiaCount, settings);
  const counts = new Map<RoleId, number>();
  for (const r of pool) counts.set(r, (counts.get(r) ?? 0) + 1);
  const order = [...counts.keys()];
  const shopItems = useGameStore((s) => s.shopItems);
  const pushToast = useGameStore((s) => s.pushToast);
  const navigate = useGameStore((s) => s.navigate);
  const owned = new Set(shopItems.filter((i) => i.owned).map((i) => i.roleId));

  const tap = (role: RoleId, locked: boolean) => {
    if (locked) {
      const item = shopItemForRole(role);
      pushToast('info', `Marketdan sotib oling — ${item?.price ?? '?'} 🪙`);
      navigate('market');
      return;
    }
    onPick(role);
  };

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="label">ROLE DRAFT — YOPPIQ TANLOV 🕵️</span>
        {myPick && (
          <button className="btn" style={{ height: 30, padding: '0 10px', fontSize: '0.7rem' }} onClick={() => onPick(null)}>
            CLEAR
          </button>
        )}
      </div>
      <div className="dim" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
        {myPick
          ? `Sizning kartangiz: ${ROLES[myPick].name} (boshqalarga ko'rinmaydi 🤫)`
          : 'Karta tanlang — kim nima olgani sir saqlanadi.'}
      </div>
      <div className="dim" style={{ fontSize: '0.78rem', marginBottom: 10 }}>
        Tanladi: {pickedCount} kishi
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {order.map((role) => {
          const def = ROLES[role];
          const mine = myPick === role;
          const locked = !mine && isPremiumRole(role) && !owned.has(role);
          const price = shopItemForRole(role)?.price;
          return (
            <button
              key={role}
              className="list-row card-press"
              style={{ borderColor: mine ? def.color : undefined }}
              onClick={() => (mine ? onPick(null) : tap(role, locked))}
            >
              <span style={{ fontSize: '1.4rem' }}>{locked ? '🔒' : (ROLE_ICONS[def.icon] ?? '🎭')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: def.color }}>{def.name.toUpperCase()}</div>
                <div className="dim" style={{ fontSize: '0.75rem' }}>{def.tagline}</div>
              </div>
              <span className="badge" style={mine ? { borderColor: def.color, color: def.color } : undefined}>
                {mine ? 'SIZNIKI' : locked ? `${price} 🪙` : `×${counts.get(role)}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
