import { useEffect, useState } from 'react';
import { setSoundEnabled, setVibrationEnabled, loadSoundPrefs } from '../services/sound';
import { getInitData } from '../services/telegram';
import { getBackendUrl, setBackendUrl } from '../config';
import { getSocket } from '../services/socket';
import { ScreenHeader } from '../components/ScreenHeader';
import { useGameStore } from '../store/gameStore';
import { APP_VERSION } from '@truemafia/shared';

export function Settings() {
  const [prefs, setPrefs] = useState(loadSoundPrefs());
  const [backend, setBackend] = useState(getBackendUrl());
  const [saved, setSaved] = useState(false);
  const connected = getSocket().connected;

  const { profile, profileLoading, loadProfile, setNickname } = useGameStore();
  const [nick, setNick] = useState('');
  const [nickSaving, setNickSaving] = useState(false);

  useEffect(() => {
    if (profile === null && !profileLoading) void loadProfile();
  }, [loadProfile, profile, profileLoading]);

  useEffect(() => {
    // profil kelganda inputga hozirgi display_name'ni qo'yamiz (faqat bo'sh bo'lsa)
    if (profile && nick === '') setNick(profile.displayName || profile.username || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const saveNick = async () => {
    if (nickSaving) return;
    setNickSaving(true);
    await setNickname(nick);
    setNickSaving(false);
  };

  const saveBackend = () => {
    setBackendUrl(backend);
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="screen">
      <ScreenHeader title="SOZLAMALAR" />

      <div className="card">
        <div className="toggle-row">
          <span>🔊 Ovoz</span>
          <button
            className={`toggle ${prefs.sound ? 'on' : ''}`}
            onClick={() => {
              setSoundEnabled(!prefs.sound);
              setPrefs({ ...prefs, sound: !prefs.sound });
            }}
          />
        </div>
        <div className="toggle-row">
          <span>📳 Vibratsiya</span>
          <button
            className={`toggle ${prefs.vibro ? 'on' : ''}`}
            onClick={() => {
              setVibrationEnabled(!prefs.vibro);
              setPrefs({ ...prefs, vibro: !prefs.vibro });
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 6 }}>NIK O‘RNATISH</div>
        <div className="dim" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
          O‘yinda ko‘rinadigan ism. 2–24 belgi. Saqlangach Telegram ismingiz ustiga yozilmaydi.
        </div>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value.slice(0, 24))}
          placeholder="Nick..."
          maxLength={24}
          style={{ fontSize: '0.9rem' }}
        />
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 10 }}
          disabled={nickSaving || nick.trim().length < 2}
          onClick={() => void saveNick()}
        >
          {nickSaving ? 'SAQLANMOQDA…' : 'NICK SAQLASH'}
        </button>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 6 }}>ULANISH</div>
        <div className="dim" style={{ fontSize: '0.85rem' }}>
          {getInitData() ? 'Telegram autentifikatsiya faol' : 'Telegram’siz ishlamoqda — mehmon rejimi'}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <span className={`dot ${connected ? '' : 'off'}`} />
          <span className="label">{connected ? 'SERVER ULANGAN' : 'SERVER ULANMAGAN'}</span>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 6 }}>BACKEND URL</div>
        <div className="dim" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
          Render’dagi server manzili. Masalan: https://truemafia-gwgv.onrender.com
        </div>
        <input
          value={backend}
          onChange={(e) => {
            setBackend(e.target.value);
            setSaved(false);
          }}
          placeholder="https://..."
          autoCapitalize="none"
          autoCorrect="off"
          style={{ fontSize: '0.9rem' }}
        />
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={saveBackend}>
          {saved ? 'SAQLANDI — QAYTA YUKLANMOQDA…' : 'SAQLASH VA QAYTA YUKLASH'}
        </button>
      </div>

      <div className="spacer" />
      <div className="ghost-chat-note">NIGHTFALL MAFIA · {APP_VERSION} NOIR</div>
    </div>
  );
}
