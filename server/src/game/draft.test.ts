/**
 * Role draft test: yopiq (blind) tanlov — karta indeksi, kvota emas.
 * Run: npm -w server run test:draft
 */
import { DEFAULT_SETTINGS, ROLES } from '@truemafia/shared';
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
  for (let i = 1; i <= 8; i++) {
    engine.addPlayer({ userId: i, username: `u${i}`, displayName: `U${i}` });
  }
  engine.hostId = 1;
  return engine;
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main(): Promise<void> {
  // draft o'chirilgan holatda rad etiladi
  {
    const e = makeEngine(false);
    const r = e.pickRole(1, 0);
    assert(!r.ok && r.error === 'Tanlash o‘chiq', 'draft disabled');
    e.dispose();
  }

  const e = makeEngine(true);
  // 8 kishilik CLASSIC pool: DON x MAFIA x DOCTOR x DETECTIVE x CITIZEN x4
  // karta indekslari 0..7 (settings.playerCount = 8)
  assert(e.pickRole(1, 0).ok, '1-kishi 0-kartani oldi');
  assert(e.pickRole(2, 1).ok, '2-kishi 1-kartani oldi');

  // bir kartani ikki kishi olmaydi
  const dup = e.pickRole(3, 0);
  assert(!dup.ok, 'band karta rad etiladi');
  assert(dup.error === 'Karta band', 'band karta xabari');

  // chegara va tur tekshiruvlari
  assert(!e.pickRole(3, 99).ok, 'chegaradan tashqari karta rad etiladi');
  assert(!e.pickRole(3, -1).ok, 'manfiy karta rad etiladi');
  assert(!e.pickRole(3, 1.5).ok, 'kasr karta rad etiladi');
  assert(!e.pickRole(99, 2).ok, 'begona rad etiladi');

  assert(e.getRolePicks().length === 2, '2 ta pick');
  // yashirin draft: efirda rol umuman yo'q
  assert(!('role' in e.getRolePicks()[0]), 'efirda role yoq');
  assert(e.getPickSlot(1) === 0, '1-kishining kartasi');
  assert(e.getPickSlot(2) === 1, '2-kishining kartasi');
  assert(e.getPickSlot(4) === null, 'tanlamaganning picki null');

  // null = tanlovni bekor qilish
  assert(e.pickRole(2, null).ok, 'tanlovni bekor qilish');
  assert(e.getRolePicks().length === 1, 'pick kamaydi');
  assert(e.getPickSlot(2) === null, 'bekor qilingan pick null');

  // chiqqanining kartasi bo'shaydi
  assert(e.pickRole(2, 1).ok, '2-kishi yana 1-kartani oldi');
  e.removePlayer(2);
  assert(e.getRolePicks().length === 1, 'pick ozod boldi');
  assert(e.getPickSlot(1) === 0, 'qolgan pick saqlandi');
  assert(e.pickRole(3, 1).ok, 'ozod kartaga otish');
  assert(e.getPickSlot(3) === 1, 'bo‘shagan karta egasi');

  // start: tanlovlar hurmat qilinadi va tozalanadi
  e.addPlayer({ userId: 2, username: 'u2', displayName: 'U2' });
  const st = e.start(1);
  assert(st.ok, 'start ok');
  assert(e.getRolePicks().length === 0, 'picklar tozalangan');
  for (const p of e.players) assert(p.role, `rol berilgan: ${p.userId}`);
  for (const p of e.players) assert(p.role in ROLES, `rol ROLES da bor: ${p.userId}`);

  // start dan keyin tanlov rad etiladi (LOBBY emas)
  assert(!e.pickRole(1, 2).ok, 'o‘yin boshlangandan keyin tanlov rad etiladi');

  // 8 kishilik rol taqsimoti xona rejasiga mos keladi
  const counts = new Map<string, number>();
  for (const p of e.players) counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
  assert(e.players.length === 8, '8 kishi');
  assert(counts.get('DON') === 1, 'DON x1');
  assert(counts.get('MAFIA') === 1, 'MAFIA x1');
  assert(counts.get('DOCTOR') === 1, 'DOCTOR x1');
  assert(counts.get('DETECTIVE') === 1, 'DETECTIVE x1');
  assert(counts.get('CITIZEN') === 4, 'CITIZEN x4');
  assert(counts.size === 5, `boshqa rol yoq: ${[...counts.keys()].join(',')}`);
  e.dispose();

  console.log('PASS: blind role draft — slot picks, no role in feed, release, honored at start.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
