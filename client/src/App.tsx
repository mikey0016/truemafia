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
import { hideMainButton } from './services/telegram';

export function App() {
  useSocketBridge();
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    hideMainButton();
  }, []);

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
    default:
      content = <Home />;
  }

  return (
    <div className="app">
      <Toasts />
      {content}
    </div>
  );
}
