import { useEffect, useState } from 'react';
import { MIN_PLAYERS } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

export function Lobby() {
  const { roomCode, roomPlayers, roomSettings, rolePicks, mySlot, isHost, ready, pickRole } = useGameStore();
  const pushToast = useGameStore((s) => s.pushToast);
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
          <div className="label">XONA</div>
          <div className="h1 mono gold" onClick={copyCode} style={{ cursor: 'pointer' }}>
            #{roomCode}
          </div>
        </div>
        <button className="badge badge-gold" style={{ padding: '10px 16px', fontSize: '0.75rem' }} onClick={copyCode}>
          {copied ? 'NUSXALANDI ✓' : 'KODNI NUSXALASH'}
        </button>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="label">O‘YINCHILAR</span>
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
                  <span className="label">{p.connected ? 'ONLAYN' : 'OFLAYN'}</span>
                </div>
              </div>
              {p.isBot && <span className="badge">BOT</span>}
              {p.ready && <span className="badge badge-green">TAYYOR</span>}
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
          mySlot={mySlot}
          onPick={(s) => {
            haptic('light');
            playSound('click');
            pickRole(s);
          }}
        />
      )}

      {allHere && (
        <div className="saved-banner" style={{ padding: 12 }}>
          <span className="gold" style={{ fontWeight: 800, letterSpacing: '0.1em' }}>BOSHLASHGA TAYYOR</span>
        </div>
      )}

      {isHost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-primary btn-block btn-lg" disabled={count < MIN_PLAYERS} onClick={() => start(false)}>
            BOSHLASH
          </button>
          {isDev && count < target && (
            <button className="btn btn-ghost btn-block" onClick={() => start(true)}>
              BOTLAR BILAN BOSHLASH (DEV — {target - count} QO‘SHISH)
            </button>
          )}
          {count < MIN_PLAYERS && (
            <div className="ghost-chat-note">Kamida {MIN_PLAYERS} o‘yinchi kutilmoqda…</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-block btn-lg" onClick={toggleReady}>
            {ready ? 'TAYYORMAN ✓' : 'TAYYORLIGINI BILDIRISH'}
          </button>
          <div className="ghost-chat-note">HOST KUTILMOQDA…</div>
        </div>
      )}
      {humans === 1 && !isDev && (
        <div className="ghost-chat-note">Kodini do‘stlaringizga ulashing, qo‘shilishsin!</div>
      )}
      {isDev && !isHost && (
        <button className="btn btn-ghost btn-block" onClick={() => setAddingBots(!addingBots)}>
          {addingBots ? 'YASHIRISH' : 'DEV: bot kerakmi?'}
        </button>
      )}

      <button className="btn btn-ghost btn-block" style={{ color: '#ff6b6b' }} onClick={leave}>
        XONADAN CHIQISH
      </button>
    </div>
  );
}

/**
 * Yopiq (blind) rol draft'i: har bir karta — faqat pozitsiya.
 * Karta ortida qaysi rol turgani faqat server biladi; o'yin boshlanganda
 * RoleCard komponenti orqali ochiladi. Premium-rol egaligi server tomonda
 * tekshiriladi, shuning uchun mijozda narx/qulf UI'si yo'q.
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
        <span className="label">ROL TANLASH — YOPPIQ TANLOV 🕵️</span>
        <span className="badge badge-gold">Tanladi: {pickedCount}</span>
      </div>
      <div className="dim" style={{ fontSize: '0.78rem', marginBottom: 10 }}>
        Karta tanlang — kartada qanday rol borligini hech kim, hatto siz ham bilmaysiz.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8 }}>
        {Array.from({ length: total }, (_, i) => {
          const mine = mySlot === i;
          const takenByOther = !mine && taken.has(i);
          return (
            <button
              key={i}
              className={`card card-press${mine ? ' badge-gold' : ''}`}
              disabled={takenByOther}
              onClick={() => onPick(mine ? null : i)}
              style={{
                padding: '14px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: takenByOther ? 'not-allowed' : 'pointer',
                opacity: takenByOther ? 0.35 : 1,
                borderColor: mine ? 'var(--gold)' : undefined,
                boxShadow: mine ? '0 0 0 2px rgba(232, 193, 90, 0.35)' : undefined,
              }}
            >
              <span style={{ fontSize: '1.5rem', filter: takenByOther ? 'grayscale(1)' : undefined }}>
                {takenByOther ? '✖️' : '🂠'}
              </span>
              <span className="label">{i + 1}</span>
              <span className={`badge${mine ? ' badge-gold' : ''}`}>
                {mine ? 'SIZNIKI' : takenByOther ? 'OLINGAN' : 'YOPIQ'}
              </span>
            </button>
          );
        })}
      </div>

      {mySlot !== null && (
        <div className="saved-banner" style={{ padding: 10, marginTop: 10 }}>
          <span className="gold" style={{ fontWeight: 800, letterSpacing: '0.06em' }}>
            Karta yopiq — rolingiz o‘yinni boshlashda ochiladi 🤫
          </span>
        </div>
      )}
      <div className="spacer" />
      <div className="dim" style={{ fontSize: '0.72rem', textAlign: 'center' }}>
        Tanladi: {pickedCount} kishi
      </div>
    </div>
  );
}
