import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COUNT_OPTIONS } from '@truemafia/shared';
import type { RoomSettings } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
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
  });
  const [creating, setCreating] = useState(false);
  const [bots, setBots] = useState(0);

  const isDev = import.meta.env.DEV;

  const update = (patch: Partial<RoomSettings>) => {
    haptic('light');
    setSettings((s) => ({ ...s, ...patch }));
  };

  const create = () => {
    if (!getSocket().connected) {
      hapticNotify('error');
      pushToast('error', 'Backend ulanmagan — Settings’da server URL’ni kiriting');
      return;
    }
    setCreating(true);
    playSound('click');
    haptic('medium');
    // timeout: server javob bermasa abadiy "CREATING…" da qotib qolmaydi
    getSocket()
      .timeout(10000)
      .emit('room:create', { settings, demoBots: bots }, (err: unknown, res?: { ok: boolean; error?: string }) => {
        setCreating(false);
        if (err) {
          hapticNotify('error');
          pushToast('error', 'Server javob bermadi — keyinroq urinib ko‘ring');
          return;
        }
        if (!res?.ok) {
          hapticNotify('error');
          pushToast('error', res?.error ?? 'Failed to create room');
          return;
        }
        hapticNotify('success');
      });
  };

  return (
    <div className="screen">
      <div className="row-between">
        <div className="h1">CREATE ROOM</div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>PLAYERS</div>
        <div className="chip-row">
          {PLAYER_COUNT_OPTIONS.filter((n) => n >= MIN_PLAYERS && n <= MAX_PLAYERS).map((n) => (
            <button key={n} className={`chip ${settings.playerCount === n ? 'active' : ''}`} onClick={() => update({ playerCount: n })}>
              {n}
            </button>
          ))}
        </div>

        <div className="label" style={{ margin: '14px 0 10px' }}>MAFIA</div>
        <div className="chip-row">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={`chip ${settings.mafiaCount === n ? 'active' : ''}`} onClick={() => update({ mafiaCount: n })}>
              {n}
            </button>
          ))}
        </div>

        <div className="label" style={{ margin: '14px 0 10px' }}>GAME TYPE</div>
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
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 4 }}>ROLES</div>
        {(
          [
            ['donEnabled', 'Don'],
            ['doctorEnabled', 'Doctor'],
            ['detectiveEnabled', 'Detective'],
            ['bodyguardEnabled', 'Bodyguard'],
            ['serialKillerEnabled', 'Serial Killer'],
            ['jesterEnabled', 'Jester'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="toggle-row">
            <span>{label}</span>
            <button
              className={`toggle ${settings[key] ? 'on' : ''}`}
              onClick={() => update({ [key]: !settings[key] } as Partial<RoomSettings>)}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>TIMERS (SECONDS)</div>
        {(
          [
            ['discussionSeconds', 'Discussion', 30, 600],
            ['votingSeconds', 'Voting', 15, 300],
            ['nightSeconds', 'Night', 15, 300],
          ] as const
        ).map(([key, label, min, max]) => (
          <div key={key} className="toggle-row">
            <span>{label}</span>
            <div className="row">
              <button className="chip" onClick={() => update({ [key]: Math.max(min, (settings[key] ?? 60) - 15) } as Partial<RoomSettings>)}>−</button>
              <span className="mono" style={{ width: 44, textAlign: 'center', fontWeight: 800 }}>{settings[key]}</span>
              <button className="chip" onClick={() => update({ [key]: Math.min(max, (settings[key] ?? 60) + 15) } as Partial<RoomSettings>)}>＋</button>
            </div>
        </div>
        ))}
        <div className="toggle-row">
          <span>Private room</span>
          <button className={`toggle ${settings.privateRoom ? 'on' : ''}`} onClick={() => update({ privateRoom: !settings.privateRoom })} />
        </div>
        <div className="toggle-row">
          <span>Reveal roles on death</span>
          <button className={`toggle ${settings.revealRolesOnDeath ? 'on' : ''}`} onClick={() => update({ revealRolesOnDeath: !settings.revealRolesOnDeath })} />
        </div>
        <div className="toggle-row">
          <span>Anonymous voting</span>
          <button className={`toggle ${settings.anonymousVoting ? 'on' : ''}`} onClick={() => update({ anonymousVoting: !settings.anonymousVoting })} />
        </div>
      </div>

      {isDev && (
        <div className="card">
          <div className="label" style={{ marginBottom: 10 }}>DEMO BOTS (DEV ONLY)</div>
          <div className="chip-row">
            {[0, 3, 5, 7].map((n) => (
              <button key={n} className={`chip ${bots === n ? 'active' : ''}`} onClick={() => setBots(n)}>
                {n === 0 ? 'None' : `+${n}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="spacer" />
      <button className="btn btn-primary btn-block btn-lg" disabled={creating} onClick={create}>
        {creating ? 'CREATING…' : 'CREATE ROOM'}
      </button>
    </div>
  );
}
