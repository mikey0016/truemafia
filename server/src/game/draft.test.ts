/**
 * Role draft test: picks, quotas, release on leave, honored at start.
 * Run: npm -w server run test:draft
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

function makeEngine(draft: boolean): GameEngine {
  const engine = new GameEngine(
    {
      code: 'DRAFT',
      roomId: null,
      settings: { ...DEFAULT_SETTINGS, playerCount: 8, mafiaCount: 2, roleDraft: draft },
      demoMode: false,
    },
    makeHooks(),
  );
  for (let i = 1; i <= 4; i++) {
    engine.addPlayer({ userId: i, username: `u${i}`, displayName: `U${i}` });
  }
  engine.hostId = 1;
  return engine;
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main(): Promise<void> {
  // disabled rejimda rad etiladi
  {
    const e = makeEngine(false);
    const r = e.pickRole(1, 'MAFIA');
    assert(!r.ok && r.error === 'Draft disabled', 'draft disabled');
    e.dispose();
  }

  const e = makeEngine(true);
  // 8 kishilik CLASSIC pool: DON x MAFIA x DOCTOR x DETECTIVE x CITIZEN x4
  assert(e.pickRole(1, 'MAFIA').ok, 'p1 mafia');
  assert(e.pickRole(2, 'DON').ok, 'p2 don');
  const dup = e.pickRole(3, 'MAFIA');
  assert(!dup.ok, '2-mafia rad etiladi');
  assert(e.pickRole(3, 'DETECTIVE').ok, 'p3 detective');
  assert(!e.pickRole(99, 'DOCTOR').ok, 'begona rad etiladi');
  assert(!e.pickRole(4, 'NOPE' as never).ok, 'notogri rol rad etiladi');
  assert(e.getRolePicks().length === 3, '3 ta pick');

  // chiqqanining kartasi bo'shaydi (DON)
  e.removePlayer(2);
  assert(e.getRolePicks().length === 2, 'pick ozod boldi');
  assert(e.pickRole(3, 'DON').ok, 'ozod kartaga otish');

  // start: tanlovlar hurmat qilinadi
  e.addPlayer({ userId: 2, username: 'u2', displayName: 'U2' });
  const st = e.start(1);
  assert(st.ok, 'start ok');
  const byId = new Map(e.players.map((p) => [p.userId, p.role]));
  assert(byId.get(1) === 'MAFIA', 'p1 mafia saqlangan');
  assert(byId.get(3) === 'DON', 'p3 don saqlangan');
  assert(e.getRolePicks().length === 0, 'picklar tozalangan');
  for (const p of e.players) assert(p.role, `rol berilgan: ${p.userId}`);
  e.dispose();

  console.log('PASS: role draft picks, quotas, release, honored at start.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
