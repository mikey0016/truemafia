import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Icon } from '../components/Icon';
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
    if (!getSocket().connected) {
      haptic('medium');
      useGameStore.getState().setPendingAction(() => quick());
      pushToast('info', 'Server uyg‘onmoqda — ulanishi kutilmoqda…');
      return;
    }
    setBusy('quick');
    playSound('click');
    haptic('medium');
    getSocket()
      .timeout(10000)
      .emit('room:quick', {}, (err: unknown, res?: { ok: boolean; error?: string }) => {
        setBusy(null);
        if (err) {
          hapticNotify('error');
          pushToast('error', 'Server javob bermadi — keyinroq urinib ko‘ring');
          return;
        }
        if (!res?.ok) {
          hapticNotify('error');
          pushToast('error', res?.error ?? 'Ochiq xona yo‘q');
        }
      });
  };

  const join = (roomCode?: string) => {
    const c = (roomCode ?? code).trim().toUpperCase();
    if (c.length < 4) {
      pushToast('error', 'Xona kodini kiriting');
      return;
    }
    if (!getSocket().connected) {
      hapticNotify('error');
      pushToast('error', 'Server uyg‘onmoqda — 30-60 soniya kuting va qayta bosing');
      return;
    }
    setBusy(roomCode ? `room:${c}` : 'join');
    playSound('click');
    haptic('medium');
    getSocket()
      .timeout(10000)
      .emit('room:join', { code: c }, (err: unknown, res?: { ok: boolean; error?: string }) => {
        setBusy(null);
        if (err) {
          hapticNotify('error');
          pushToast('error', 'Server javob bermadi — keyinroq urinib ko‘ring');
          return;
        }
        if (!res?.ok) {
          hapticNotify('error');
          pushToast('error', res?.error ?? 'Xona topilmadi');
        }
      });
  };

  return (
    <div className="screen">
      <div className="row-between">
        <button className="btn btn-ghost" style={{ minHeight: 0, padding: '9px 13px' }} onClick={() => navigate('home')}>
          <Icon name="back" size={16} />
        </button>
        <div className="h1" style={{ flex: 1, textAlign: 'center', marginRight: 52 }}>O‘YIN TOPISH</div>
      </div>

      <button className="play-hero" onClick={quick} disabled={busy === 'quick'} style={{ padding: '26px 22px' }}>
        <div style={{ color: 'var(--gold)', marginBottom: 6 }}>
          <Icon name="target" size={30} />
        </div>
        <div className="play-title" style={{ fontSize: '1.5rem' }}>TEZ O‘YIN</div>
        <div className="label" style={{ color: 'var(--text-2)', marginTop: 8, letterSpacing: '0.24em' }}>
          {busy === 'quick' ? 'QIDIRILMOQDA…' : 'AVTO-TANLASH'}
        </div>
      </button>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div className="label">OCHIQ XONALAR {openRooms.length > 0 && `(${openRooms.length})`}</div>
          <button
            className="btn"
            style={{ minHeight: 0, height: 32, padding: '0 12px', fontSize: '0.72rem' }}
            onClick={() => void loadOpenRooms()}
            disabled={openRoomsLoading}
          >
            {openRoomsLoading ? '…' : '↻ YANGILASH'}
          </button>
        </div>
        {openRoomsLoading && openRooms.length === 0 && <div className="dim">Xonalar yuklanmoqda…</div>}
        {openRoomsError && openRooms.length === 0 && !openRoomsLoading && (
          <div className="dim">Backend ulanmagan — xonalar ko‘rinmayabdi ({openRoomsError})</div>
        )}
        {!openRoomsLoading && !openRoomsError && openRooms.length === 0 && (
          <div className="dim">Ochiq xona yo‘q — o‘zingiz oching!</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {openRooms.map((r) => (
            <button key={r.code} className="list-row card-press" onClick={() => join(r.code)} disabled={busy !== null}>
              <span className="serif" style={{ fontWeight: 800, letterSpacing: '0.24em' }}>{r.code}</span>
              <span className="spacer" />
              <span className="dim mono" style={{ fontSize: '0.8rem' }}>
                {r.players}/{r.maxPlayers}
              </span>
              <span className="badge badge-green" style={{ marginLeft: 8 }}>
                {busy === `room:${r.code}` ? '…' : 'KIRISH'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>KOD ORQALI KIRISH</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A7F29"
          maxLength={8}
          autoCapitalize="characters"
          className="serif"
          style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.35em' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') join();
          }}
        />
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => join()} disabled={busy === 'join'}>
          {busy === 'join' ? 'KIRILMOQDA…' : 'XONAGA KIRISH'}
        </button>
      </div>

      <div className="spacer" />
      <div className="ghost-chat-note" style={{ textAlign: 'center', padding: 12 }}>
        Do‘stlaringiz onlayn emasmi? Xona ochib, kodini ulashing.
      </div>
    </div>
  );
}
