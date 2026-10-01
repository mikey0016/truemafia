/**
 * Qayta ovoz (runoff) testi: teng ovoz chiqqanda faqat teng qolgan nomzodlar
 * orasida qayta ovoz beriladi; runoffda ko'pchilik bo'lsa chiqariladi,
 * yana teng bo'lsa hech kim chiqarilmaydi. Ovoz jurnali (voteLog) tekshiriladi.
 * Run: npm -w server run test:runoff
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
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** runoff faollashgunicha kutish (avto-resolve 1.2s kechikadi) */
async function waitForRunoff(e: GameEngine, timeoutMs: number): Promise<number[]> {
  const t0 = Date.now();
  for (;;) {
    const runoff = e.buildSnapshotFor(e.players[0].userId).runoff;
    if (Array.isArray(runoff) && runoff.length >= 2) return runoff;
    if (Date.now() - t0 > timeoutMs) throw new Error('timeout waiting runoff');
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function main(): Promise<void> {
  const engine = new GameEngine(
    {
      code: 'RUNOFF',
      roomId: null,
      settings: {
        ...DEFAULT_SETTINGS,
        playerCount: 8,
        mafiaCount: 2,
        donEnabled: false,
        bodyguardEnabled: false,
        nightSeconds: 3,
        votingSeconds: 3,
        discussionSeconds: 2,
      },
      demoMode: false,
    },
    makeHooks(),
  );
  for (let i = 1; i <= 8; i++) {
    engine.addPlayer({ userId: i, username: `u${i}`, displayName: `U${i}` });
  }
  engine.hostId = 1;
  engine.revealSeconds = 1;
  engine.daySeconds = 1;
  engine.resultSeconds = 1;

  const st = engine.start(1);
  assert(st.ok, 'start ok');
  await waitFor(engine, 'NIGHT', 8000);

  // 1-tun: hech kim harakat qilmaydi -> hech kim o'lmaydi
  await waitFor(engine, 'DAY', 15000);
  await waitFor(engine, 'VOTING', 15000);

  // 8 tirik: 4 -> A, 4 -> B (tenglik)
  const alive = engine.alivePlayers().map((p) => p.userId);
  assert(alive.length === 8, 'hamma tirik');
  const [a, b] = [alive[0], alive[1]];
  alive.forEach((uid, idx) => {
    assert(engine.castVote(uid, idx % 2 === 0 ? a : b).ok, `vote ${uid}`);
  });

  const runoff = await waitForRunoff(engine, 10000);
  assert(runoff.length === 2 && runoff.includes(a) && runoff.includes(b), 'runoff: a va b');

  const snap = engine.buildSnapshotFor(alive[0]);
  assert(Array.isArray(snap.voteLog), 'voteLog snapshotda');
  assert(!snap.settings.anonymousVoting, 'anonim ochiq');

  // runoff: 5 -> a, 3 -> b (hamma qatnashadi)
  const alive2 = engine.alivePlayers().map((p) => p.userId);
  alive2.forEach((uid, idx) => engine.castVote(uid, idx < 5 ? a : b));
  await waitFor(engine, 'VOTE_RESULT', 15000);
  assert(!engine.alivePlayers().some((p) => p.userId === a), 'a chiqarildi');
  assert(engine.alivePlayers().some((p) => p.userId === b), 'b tirik');

  // 7 tirik: 3 -> C, 3 -> D, 1 betaraf -> tenglik -> runoff -> yana teng -> hech kim
  await waitFor(engine, 'NIGHT', 20000);
  await waitFor(engine, 'DAY', 20000);
  await waitFor(engine, 'VOTING', 20000);
  const alive3 = engine.alivePlayers().map((p) => p.userId);
  assert(alive3.length === 7, '7 tirik');
  const [c, d] = [alive3[0], alive3[1]];
  const voterIds = alive3.slice(0, 6); // oxirgi betaraf
  voterIds.forEach((uid, idx) => engine.castVote(uid, idx < 3 ? c : d));
  const runoff2 = await waitForRunoff(engine, 10000);
  assert(runoff2.length === 2, 'ikkinchi runoff');
  const [cand1, cand2] = runoff2;
  // runoffda ham 3/3 (7-o'yinchi yana betaraf)
  alive3.slice(0, 6).forEach((uid, idx) => engine.castVote(uid, idx < 3 ? cand1 : cand2));
  await waitFor(engine, 'VOTE_RESULT', 15000);
  assert(
    engine.alivePlayers().some((p) => p.userId === cand1) &&
      engine.alivePlayers().some((p) => p.userId === cand2),
    'runoff tengligida hech kim chiqmadi',
  );

  engine.dispose();
  console.log('PASS: runoff — tie -> revote among tied, second tie -> nobody eliminated.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
