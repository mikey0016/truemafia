import { ROLES, type ChatMessage } from '@truemafia/shared';
import { isMafia, type GameEngine } from './engine.js';

const BOT_NAMES = [
  'Alex', 'Timur', 'Aziz', 'Nika', 'Dima', 'Sofia', 'Ruslan',
  'Mark', 'Lena', 'Oleg', 'Vera', 'Sasha', 'Igor', 'Mila',
];

const BOT_USER_ID_BASE = 900000000; // synthetic ids, can't collide with Telegram ids

const CHAT_LINES_DAY = [
  'I have a bad feeling about this round.',
  'Someone here is lying.',
  'I was quiet last night, watching votes.',
  'Why did you defend them so hard?',
  'Trust me, I am vanilla town.',
  'The doctor saved someone, obviously.',
  'Let us think before we vote.',
  'That vote looked coordinated.',
];
const CHAT_LINES_MAFIA = [
  'Vote together, do not split.',
  'I will follow your call.',
  'Skip the detective claim, too risky.',
  'Push on the loud one.',
];

export interface BotPersona {
  userId: number;
  name: string;
  aggression: number; // 0..1
}

export class BotController {
  private bots = new Map<number, BotPersona>();
  private timers: NodeJS.Timeout[] = [];
  private engineRef: GameEngine;

  constructor(engine: GameEngine) {
    this.engineRef = engine;
  }

  /** Fill the lobby with n bots. */
  addBots(n: number): void {
    const used = new Set(
      this.engineRef.players.map((p) => p.displayName),
    );
    let added = 0;
    for (const name of BOT_NAMES) {
      if (added >= n) break;
      if (used.has(name)) continue;
      const userId = BOT_USER_ID_BASE - this.bots.size - added - 1;
      const persona: BotPersona = {
        userId,
        name,
        aggression: 0.3 + Math.random() * 0.6,
      };
      this.bots.set(userId, persona);
      this.engineRef.addPlayer({
        userId,
        username: name.toLowerCase(),
        displayName: name,
        isBot: true,
      });
      added++;
    }
  }

  botsInGame(): BotPersona[] {
    return [...this.bots.values()].filter((b) =>
      this.engineRef.players.some((p) => p.userId === b.userId),
    );
  }

  /** Schedule bot behavior for the current phase. Call on every phase change. */
  schedulePhaseActions(): void {
    if (!this.engineRef.demoMode) return;
    this.clearTimers();
    const engine = this.engineRef;

    if (engine.phase === 'DISCUSSION') {
      for (const bot of this.botsInGame()) {
        const delay = 3000 + Math.random() * 20000;
        this.timers.push(setTimeout(() => this.botChat(bot), delay));
      }
    }
    if (engine.phase === 'NIGHT') {
      for (const bot of this.botsInGame()) {
        const span = Math.max(1000, (engine.settings.nightSeconds - 8) * 1000);
        const delay = 4000 + Math.random() * span;
        this.timers.push(setTimeout(() => this.botNightAction(bot), delay));
      }
    }
    if (engine.phase === 'VOTING') {
      for (const bot of this.botsInGame()) {
        const span = Math.max(1000, (engine.settings.votingSeconds - 10) * 1000);
        const delay = 5000 + Math.random() * span;
        this.timers.push(setTimeout(() => this.botVote(bot), delay));
      }
    }
  }

  private botChat(bot: BotPersona): void {
    const player = this.engineRef.players.find((p) => p.userId === bot.userId);
    if (!player || !player.alive) return;
    const engine = this.engineRef;
    if (engine.phase !== 'DISCUSSION') return;
    const isMafiaBot = isMafia(player.role);
    const channel: ChatMessage['channel'] = isMafiaBot && Math.random() < 0.4 ? 'mafia' : 'day';
    const lines = channel === 'mafia' ? CHAT_LINES_MAFIA : CHAT_LINES_DAY;
    engine.chatSend(bot.userId, channel, lines[Math.floor(Math.random() * lines.length)]);
  }

  private botNightAction(bot: BotPersona): void {
    const engine = this.engineRef;
    if (engine.phase !== 'NIGHT') return;
    const player = engine.players.find((p) => p.userId === bot.userId);
    if (!player || !player.alive) return;
    const def = ROLES[player.role];
    if (!def.nightAction || !def.actionKind) return;

    const targets = engine.alivePlayers().filter((t) => {
      if (t.userId === bot.userId) return false;
      if (def.actionKind === 'kill' && player.role !== 'SERIAL_KILLER' && isMafia(t.role)) return false;
      if ((def.actionKind === 'protect' || def.actionKind === 'save') && player.lastNightTarget === t.userId)
        return false;
      return true;
    });
    if (targets.length === 0) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    engine.submitNightAction(bot.userId, target.userId);
  }

  private botVote(bot: BotPersona): void {
    const engine = this.engineRef;
    if (engine.phase !== 'VOTING') return;
    const player = engine.players.find((p) => p.userId === bot.userId);
    if (!player || !player.alive) return;

    const alive = engine.alivePlayers().filter((t) => t.userId !== bot.userId);
    if (alive.length === 0) return;

    // Smart-ish voting: bots know nothing; mafia bots prefer non-mafia; some randomness
    let pool = alive;
    if (isMafia(player.role)) {
      const nonMafia = alive.filter((t) => !isMafia(t.role));
      if (nonMafia.length) pool = nonMafia;
    }
    // 60%: follow current majority; else random
    const counts = new Map<number, number>();
    for (const [, targetId] of (engine as unknown as { votes: Map<number, number> })['votes']) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
    let pick: number | null = null;
    if (Math.random() < 0.6) {
      let max = 0;
      let top: number[] = [];
      for (const [tid, c] of counts) {
        if (pool.some((p) => p.userId === tid)) {
          if (c > max) {
            max = c;
            top = [tid];
          } else if (c === max) top.push(tid);
        }
      }
      if (top.length) pick = top[Math.floor(Math.random() * top.length)];
    }
    if (pick === null) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      pick = t.userId;
    }
    engine.castVote(bot.userId, pick);
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  dispose(): void {
    this.clearTimers();
  }
}
