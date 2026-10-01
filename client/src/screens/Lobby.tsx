import { useEffect, useState } from 'react';
import { MIN_PLAYERS } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

export function Lobby() {
  const { roomCode, roomPlayers, roomSettings, rolePicks, mySlot, isHost, ready, pickRole, updateRoomSettings } =
    useGameStore();
  const pushToast = useGameStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  const isDev = import.meta.env.DEV;

  const count = roomPlayers.length;
  const target = roomSettings?.playerCount ?? MIN_PLAYERS;
  const allHere = count >= target;
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
    getSocket().emit('room:start', { addBots: withBots ? target - count : 0 }, (res) => {
      if (!res.ok) pushToast('error', res.error ?? 'Boshlab bo‘lmadi');
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
        <div className="error-state">Xonaga ulanmagansiz. Orqaga qaytib, biriga qo‘shiling.</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row-between">
        <div>
          <div className="label">XONA KODI</div>
          <div className="room-code" onClick={copyCode}>
            {roomCode}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ minHeight: 0, padding: '10px 14px', fontSize: '0.72rem' }} onClick={copyCode}>
          {copied ? 'NUSXALANDI ✓' : 'NUSXALASH'}
        </button>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="label">O‘YINCHILAR</span>
          <span className="badge badge-gold">{count}/{target}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roomPlayers.map((p) => (
            <div key={p.userId} className="lobby-row">
              <Avatar src={p.photoUrl} name={p.displayName} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.displayName}
                  {p.title ? <span className="badge badge-gold" style={{ marginLeft: 6, fontSize: '0.52rem', padding: '2px 7px' }}>«{p.title}»</span> : null}
                </div>
                {p.isBot ? (
                  <div className="label" style={{ color: 'var(--text-3)' }}>O‘YINCHI-BOT</div>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`dot ${p.connected ? '' : 'off'}`} />
                    <span className="label">{p.connected ? 'ONLAYN' : 'OFLAYN'}</span>
                  </div>
                )}
              </div>
              {p.isBot && <span className="badge">BOT</span>}
              {p.ready && <span className="badge badge-green">TAYYOR</span>}
              {p.isHost && <span className="crown">👑</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, target - count) }).map((_, i) => (
            <div key={`slot-${i}`} className="lobby-row" style={{ opacity: 0.4 }}>
              <div className="avatar avatar-md skeleton" />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>SOZLAMALAR</div>
        <div className="settings-summary">
          <span className="badge badge-gold">{roomSettings?.playerCount ?? '—'} O‘YINCHI</span>
          <span className="badge badge-red">{roomSettings?.mafiaCount ?? '—'} MAFIYA</span>
          <span className="badge">{roomSettings?.gameType === 'CLASSIC' ? 'KLASSIK' : roomSettings?.gameType === 'ADVANCED' ? 'KENGAYTIRILGAN' : 'MAXSUS'}</span>
          {roomSettings?.roleDraft && <span className="badge badge-moon">🎴 KARTA TANLASH</span>}
          {roomSettings?.anonymousVoting && <span className="badge">🔒 YASHIRIN OVOZ</span>}
        </div>

        {isHost && roomSettings && (
          <>
            <div className="divider" style={{ margin: '12px 0 4px' }} />
            <div className="label" style={{ margin: '8px 0 2px' }}>OVOZ USULI (HOST)</div>
            <div className="toggle-row">
              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                🔒 Yashirin ovoz
                <span className="dim" style={{ fontSize: '0.72rem', display: 'block' }}>
                  Kim kimga ovoz bergani ko‘rinmaydi
                </span>
              </span>
              <button
                className={`toggle ${roomSettings.anonymousVoting ? 'on' : ''}`}
                onClick={() => {
                  haptic('light');
                  updateRoomSettings({ anonymousVoting: !roomSettings.anonymousVoting });
                }}
              />
            </div>
            <div className="toggle-row">
              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                💀 O‘lganda rolni ko‘rsatish
              </span>
              <button
                className={`toggle ${roomSettings.revealRolesOnDeath ? 'on' : ''}`}
                onClick={() => {
                  haptic('light');
                  updateRoomSettings({ revealRolesOnDeath: !roomSettings.revealRolesOnDeath });
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="spacer" />

      {roomSettings?.roleDraft && (
        <RoleDraftCard
          settings={roomSettings}
          pickedCount={rolePicks.length}
          mySlot={mySlot}
          onPick={(s) => {
            haptic('light');
            playSound('click');
            pickRole(s);
          }}
        />
      )}

      {allHere && (
        <div className="done-banner">
          <Icon name="check" size={15} />
          BOSHLASHGA TAYYOR
        </div>
      )}

      {isHost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary btn-block btn-lg" disabled={!canStart} onClick={() => start(false)}>
            BOSHLASH
          </button>
          {isDev && count < target && (
            <button className="btn btn-ghost btn-block" onClick={() => start(true)}>
              BOTLAR BILAN BOSHLASH (DEV — {target - count} QO‘SHISH)
            </button>
          )}
          {!canStart && (
            <div className="ghost-chat-note">Kamida {MIN_PLAYERS} o‘yinchi kutilmoqda…</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className={`btn btn-block btn-lg ${ready ? 'btn-primary' : ''}`} onClick={toggleReady}>
            {ready ? 'TAYYORMAN ✓' : 'TAYYORLIGINI BILDIRISH'}
          </button>
          <div className="ghost-chat-note">HOST KUTILMOQDA…</div>
        </div>
      )}

      <button className="btn btn-ghost btn-block" style={{ color: 'var(--blood-2)' }} onClick={leave}>
        XONADAN CHIQISH
      </button>
    </div>
  );
}

/**
 * Yopiq (blind) rol draft'i: har bir karta — faqat pozitsiya.
 * Karta ortida qaysi rol turgani faqat server biladi; o'yin boshlanganda
 * RoleCard komponenti orqali ochiladi.
 */
function RoleDraftCard({
  settings,
  pickedCount,
  mySlot,
  onPick,
}: {
  settings: NonNullable<ReturnType<typeof useGameStore.getState>['roomSettings']>;
  pickedCount: number;
  mySlot: number | null;
  onPick: (slot: number | null) => void;
}) {
  const myUserId = useGameStore((s) => s.tgUserId);
  const rolePicks = useGameStore((s) => s.rolePicks);
  const taken = new Set(rolePicks.filter((p) => p.userId !== myUserId).map((p) => p.slot));
  const total = Math.max(0, settings.playerCount);

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="label">ROL TANLASH — YOPIQ TANLOV 🕵️</span>
        <span className="badge badge-gold">Tanladi: {pickedCount}</span>
      </div>
      <div className="dim" style={{ fontSize: '0.76rem', marginBottom: 10 }}>
        Kartani tanlang — ichida qanday rol borligini hech kim bilmaydi.
      </div>

      <div className="draft-grid">
        {Array.from({ length: total }, (_, i) => {
          const mine = mySlot === i;
          const takenByOther = !mine && taken.has(i);
          return (
            <button
              key={i}
              className={`draft-card${mine ? ' mine' : ''}${takenByOther ? ' taken' : ''}`}
              disabled={takenByOther}
              onClick={() => onPick(mine ? null : i)}
            >
              <span className="dc-num">{i + 1}</span>
              <span className="dc-state">{mine ? 'SIZNIKI' : takenByOther ? 'OLINGAN' : 'YOPIQ'}</span>
            </button>
          );
        })}
      </div>

      {mySlot !== null && (
        <div className="done-banner" style={{ marginTop: 10 }}>
          Karta tanlandi — rolingiz o‘yinda ochiladi 🤫
        </div>
      )}
    </div>
  );
}
