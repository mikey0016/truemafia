import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import { initTelegram } from './services/telegram';
import { loadSoundPrefs } from './services/sound';

initTelegram();
loadSoundPrefs();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
