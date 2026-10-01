import { useEffect } from 'react';
import { useSocketBridge } from './hooks/socketBridge';
import { useGameStore } from './store/gameStore';
import { Toasts } from './components/Toasts';
import { Home } from './screens/Home';
import { Create } from './screens/Create';
import { Join } from './screens/Join';
import { Lobby } from './screens/Lobby';
import { Game } from './screens/Game';
import { Profile } from './screens/Profile';
import { History } from './screens/History';
import { Leaderboard } from './screens/Leaderboard';
import { Achievements } from './screens/Achievements';
import { Settings } from './screens/Settings';
import { Market } from './screens/Market';
import { Admin } from './screens/Admin';
import { hideMainButton } from './services/telegram';

/** Faol o'yin fazasiga qarab osmon mavzusi (tun/kun) */
function skyTheme(): string {
  const s = useGameStore.getState();
  if (s.screen === 'game' && s.snapshot) {
    const p = s.snapshot.phase.phase;
    if (p === 'NIGHT' || p === 'NIGHT_RESULT' || p === 'ROLE_REVEAL') return 'theme-night';
    if (p === 'DAY' || p === 'DISCUSSION' || p === 'VOTING' || p === 'VOTE_RESULT') return 'theme-day';
  }
  return 'theme-lobby';
}

export function App() {
  useSocketBridge();
  const screen = useGameStore((s) => s.screen);
  const phase = useGameStore((s) => s.snapshot?.phase.phase);

  useEffect(() => {
    hideMainButton();
  }, []);

  // Osmon mavzusi: o'yin fazasiga qarab tun/kun
  useEffect(() => {
    const apply = () => {
      const el = document.querySelector('.sky');
      if (el) el.className = `sky ${skyTheme()}`;
    };
    apply();
    const iv = setInterval(apply, 1000);
    return () => clearInterval(iv);
  }, [screen, phase]);

  let content: React.ReactNode;
  switch (screen) {
    case 'home':
      content = <Home />;
      break;
    case 'create':
      content = <Create />;
      break;
    case 'join':
      content = <Join />;
      break;
    case 'lobby':
      content = <Lobby />;
      break;
    case 'game':
      content = <Game />;
      break;
    case 'profile':
      content = <Profile />;
      break;
    case 'history':
      content = <History />;
      break;
    case 'leaderboard':
      content = <Leaderboard />;
      break;
    case 'achievements':
      content = <Achievements />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    case 'market':
      content = <Market />;
      break;
    case 'admin':
      content = <Admin />;
      break;
    default:
      content = <Home />;
  }

  return (
    <>
      <div className="sky theme-lobby">
        <div className="sky-orb" />
      </div>
      <div className="app">
        <Toasts />
        {content}
      </div>
    </>
  );
}
