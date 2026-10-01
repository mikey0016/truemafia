import { useState } from 'react';
import { setSoundEnabled, setVibrationEnabled, loadSoundPrefs } from '../services/sound';
import { getInitData } from '../services/telegram';
import { getBackendUrl, setBackendUrl } from '../config';
import { getSocket } from '../services/socket';

export function Settings() {
  const [prefs, setPrefs] = useState(loadSoundPrefs());
  const [backend, setBackend] = useState(getBackendUrl());
  const [saved, setSaved] = useState(false);
  const connected = getSocket().connected;

  const saveBackend = () => {
    setBackendUrl(backend);
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="screen">
      <div className="h1">SOZLAMALAR</div>

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
      <div className="ghost-chat-note">NIGHTFALL MAFIA · v1.4.0</div>
    </div>
  );
}
