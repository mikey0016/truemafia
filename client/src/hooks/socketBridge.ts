import { useEffect } from 'react';
import { getSocket, reauth } from '../services/socket';
import { useGameStore } from '../store/gameStore';
import { playSound, vibrate } from '../services/sound';
import { setBackButton, haptic, hapticNotify } from '../services/telegram';
import { getIdentity } from '../services/identity';

let bridgeInstalled = false;

function roleWon(role: string, winner: string): boolean {
  if (role === 'MAFIA' || role === 'DON') return winner === 'MAFIA';
  if (role === 'SERIAL_KILLER' || role === 'JESTER') return winner === 'INDEPENDENT';
  return winner === 'TOWN';
}

export function useSocketBridge(): void {
  const screen = useGameStore((s) => s.screen);

  // install once
  useEffect(() => {
    if (bridgeInstalled) return;
    bridgeInstalled = true;

    const socket = getSocket();
    const st = useGameStore.getState();

    socket.on('room:state', (payload) => {
      useGameStore.getState().setRoomState(payload);
      const s = useGameStore.getState();
      if (s.screen === 'home' || s.screen === 'create' || s.screen === 'join') {
        s.navigate('lobby');
      } else if (s.screen === 'game' && payload.room.phase === 'LOBBY') {
        // "Yana o'ynash" — xona lobby'ga qaytdi, eski o'yin chatini tozalaymiz
        s.clearChat();
        s.resetTo('lobby');
      }
    });

    socket.on('game:snapshot', (snap) => {
      const s = useGameStore.getState();
      const wasPhase = s.snapshot?.phase.phase;
      s.setSnapshot(snap);

      if (s.screen !== 'game' && snap.phase.phase !== 'LOBBY') {
        s.resetTo('game');
      }
      if (snap.phase.phase === 'ROLE_REVEAL' && wasPhase !== 'ROLE_REVEAL') {
        // yangi o'yin boshlandi — kartani ochiq va avtomatik ko'rsatishni tiklaymiz
        useGameStore.setState({ dismissedRoleRound: null });
        s.showRoleCard();
        playSound('cardFlip');
        vibrate(30);
      }
      if (snap.phase.phase === 'NIGHT' && wasPhase !== 'NIGHT') {
        playSound('nightStart');
        vibrate([20, 60, 20]);
      }
      if (
        (snap.phase.phase === 'DAY' || snap.phase.phase === 'DISCUSSION') &&
        wasPhase !== snap.phase.phase
      ) {
        playSound('dayStart');
      }
      if (snap.phase.phase === 'VOTING' && wasPhase !== 'VOTING') {
        playSound('notify');
      }
      if (snap.phase.phase === 'GAME_OVER' && wasPhase !== 'GAME_OVER') {
        const you = snap.players.find((p) => p.userId === snap.you.userId);
        const won = you?.role && snap.winner && roleWon(you.role, snap.winner);
        if (won) {
          playSound('victory');
          hapticNotify('success');
        } else {
          playSound('defeat');
          hapticNotify('error');
        }
        void s.loadProfile();
      }
    });

    socket.on('game:over', () => {
      void useGameStore.getState().loadProfile();
    });

    // emitted after results are persisted server-side; safe to reload now
    socket.on('profile:updated', () => {
      const s = useGameStore.getState();
      void s.loadProfile();
    });

    socket.on('game:toast', ({ kind, message }) => {
      useGameStore.getState().pushToast(kind, message);
      playSound('notify');
    });

    socket.on('game:achievement', ({ id }) => {
      useGameStore.getState().showAchievement(id);
      playSound('victory');
      vibrate([30, 50, 30]);
    });

    socket.on('chat:message', (msg) => {
      useGameStore.getState().pushChat(msg);
      if (msg.senderId !== useGameStore.getState().tgUserId) playSound('notify');
    });

    socket.on('room:error', ({ code, message }) => {
      // Auth eskirgan bo'lsa (server restart) — bir marta yangilab ko'ramiz
      if (code === 'UNAUTHENTICATED') reauth();
      useGameStore.getState().pushToast('error', message);
    });

    // Server xonani yopdi (hamma chiqib ketgan / cleanup) — bosh sahifaga qaytamiz
    socket.on('room:closed', ({ reason }) => {
      const s = useGameStore.getState();
      s.clearRoom();
      s.resetTo('home');
      s.pushToast('info', reason || 'Room closed');
    });

    // Telegram bo'lsa — real user, bo'lmasa — mehmon (avatar harfi ko'rinadi)
    const me = getIdentity();
    st.setIdentity(me.id ?? 0, me.name, me.photo);
  }, []);

  // Socket ulanishini kutish (Render free Cold Start ~30-60s uyg'onadi) —
  // "Backend ulanmagan" xatosi o'rniga "Ulanmoqda…" holati va ulangach avtomatik davom
  const connected = useGameStore((s) => s.socketConnected);
  useEffect(() => {
    if (!connected) return;
    const pending = useGameStore.getState().pendingAction;
    if (pending) {
      useGameStore.getState().setPendingAction(null);
      pending();
    }
  }, [connected]);

  // BackButton per screen
  useEffect(() => {
    const inGameFlow = screen === 'game' || screen === 'lobby';
    return setBackButton(!inGameFlow && screen !== 'home', () => {
      haptic('light');
      if (screen === 'lobby') {
        getSocket().emit('room:leave', {}, () => {});
        useGameStore.getState().clearRoom();
        useGameStore.getState().resetTo('home');
      } else {
        useGameStore.getState().back();
      }
    });
  }, [screen]);
}
