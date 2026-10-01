import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

export function Join() {
  const navigate = useGameStore((s) => s.navigate);
  const pushToast = useGameStore((s) => s.pushToast);
  const { openRooms, openRoomsLoading, openRoomsError, loadOpenRooms } = useGameStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'quick' | 'join' | string | null>(null);

  useEffect(() => {
    void loadOpenRooms();
  }, [loadOpenRooms]);

  const quick = () => {
    setBusy('quick');
    playSound('click');
    haptic('medium');
    getSocket().emit('room:quick', {}, (res) => {
      setBusy(null);
      if (!res.ok) {
        hapticNotify('error');
        pushToast('error', res.error ?? 'No open rooms');
      }
    });
  };

  const join = (roomCode?: string) => {
    const c = (roomCode ?? code).trim().toUpperCase();
    if (c.length < 4) {
      pushToast('error', 'Enter a room code');
      return;
    }
    setBusy(roomCode ? `room:${c}` : 'join');
    playSound('click');
    haptic('medium');
    getSocket().emit('room:join', { code: c }, (res) => {
      setBusy(null);
      if (!res.ok) {
        hapticNotify('error');
        pushToast('error', res.error ?? 'Room not found');
      }
    });
  };

  return (
    <div className="screen">
      <div className="h1">FIND A GAME</div>

      <button className="play-hero" onClick={quick} disabled={busy === 'quick'}>
        <div className="play-title" style={{ fontSize: '1.5rem' }}>QUICK GAME</div>
        <div className="label" style={{ color: 'var(--text-dim)', marginTop: 6 }}>
          {busy === 'quick' ? 'SEARCHING' : 'AUTO-MATCHMAKING'}
        </div>
      </button>

      <div className="divider" style={{ margin: '6px 0' }} />

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="label">OPEN ROOMS {openRooms.length > 0 && `(${openRooms.length})`}</div>
          <button
            className="btn"
            style={{ height: 32, padding: '0 12px', fontSize: '0.75rem' }}
            onClick={() => void loadOpenRooms()}
            disabled={openRoomsLoading}
          >
            {openRoomsLoading ? '…' : '↻ REFRESH'}
          </button>
        </div>
        {openRoomsLoading && openRooms.length === 0 && <div className="dim">Loading rooms…</div>}
        {openRoomsError && openRooms.length === 0 && !openRoomsLoading && (
          <div className="dim">Backend ulanmagan — xonalar ko'rinmayabdi ({openRoomsError})</div>
        )}
        {!openRoomsLoading && !openRoomsError && openRooms.length === 0 && (
          <div className="dim">No open rooms — create one!</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {openRooms.map((r) => (
            <button
              key={r.code}
              className="list-row card-press"
              onClick={() => join(r.code)}
              disabled={busy !== null}
            >
              <span style={{ fontWeight: 800, letterSpacing: '0.2em' }}>{r.code}</span>
              <span className="spacer" />
              <span className="dim" style={{ fontSize: '0.8rem' }}>
                {r.players}/{r.maxPlayers}
              </span>
              <span className="badge badge-green" style={{ marginLeft: 8 }}>
                {busy === `room:${r.code}` ? '…' : 'JOIN'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="divider" style={{ margin: '6px 0' }} />

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>JOIN BY CODE</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A7F29"
          maxLength={8}
          autoCapitalize="characters"
          style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.35em' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') join();
          }}
        />
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => join()} disabled={busy === 'join'}>
          {busy === 'join' ? 'JOINING…' : 'JOIN ROOM'}
        </button>
      </div>

      <div className="spacer" />
      <div className="empty-state" style={{ padding: 12 }}>
        No friends online? Share your room code after creating one.
      </div>
    </div>
  );
}
