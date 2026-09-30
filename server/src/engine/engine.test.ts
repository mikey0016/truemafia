/**
 * Engine smoke test: runs a complete bot-only game through the state machine.
 * Run: npm -w server run test
 */
import type { GameSnapshot, ChatMessage } from '@truemafia/shared';
import { DEFAULT_SETTINGS } from '@truemafia/shared';
import { GameEngine } from '../game/engine.js';
import { BotController } from '../game/bots.js';
import type { GamePlayer } from '../game/types.js';

function makeHooks() {
  return {
    onSnapshot: (_map: Map<number, GameSnapshot>) => {},
    onChat: (_msg: ChatMessage, _aud: (p: GamePlayer) => boolean) => {},
    onToast: () => {},
    onAchievement: () => {},
    onGameOver: () => {},
    onPhaseChanged: () => {},
  };
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function runFullGame(): Promise<{ winner: string | null; rounds: number }> {
  const engine = new GameEngine(
    {
      code: 'TEST1',
      roomId: null,
      settings: {
        ...DEFAULT_SETTINGS,
        playerCount: 8,
        mafiaCount: 2,
        nightSeconds: 6,
        votingSeconds: 6,
        discussionSeconds: 6,
      },
      demoMode: true,
    },
    makeHooks(),
  );
  const bots = new BotController(engine);
  engine.addPlayer({ userId: 1, username: 'human', displayName: 'Human', isBot: false });
  engine.hostId = 1;
  bots.addBots(7);

  engine.revealSeconds = 1; // speed up cinematic reveal for the test
  engine.daySeconds = 1;
  engine.resultSeconds = 1;
  const started = engine.start(1);
  if (!started.ok) throw new Error('start failed: ' + started.error);

  // Drive the loop: every second, make bots act (emulating the socket layer's
  // onPhaseChanged -> BotController.schedulePhaseActions wiring).
  let guard = 0;
  let lastPhase = '';
  while (!engine.isOver && guard < 600) {
    guard++;
    await wait(250);
    const state = `${engine.phase}#${engine.round}`;
    if (state !== lastPhase) {
      lastPhase = state;
      console.log(`  -> ${state} alive=${engine.players.filter((p) => p.alive).length}`);
      // schedule bots ONCE per phase change (mirrors the socket layer's onPhaseChanged)
      if (
        engine.phase === 'DISCUSSION' ||
        engine.phase === 'NIGHT' ||
        engine.phase === 'VOTING'
      ) {
        bots.schedulePhaseActions();
      }
    }
  }
  if (!engine.isOver) {
    throw new Error(`Game did not finish. Phase=${engine.phase} round=${engine.round}`);
  }
  return { winner: engine.winnerTeam, rounds: engine.round };
}

async function main(): Promise<void> {
  console.log('Running 2 simulated bot games...');
  for (let i = 0; i < 2; i++) {
    const { winner, rounds } = await runFullGame();
    console.log(`Game ${i + 1}: winner=${winner} rounds=${rounds}`);
    if (!winner) throw new Error('Game ended without a winner');
  }
  console.log('PASS: engine state machine completed full games with winners.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
