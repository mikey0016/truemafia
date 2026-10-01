/**
 * 1v1 win test: 1 mafia + 1 town qolganda o'yin TUNDAYOQ tugaydi (kun kutmaydi).
 * Run: npm -w server run test:win
 */
import { DEFAULT_SETTINGS } from '@truemafia/shared';
import { GameEngine } from './engine.js';
import type { GameEventHooks } from './types.js';

function makeHooks(): GameEventHooks {
  return {
    onSnapshot: () => {},
    onChat: () => {},
    onToast: () => {},
    onAchievement: () => {},
    onGameOver: () => {},
    onPhaseChanged: () => {},
  };
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function waitFor(e: GameEngine, phase: string, timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  while ((e.phase as string) !== phase) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting ${phase}, at=${e.phase}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function main(): Promise<void> {
  const engine = new GameEngine(
    {
      code: 'WIN1V1',
      roomId: null,
      settings: {
        ...DEFAULT_SETTINGS,
        playerCount: 4,
        mafiaCount: 1,
        roleDraft: true,
        nightSeconds: 4,
        votingSeconds: 3,
        discussionSeconds: 3,
      },
      demoMode: false,
    },
    makeHooks(),
  );
  for (let i = 1; i <= 4; i++) {
    engine.addPlayer({ userId: i, username: `u${i}`, displayName: `U${i}` });
  }
  engine.hostId = 1;
  engine.revealSeconds = 1;
  engine.daySeconds = 1;
  engine.resultSeconds = 1;

  // p1 = MAFIA (draft kafolatlaydi)
  assert(engine.pickRole(1, 'MAFIA').ok, 'p1 mafia pick');
  const st = engine.start(1);
  assert(st.ok, 'start ok');

  const roleOf = (id: number): string => engine.players.find((p) => p.userId === id)?.role ?? '?';
  assert(roleOf(1) === 'MAFIA', 'p1 mafia');
  const doctor = engine.players.find((p) => p.role === 'DOCTOR')!.userId;
  const detective = engine.players.find((p) => p.role === 'DETECTIVE')!.userId;
  const citizen = engine.players.find((p) => p.role === 'CITIZEN')!.userId;

  await waitFor(engine, 'NIGHT', 8000);
  // 1-tun: citizen o'ladi (3 kishi qoladi — o'yin davom etishi kerak)
  assert(engine.submitNightAction(1, citizen).ok, 'mafia kill');
  assert(engine.submitNightAction(doctor, detective).ok, 'doctor protect');
  assert(engine.submitNightAction(detective, 1).ok, 'detective check');
  await waitFor(engine, 'DAY', 15000);
  assert(!engine.isOver, '1m+2t davom etadi');
  assert(engine.alivePlayers().length === 3, '3 kishi tirik');

  // kun + ovoz (hech kim ovoz bermaydi) → 2-tun
  await waitFor(engine, 'NIGHT', 30000);
  // 2-tun: detective o'ladi → 1v1 → TUNDAYOQ tugashi kerak
  assert(engine.submitNightAction(1, detective).ok, 'mafia kill 2');
  const doc = engine.players.find((p) => p.userId === doctor);
  if (doc?.alive) engine.submitNightAction(doctor, doctor); // o'zini himoya (muddati yo'q)
  await waitFor(engine, 'GAME_OVER', 15000);
  assert(engine.isOver, '1v1 da tugadi');
  assert(engine.winnerTeam === 'MAFIA', `g'olib MAFIA, boldi=${engine.winnerTeam}`);
  assert(engine.alivePlayers().length === 2, '1v1 holat');
  engine.dispose();

  console.log('PASS: 1v1 ends immediately at night with MAFIA win.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
