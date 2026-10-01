/**
 * Detective shot test: tekshirish (investigate) + bir martalik otish (kill),
 * ikkinchi o'q rad etiladi, notekshiruv rollar o'q uzolmaydi.
 * Run: npm -w server run test:detective
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
      code: 'DETSHOT',
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

  assert(engine.pickRole(2, 'DETECTIVE').ok, 'p2 detective pick');
  assert(engine.start(1).ok, 'start ok');
  const roleOf = (id: number): string => engine.players.find((p) => p.userId === id)?.role ?? '?';
  assert(roleOf(2) === 'DETECTIVE', 'p2 detective');
  const mafia = engine.players.find((p) => p.role === 'MAFIA')!.userId;
  const doctor = engine.players.find((p) => p.role === 'DOCTOR')!.userId;
  const citizen = engine.players.find((p) => p.role === 'CITIZEN')!.userId;

  await waitFor(engine, 'NIGHT', 8000);
  // 1-tun: tekshirish ishlaydi
  assert(engine.submitNightAction(2, citizen, 'investigate').ok, 'investigate ok');
  assert(engine.submitNightAction(mafia, citizen).ok, 'mafia kill');
  assert(engine.submitNightAction(doctor, 2).ok, 'doctor protect');
  await waitFor(engine, 'DAY', 15000);
  const det = engine.players.find((p) => p.userId === 2)!;
  assert(det.investigations.length === 1, 'tekshiruv yozildi');
  assert(det.investigations[0].result === 'NOT_MAFIA', 'fuqaro topildi');
  assert(!engine.isOver, 'o‘yin davom etadi');

  // 2-tun: doktor o‘q uzolmaydi
  await waitFor(engine, 'NIGHT', 30000);
  const docKill = engine.submitNightAction(doctor, mafia, 'kill');
  assert(!docKill.ok, 'doktor otolmaydi');
  // detektiv mafiyani otadi
  assert(engine.submitNightAction(2, mafia, 'kill').ok, 'detective kill ok');
  // ikkinchi o‘q — rad
  const second = engine.submitNightAction(2, doctor, 'kill');
  assert(!second.ok, 'ikkinchi oq rad etiladi');
  assert(engine.submitNightAction(mafia, doctor).ok, 'mafia javob zarbasi');
  assert(engine.submitNightAction(doctor, doctor).ok, 'doctor self-protect');
  await waitFor(engine, 'GAME_OVER', 15000);
  assert(engine.isOver, 'tugadi');
  assert(engine.winnerTeam === 'TOWN', `g‘olib TOWN, boldi=${engine.winnerTeam}`);
  engine.dispose();

  console.log('PASS: detective investigate + one shot kill, second shot rejected.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
