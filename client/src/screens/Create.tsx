import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COUNT_OPTIONS } from '@truemafia/shared';
import type { RoomSettings } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { Icon } from '../components/Icon';
import { getSocket } from '../services/socket';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

export function Create() {
  const navigate = useGameStore((s) => s.navigate);
  const pushToast = useGameStore((s) => s.pushToast);
  const [settings, setSettings] = useState<Partial<RoomSettings>>({
    gameType: 'CLASSIC',
    playerCount: 8,
    mafiaCount: 2,
    donEnabled: true,
    doctorEnabled: true,
    detectiveEnabled: true,
    bodyguardEnabled: false,
    serialKillerEnabled: false,
    jesterEnabled: false,
    discussionSeconds: 180,
    votingSeconds: 60,
    nightSeconds: 45,
    privateRoom: false,
    revealRolesOnDeath: true,
    anonymousVoting: false,
    botCount: 0,
    roleDraft: false,
  });
  const [creating, setCreating] = useState(false);

  const update = (patch: Partial<RoomSettings>) => {
    haptic('light');
    setSettings((s) => ({ ...s, ...patch }));
  };

  const create = () => {
    if (!getSocket().connected) {
      haptic('medium');
      useGameStore.getState().setPendingAction(() => create());
      pushToast('info', 'Server uyg‘onmoqda — ulanishi kutilmoqda…');
      return;
    }
    setCreating(true);
    playSound('click');
    haptic('medium');
    getSocket()
      .timeout(10000)
      .emit('room:create', { settings }, (err: unknown, res?: { ok: boolean; error?: string }) => {
        setCreating(false);
        if (err) {
          hapticNotify('error');
          pushToast('error', 'Server javob bermadi — keyinroq urinib ko‘ring');
          return;
        }
        if (!res?.ok) {
          hapticNotify('error');
          pushToast('error', res?.error ?? 'Xona ochilmadi');
          return;
        }
        hapticNotify('success');
      });
  };

  return (
    <div className="screen">
      <div className="row-between">
        <button className="btn btn-ghost" style={{ minHeight: 0, padding: '9px 13px' }} onClick={() => navigate('home')}>
          <Icon name="back" size={16} />
        </button>
        <div className="h1" style={{ flex: 1, textAlign: 'center', marginRight: 52 }}>XONA OCHISH</div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>O‘YINCHILAR</div>
        <div className="chip-row">
          {PLAYER_COUNT_OPTIONS.filter((n) => n >= MIN_PLAYERS && n <= MAX_PLAYERS).map((n) => (
            <button key={n} className={`chip ${settings.playerCount === n ? 'active' : ''}`} onClick={() => update({ playerCount: n })}>
              {n}
            </button>
          ))}
        </div>

        <div className="label" style={{ margin: '14px 0 10px' }}>MAFIYA SONI</div>
        <div className="chip-row">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={`chip ${settings.mafiaCount === n ? 'active' : ''}`} onClick={() => update({ mafiaCount: n })}>
              {n}
            </button>
          ))}
        </div>

        <div className="label" style={{ margin: '14px 0 10px' }}>O‘YIN TURI</div>
        <div className="chip-row">
          {(['CLASSIC', 'ADVANCED', 'CUSTOM'] as const).map((t) => (
            <button
              key={t}
              className={`chip ${settings.gameType === t ? 'active' : ''}`}
              onClick={() => {
                update({ gameType: t });
                if (t === 'CLASSIC') update({ donEnabled: true, doctorEnabled: true, detectiveEnabled: true, bodyguardEnabled: false, serialKillerEnabled: false, jesterEnabled: false });
                if (t === 'ADVANCED') update({ bodyguardEnabled: true, jesterEnabled: true });
                if (t === 'CUSTOM') update({ bodyguardEnabled: true });
              }}
            >
              {t === 'CLASSIC' ? 'KLASSIK' : t === 'ADVANCED' ? 'KENGAYTIRILGAN' : 'MAXSUS'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 4 }}>ROLLAR</div>
        {(
          [
            ['donEnabled', 'Don', 'crown'],
            ['doctorEnabled', 'Doktor', 'plus'],
            ['detectiveEnabled', 'Detektiv', 'search'],
            ['bodyguardEnabled', 'Tansoqchi', 'shield'],
            ['serialKillerEnabled', 'Seriyali qotil', 'knife'],
            ['jesterEnabled', 'Masxaraboz', 'masks'],
          ] as const
        ).map(([key, label, icon]) => (
          <div key={key} className="toggle-row">
            <span className="row" style={{ gap: 9, fontWeight: 600 }}>
              <span style={{ color: 'var(--text-2)', display: 'flex' }}>
                <Icon name={icon} size={17} />
              </span>
              {label}
            </span>
            <button
              className={`toggle ${settings[key] ? 'on' : ''}`}
              onClick={() => update({ [key]: !settings[key] } as Partial<RoomSettings>)}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>TAYMERLAR (SONIYA)</div>
        {(
          [
            ['discussionSeconds', 'Muhokama', 30, 600],
            ['votingSeconds', 'Ovoz berish', 15, 300],
            ['nightSeconds', 'Tun', 15, 300],
          ] as const
        ).map(([key, label, min, max]) => (
          <div key={key} className="toggle-row">
            <span style={{ fontWeight: 600 }}>{label}</span>
            <div className="row">
              <button className="chip" onClick={() => update({ [key]: Math.max(min, (settings[key] ?? 60) - 15) } as Partial<RoomSettings>)}>−</button>
              <span className="mono" style={{ width: 44, textAlign: 'center', fontWeight: 800 }}>{settings[key]}</span>
              <button className="chip" onClick={() => update({ [key]: Math.min(max, (settings[key] ?? 60) + 15) } as Partial<RoomSettings>)}>＋</button>
            </div>
          </div>
        ))}
        <div className="toggle-row">
          <span style={{ fontWeight: 600 }}>Yopiq xona</span>
          <button className={`toggle ${settings.privateRoom ? 'on' : ''}`} onClick={() => update({ privateRoom: !settings.privateRoom })} />
        </div>
        <div className="toggle-row">
          <span style={{ fontWeight: 600 }}>O‘lganda rolni ko‘rsatish</span>
          <button className={`toggle ${settings.revealRolesOnDeath ? 'on' : ''}`} onClick={() => update({ revealRolesOnDeath: !settings.revealRolesOnDeath })} />
        </div>
        <div className="toggle-row">
          <span style={{ fontWeight: 600 }}>Yashirin ovoz berish</span>
          <button className={`toggle ${settings.anonymousVoting ? 'on' : ''}`} onClick={() => update({ anonymousVoting: !settings.anonymousVoting })} />
        </div>
        <div className="toggle-row">
          <span style={{ fontWeight: 600 }}>🎴 Rol tanlash <span className="dim" style={{ fontSize: '0.72rem' }}>(kartani o‘zing tanla)</span></span>
          <button className={`toggle ${settings.roleDraft ? 'on' : ''}`} onClick={() => update({ roleDraft: !settings.roleDraft })} />
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>🤖 BOTLAR</div>
        <div className="chip-row">
          {[0, 1, 3, 5, 7].filter((n) => n < (settings.playerCount ?? 8)).map((n) => (
            <button key={n} className={`chip ${settings.botCount === n ? 'active' : ''}`} onClick={() => update({ botCount: n })}>
              {n === 0 ? 'Yo‘q' : `+${n}`}
            </button>
          ))}
        </div>
        <div className="dim" style={{ fontSize: '0.74rem', marginTop: 8 }}>
          Botli o‘yinlar reytingga yozilmaydi (casual).
        </div>
      </div>

      <div className="spacer" />
      <button className="btn btn-primary btn-block btn-lg" disabled={creating} onClick={create}>
        {creating ? 'OCHILMOQDA…' : 'XONANI OCHISH'}
      </button>
    </div>
  );
}
