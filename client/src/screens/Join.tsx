import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

export function Join() {
  const navigate = useGameStore((s) => s.navigate);
  const pushToast = useGameStore((s) => s.pushToast);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'quick' | 'join' | null>(null);

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

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      pushToast('error', 'Enter a room code');
      return;
    }
    setBusy('join');
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
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={join} disabled={busy === 'join'}>
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
