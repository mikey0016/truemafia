import { useState } from 'react';
import { setSoundEnabled, setVibrationEnabled, loadSoundPrefs } from '../services/sound';
import { getInitData } from '../services/telegram';

export function Settings() {
  const [prefs, setPrefs] = useState(loadSoundPrefs());

  return (
    <div className="screen">
      <div className="h1">SETTINGS</div>

      <div className="card">
        <div className="toggle-row">
          <span>🔊 Sound</span>
          <button
            className={`toggle ${prefs.sound ? 'on' : ''}`}
            onClick={() => {
              setSoundEnabled(!prefs.sound);
              setPrefs({ ...prefs, sound: !prefs.sound });
            }}
          />
        </div>
        <div className="toggle-row">
          <span>📳 Vibration</span>
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
        <div className="label" style={{ marginBottom: 6 }}>CONNECTION</div>
        <div className="dim" style={{ fontSize: '0.85rem' }}>
          {getInitData() ? 'Telegram authentication active' : 'Running outside Telegram — dev mode'}
        </div>
      </div>

      <div className="spacer" />
      <div className="ghost-chat-note">TRUE MAFIA · v1.0.1</div>
    </div>
  );
}
