import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLES,
  startingTeamCounts,
  type ChatMessage,
  type GamePhase,
  type GameSnapshot,
  type PlayerCardView,
  type PublicPlayer,
  type RoleId,
  type RoomSettings,
  type Team,
} from '@truemafia/shared';
import type { GameEventHooks, GamePlayer, NightAction, RoomLike } from './types.js';

interface ChannelLog {
  day: ChatMessage[];
  mafia: ChatMessage[];
  ghosts: ChatMessage[];
}

let roomSeq = 1;

export class GameEngine {
  readonly code: string;
  readonly settings: RoomSettings;
  readonly demoMode: boolean;

  phase: GamePhase = 'LOBBY';
  round = 0;
  phaseEndsAt: number | null = null;
  players: GamePlayer[] = [];
  hostId: number | null = null;

  private nightActions = new Map<number, NightAction>();
  private votes = new Map<number, number>(); // voterId -> targetId
  private logs: ChannelLog = { day: [], mafia: [], ghosts: [] };
  private ready = new Set<number>();
  private over = false;
  private winner: Team | null = null;
  private winReason = '';
  private startedAt = 0;
  private phaseTimer: NodeJS.Timeout | null = null;
  private resolveTimer: NodeJS.Timeout | null = null;
  private reveals = new Map<number, RoleId>(); // dead players revealed roles
  /** Test hook: shorten the cinematic role reveal (default 20s per spec). */
  revealSeconds = 20;
  /** Test hook: DAY interstitial (default 10s). */
  daySeconds = 10;
  /** Test hook: NIGHT_RESULT / VOTE_RESULT (default 8s each). */
  resultSeconds = 8;
  private continueVotes = new Set<number>();
  private snapshotTimer: NodeJS.Timeout | null = null;
  /** Karta tanlash rejimi: userId -> tanlangan rol (lobby, ochiq draft) */
  private rolePicks = new Map<number, RoleId>();

  constructor(
    public room: RoomLike,
    private hooks: GameEventHooks,
  ) {
    this.code = room.code;
    this.settings = room.settings;
    this.demoMode = room.demoMode;
  }

  // ---------- LOBBY ----------

  addPlayer(p: {
    userId: number;
    username: string;
    displayName: string;
    photoUrl?: string;
    isBot?: boolean;
  }): { ok: boolean; error?: string } {
    if (this.phase !== 'LOBBY') return { ok: false, error: 'Game already started' };
    if (this.players.some((x) => x.userId === p.userId)) return { ok: true };
    if (this.players.length >= this.settings.playerCount)
      return { ok: false, error: 'Room is full' };

    const seat = this.players.length + 1;
    this.players.push({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      photoUrl: p.photoUrl,
      isBot: !!p.isBot,
      seat,
      role: 'CITIZEN',
      alive: true,
      connected: !p.isBot,
      investigations: [],
      kills: 0,
      votesReceived: 0,
    });
    this.hooks.onPhaseChanged();
    return { ok: true };
  }

  removePlayer(userId: number): void {
    if (this.phase !== 'LOBBY') return;
    this.players = this.players.filter((p) => p.userId !== userId);
    this.ready.delete(userId);
    this.rolePicks.delete(userId);
    // reseat
    this.players.forEach((p, i) => (p.seat = i + 1));
    if (this.hostId === userId && this.players.length > 0) {
      this.hostId = this.players[0].userId;
    }
    this.hooks.onPhaseChanged();
  }

  /**
   * O'yin davomida chiqish: o'yinchi ro'yxatdan o'chirilmaydi (o'yin buzilmasin),
   * lekin "o'lgan" qilib belgilanadi (LEFT) — tunda harakat qilmaydi, ovoz bermaydi,
   * win-check'da hisobga olinmaydi.
   */
  kickPlayer(userId: number): void {
    const p = this.players.find((x) => x.userId === userId);
    if (!p) return;
    if (this.phase === 'LOBBY') {
      this.removePlayer(userId);
      return;
    }
    if (this.over) {
      // o'yin tugagan — xavfsiz o'chirish (rematch hisobida qotib qolmasin)
      this.players = this.players.filter((x) => x.userId !== userId);
      this.rolePicks.delete(userId);
      this.continueVotes.delete(userId);
      this.broadcastSnapshot();
      return;
    }
    if (p.alive) {
      p.alive = false;
      p.deathRound = this.round;
      p.deathCause = 'LEFT';
      this.nightActions.delete(userId);
      this.votes.delete(userId);
      this.pushSystem('day', `🚪 ${p.displayName} left the game.`);
      this.checkWin();
      if (!this.over) this.broadcastSnapshot();
    }
  }

  setReady(userId: number, ready: boolean): void {
    if (ready) this.ready.add(userId);
    else this.ready.delete(userId);
  }

  canStart(): boolean {
    return (
      this.phase === 'LOBBY' &&
      this.players.length >= MIN_PLAYERS &&
      this.players.length <= MAX_PLAYERS &&
      this.hostId !== null
    );
  }

  start(hostId: number): { ok: boolean; error?: string } {
    if (this.phase !== 'LOBBY') return { ok: false, error: 'Already started' };
    if (hostId !== this.hostId) return { ok: false, error: 'Only the host can start' };
    if (this.players.length < MIN_PLAYERS)
      return { ok: false, error: `Need at least ${MIN_PLAYERS} players` };

    this.startedAt = Date.now();
    this.assignRoles();
    this.phase = 'ROLE_REVEAL';
    this.round = 0;
    this.phaseEndsAt = Date.now() + this.revealSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.beginPhaseTimer(this.revealSeconds * 1000, () => this.toNight());
    return { ok: true };
  }

  private assignRoles(): void {
    if (this.settings.roleDraft && this.rolePicks.size > 0) {
      this.assignRolesDraft();
      return;
    }
    const plan = buildRolePlan(this.settings, this.players.length);
    const shuffled = [...this.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((p, i) => {
      p.role = plan[i] ?? 'CITIZEN';
    });
  }

  /**
   * Karta tanlash rejimi: tanlangan kartalar egalarida qoladi,
   * qolganlar bo'sh kartalardan random oladi.
   */
  private assignRolesDraft(): void {
    const pool = buildRolePlan(this.settings, this.settings.playerCount);
    const quota = new Map<RoleId, number>();
    for (const r of pool) quota.set(r, (quota.get(r) ?? 0) + 1);
    // 1) tasdiqlangan tanlovlar (kvota pick paytida tekshirilgan, pool statik)
    for (const p of this.players) {
      const pick = this.rolePicks.get(p.userId);
      if (pick && (quota.get(pick) ?? 0) > 0) {
        p.role = pick;
        quota.set(pick, (quota.get(pick) ?? 0) - 1);
      }
    }
    // 2) qolgan kartalarni aralashtirib tarqatish
    const rest: RoleId[] = [];
    for (const [r, n] of quota) for (let i = 0; i < n; i++) rest.push(r);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const need = this.players.filter((p) => {
      const pick = this.rolePicks.get(p.userId);
      return !pick || p.role !== pick;
    });
    need.forEach((p, i) => {
      p.role = rest[i] ?? 'CITIZEN';
    });
    this.rolePicks.clear();
  }

  /**
   * Lobby'da karta tanlash (faqat roleDraft rejimida).
   * roleId null = tanlovni bekor qilish.
   */
  pickRole(userId: number, roleId: RoleId | null): { ok: boolean; error?: string } {
    if (!this.settings.roleDraft) return { ok: false, error: 'Draft disabled' };
    if (this.phase !== 'LOBBY') return { ok: false, error: 'Too late' };
    const p = this.players.find((x) => x.userId === userId);
    if (!p || p.isBot) return { ok: false, error: 'Not in room' };
    if (roleId === null) {
      this.rolePicks.delete(userId);
      this.hooks.onPhaseChanged();
      return { ok: true };
    }
    const pool = buildRolePlan(this.settings, this.settings.playerCount);
    const quota = pool.filter((r) => r === roleId).length;
    if (quota === 0) return { ok: false, error: 'No such card' };
    let used = 0;
    for (const [uid, r] of this.rolePicks) {
      if (uid !== userId && r === roleId) used++;
    }
    if (used >= quota) return { ok: false, error: 'Card already taken' };
    this.rolePicks.set(userId, roleId);
    this.hooks.onPhaseChanged();
    return { ok: true };
  }

  /** Efirga: kim tanlagani (qaysi karta — sir, har kim o'zinikini you.pick'da oladi) */
  getRolePicks(): { userId: number; displayName: string }[] {
    const out: { userId: number; displayName: string }[] = [];
    for (const [uid] of this.rolePicks) {
      const p = this.players.find((x) => x.userId === uid);
      if (p) out.push({ userId: uid, displayName: p.displayName });
    }
    return out;
  }

  /** Faqat o'z tanlovi — room:state dagi `you` orqali yuboriladi */
  getPick(userId: number): RoleId | null {
    return this.rolePicks.get(userId) ?? null;
  }

  // ---------- NIGHT ----------

  private toNight(): void {
    if (this.over) return;
    this.phase = 'NIGHT';
    this.round++;
    this.nightActions.clear();
    this.continueVotes.clear();
    this.phaseEndsAt = Date.now() + this.settings.nightSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.beginPhaseTimer(this.settings.nightSeconds * 1000, () => this.resolveNight());
  }

  submitNightAction(userId: number, targetId: number): { ok: boolean; error?: string } {
    const actor = this.players.find((p) => p.userId === userId);
    if (!actor) return { ok: false, error: 'Not in game' };
    if (this.phase !== 'NIGHT') return { ok: false, error: 'Not night' };
    if (!actor.alive) return { ok: false, error: 'Dead players cannot act' };
    const def = ROLES[actor.role];
    if (!def.nightAction || !def.actionKind) return { ok: false, error: 'Your role has no night action' };
    const target = this.players.find((p) => p.userId === targetId);
    if (!target || !target.alive) return { ok: false, error: 'Invalid target' };

    // mafia cannot target mafia; doctor self-heal allowed once? keep simple: self-protect allowed
    if (def.actionKind === 'kill' && actor.role !== 'SERIAL_KILLER') {
      if (isMafia(target.role)) return { ok: false, error: 'You cannot target your own family' };
    }
    if ((def.actionKind === 'protect' || def.actionKind === 'save') && actor.lastNightTarget === targetId) {
      return { ok: false, error: 'Cannot protect the same player two nights in a row' };
    }

    this.nightActions.set(userId, { actorId: userId, kind: def.actionKind, targetId });
    this.hooks.onPhaseChanged();
    this.maybeAutoResolveNight();
    return { ok: true };
  }

  private maybeAutoResolveNight(): void {
    const actors = this.players.filter(
      (p) => p.alive && ROLES[p.role].nightAction && p.role !== 'JESTER',
    );
    const pending = actors.filter((p) => !this.nightActions.has(p.userId));
    if (pending.length === 0) {
      // small delay so the client sees the action registered
      this.beginResolveTimer(1500, () => this.resolveNight());
    }
  }

  private resolveNight(): void {
    if (this.phase !== 'NIGHT' || this.over) return;
    this.clearTimers();

    const deaths: { userId: number; cause: NonNullable<GamePlayer['deathCause']> }[] = [];
    const saved: number[] = [];
    const investigateResults: { targetId: number; result: 'MAFIA' | 'NOT_MAFIA' }[] = [];

    const mafiaActions = [...this.nightActions.values()].filter(
      (a) => a.kind === 'kill' && isMafia(this.players.find((p) => p.userId === a.actorId)?.role ?? 'CITIZEN'),
    );
    const skActions = [...this.nightActions.values()].filter(
      (a) => a.kind === 'kill' && this.players.find((p) => p.userId === a.actorId)?.role === 'SERIAL_KILLER',
    );

    // Don's target wins ties; otherwise first submitted
    let mafiaTarget: number | null = null;
    const donAction = mafiaActions.find(
      (a) => this.players.find((p) => p.userId === a.actorId)?.role === 'DON',
    );
    if (donAction) mafiaTarget = donAction.targetId;
    else if (mafiaActions.length > 0) mafiaTarget = mafiaActions[0].targetId;

    const protections = new Map<number, 'protect' | 'save'>();
    for (const a of this.nightActions.values()) {
      if (a.kind === 'protect' || a.kind === 'save') {
        protections.set(a.targetId, a.kind);
        const actor = this.players.find((p) => p.userId === a.actorId);
        if (actor) actor.lastNightTarget = a.targetId;
      }
    }

    const killTargets = new Set<number>();
    if (mafiaTarget !== null) killTargets.add(mafiaTarget);
    for (const a of skActions) killTargets.add(a.targetId);

    for (const targetId of killTargets) {
      const target = this.players.find((p) => p.userId === targetId);
      if (!target || !target.alive) continue;
      const protection = protections.get(targetId);
      if (protection === 'protect') {
        saved.push(targetId);
        continue;
      }
      if (protection === 'save') {
        // bodyguard dies instead
        const bg = [...this.nightActions.values()].find(
          (a) => a.kind === 'save' && a.targetId === targetId,
        );
        const bgPlayer = bg ? this.players.find((p) => p.userId === bg.actorId) : null;
        if (bgPlayer && bgPlayer.alive) {
          deaths.push({ userId: bgPlayer.userId, cause: 'BODYGUARD' });
          saved.push(targetId);
          continue;
        }
      }
      deaths.push({ userId: targetId, cause: 'NIGHT_KILL' });
      const killer = [...this.nightActions.values()].find((a) => a.kind === 'kill' && a.targetId === targetId);
      const killerPlayer = killer ? this.players.find((p) => p.userId === killer.actorId) : null;
      if (killerPlayer) killerPlayer.kills++;
    }

    for (const a of this.nightActions.values()) {
      if (a.kind === 'investigate') {
        const target = this.players.find((p) => p.userId === a.targetId);
        if (target) {
          const result: 'MAFIA' | 'NOT_MAFIA' = isMafia(target.role) ? 'MAFIA' : 'NOT_MAFIA';
          const actor = this.players.find((p) => p.userId === a.actorId);
          if (actor) {
            actor.investigations.push({ targetId: a.targetId, result });
            // DETECTIVE achievement unlocks at 10 cumulative finds (gameRecorder)
          }
          investigateResults.push({ targetId: a.targetId, result });
        }
      }
    }

    for (const d of deaths) {
      const p = this.players.find((x) => x.userId === d.userId);
      if (p) {
        p.alive = false;
        p.deathRound = this.round;
        p.deathCause = d.cause;
        if (this.settings.revealRolesOnDeath) this.reveals.set(p.userId, p.role);
      }
    }

    this.phase = 'NIGHT_RESULT';
    this.phaseEndsAt = Date.now() + this.resultSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();

    // system message about deaths (public, no roles)
    const names = deaths.map((d) => this.players.find((p) => p.userId === d.userId)?.displayName ?? '?');
    let text: string;
    if (deaths.length === 0) {
      text = '☀️ The town wakes. Everyone survived the night.';
    } else {
      text = `🌙 ${names.join(', ')} ${deaths.length === 1 ? 'was' : 'were'} found dead at dawn.`;
    }
    this.pushSystem('day', text);

    this.beginPhaseTimer(this.resultSeconds * 1000, () => this.toDay());
  }

  // ---------- DAY / DISCUSSION ----------

  private toDay(): void {
    if (this.over) return;
    this.phase = 'DAY';
    this.phaseEndsAt = Date.now() + this.daySeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.pushSystem('day', `☀️ Day ${this.round}. ${this.alivePlayers().length} players remain.`);
    this.beginPhaseTimer(this.daySeconds * 1000, () => this.toDiscussion());
  }

  private toDiscussion(): void {
    if (this.over) return;
    this.phase = 'DISCUSSION';
    this.phaseEndsAt = Date.now() + this.settings.discussionSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.beginPhaseTimer(this.settings.discussionSeconds * 1000, () => this.toVoting());
  }

  // ---------- VOTING ----------

  private toVoting(): void {
    if (this.over) return;
    this.phase = 'VOTING';
    this.votes.clear();
    this.continueVotes.clear();
    this.phaseEndsAt = Date.now() + this.settings.votingSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.beginPhaseTimer(this.settings.votingSeconds * 1000, () => this.resolveVote());
  }

  castVote(voterId: number, targetId: number): { ok: boolean; error?: string } {
    if (this.phase !== 'VOTING') return { ok: false, error: 'Not in voting phase' };
    const voter = this.players.find((p) => p.userId === voterId);
    if (!voter) return { ok: false, error: 'Not in game' };
    if (!voter.alive) return { ok: false, error: 'Dead players cannot vote' };
    const target = this.players.find((p) => p.userId === targetId);
    if (!target || !target.alive) return { ok: false, error: 'Invalid target' };
    this.votes.set(voterId, targetId);
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.maybeAutoResolveVote();
    return { ok: true };
  }

  private maybeAutoResolveVote(): void {
    const alive = this.alivePlayers();
    const pending = alive.filter((p) => !this.votes.has(p.userId));
    if (pending.length === 0) {
      this.beginResolveTimer(1200, () => this.resolveVote());
    }
  }

  private resolveVote(): void {
    if (this.phase !== 'VOTING' || this.over) return;
    this.clearTimers();

    const tally = new Map<number, number>();
    for (const targetId of this.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    let max = 0;
    let top: number[] = [];
    for (const [targetId, count] of tally) {
      if (count > max) {
        max = count;
        top = [targetId];
      } else if (count === max) {
        top.push(targetId);
      }
    }

    for (const p of this.players) p.votesReceived = tally.get(p.userId) ?? 0;

    let eliminatedId: number | null = null;
    if (top.length === 1 && max > 0) {
      eliminatedId = top[0];
    }

    const lines = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, c]) => {
        const p = this.players.find((x) => x.userId === id);
        return `• ${p?.displayName ?? id} — ${c} vote${c === 1 ? '' : 's'}`;
      });
    this.pushSystem('day', lines.length ? `🗳 Voting results:\n${lines.join('\n')}` : '🗳 No votes were cast.');

    if (eliminatedId !== null) {
      const elim = this.players.find((p) => p.userId === eliminatedId);
      if (elim) {
        elim.alive = false;
        elim.deathRound = this.round;
        elim.deathCause = 'VOTED';
        if (this.settings.revealRolesOnDeath) this.reveals.set(elim.userId, elim.role);

        if (elim.role === 'JESTER') {
          // Jester wins instantly
          this.finish(['INDEPENDENT'], 'The Jester was voted out — chaos wins!');
          return;
        }
        this.pushSystem('day', `⚖️ ${elim.displayName} was eliminated.`);
        if (this.settings.revealRolesOnDeath) {
          this.pushSystem('day', `They were ${ROLES[elim.role].name.toUpperCase()}.`);
        }
      }
    } else {
      this.pushSystem('day', '⚖️ The town could not decide. No one was eliminated.');
    }

    this.phase = 'VOTE_RESULT';
    this.phaseEndsAt = Date.now() + this.resultSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();

    if (this.checkWin()) return;
    this.beginPhaseTimer(this.resultSeconds * 1000, () => this.toNight());
  }

  // ---------- WIN CONDITIONS ----------

  private checkWin(): boolean {
    const alive = this.alivePlayers();
    const mafiaAlive = alive.filter((p) => isMafia(p.role)).length;
    const townAlive = alive.filter((p) => !isMafia(p.role) && p.role !== 'SERIAL_KILLER' && p.role !== 'JESTER').length;
    const skAlive = alive.filter((p) => p.role === 'SERIAL_KILLER').length;
    const indAlive = alive.filter((p) => p.role === 'JESTER').length;

    let winner: Team | null = null;
    let reason = '';

    if (mafiaAlive === 0 && skAlive === 0 && indAlive === 0) {
      winner = 'TOWN';
      reason = 'All threats eliminated.';
    } else if (mafiaAlive > 0 && mafiaAlive >= alive.length - mafiaAlive - skAlive - indAlive) {
      winner = 'MAFIA';
      reason = 'The Mafia outnumbers the town.';
    } else if (skAlive === 1 && alive.length === 1) {
      winner = 'INDEPENDENT';
      reason = 'The Serial Killer is the last one breathing.';
    }

    if (winner) {
      this.finish([winner], reason);
      return true;
    }
    return false;
  }

  private finish(winner: Team[], reason: string): void {
    if (this.over) return;
    this.over = true;
    this.winner = winner[0];
    this.winReason = reason;
    this.phase = 'GAME_OVER';
    this.phaseEndsAt = null;
    this.clearTimers();
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.hooks.onGameOver(this.winner, reason);
  }

  // ---------- CHAT ----------

  chatSend(userId: number, channel: ChatMessage['channel'], text: string): { ok: boolean; error?: string } {
    const p = this.players.find((x) => x.userId === userId);
    if (!p) return { ok: false, error: 'Not in game' };
    if (this.over) return { ok: false, error: 'Game over' };
    const trimmed = text.trim().slice(0, 240);
    if (!trimmed) return { ok: false, error: 'Empty message' };

    if (channel === 'day') {
      if (this.phase !== 'DISCUSSION' && this.phase !== 'DAY' && this.phase !== 'VOTING')
        return { ok: false, error: 'Chat is closed' };
      if (!p.alive) return { ok: false, error: 'Dead players cannot speak' };
    } else if (channel === 'mafia') {
      if (!isMafia(p.role) || !p.alive) return { ok: false, error: 'Not allowed' };
      if (this.phase !== 'NIGHT' && this.phase !== 'DISCUSSION' && this.phase !== 'DAY')
        return { ok: false, error: 'Mafia chat is closed' };
    } else {
      // ghosts channel: dead players only
      if (p.alive) return { ok: false, error: 'Living players cannot see this channel' };
    }

    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channel,
      senderId: p.userId,
      senderName: p.displayName,
      photoUrl: p.photoUrl,
      text: trimmed,
      at: Date.now(),
    };
    this.logs[channel].push(msg);
    this.hooks.onChat(msg, (target) => this.canSeeChannel(target, channel));
    return { ok: true };
  }

  pushSystem(channel: ChatMessage['channel'], text: string): void {
    const msg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channel,
      senderId: 0,
      senderName: 'SYSTEM',
      text,
      at: Date.now(),
    };
    this.logs[channel].push(msg);
    this.hooks.onChat(msg, (target) => this.canSeeChannel(target, channel));
  }

  private canSeeChannel(p: GamePlayer, channel: ChatMessage['channel']): boolean {
    if (channel === 'day') return true;
    if (channel === 'mafia') return isMafia(p.role) && p.alive;
    return !p.alive;
  }

  // ---------- CONTINUE / RECONNECT ----------

  requestContinue(userId: number): void {
    if (this.phase !== 'GAME_OVER') return;
    this.continueVotes.add(userId);
    // o'yin davomida chiqib ketganlar hisobga olinmaydi
    const eligible = this.players.filter((p) => !p.isBot && p.deathCause !== 'LEFT').length;
    if (eligible > 0 && this.continueVotes.size >= eligible) {
      // everyone clicked play again -> reset to lobby
      this.resetToLobby();
    }
  }

  private resetToLobby(): void {
    // o'yin davomida chiqib ketganlarni yangi lobby'dan ham olib tashlash
    if (this.players.some((p) => p.deathCause === 'LEFT')) {
      this.players = this.players.filter((p) => p.deathCause !== 'LEFT');
      this.players.forEach((p, i) => (p.seat = i + 1));
      if (!this.players.some((p) => p.userId === this.hostId) && this.players.length > 0) {
        this.hostId = this.players[0].userId;
      }
    }
    this.over = false;
    this.winner = null;
    this.winReason = '';
    this.phase = 'LOBBY';
    this.round = 0;
    this.nightActions.clear();
    this.votes.clear();
    this.logs = { day: [], mafia: [], ghosts: [] };
    this.reveals.clear();
    this.continueVotes.clear();
    for (const p of this.players) {
      p.role = 'CITIZEN';
      p.alive = true;
      p.deathRound = undefined;
      p.deathCause = undefined;
      p.investigations = [];
      p.kills = 0;
      p.votesReceived = 0;
      p.lastNightTarget = undefined;
    }
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
  }

  setConnected(userId: number, connected: boolean): void {
    const p = this.players.find((x) => x.userId === userId);
    if (p) {
      p.connected = connected;
      this.hooks.onPhaseChanged();
      if (this.phase !== 'LOBBY') this.broadcastSnapshot();
    }
  }

  // ---------- SNAPSHOTS ----------

  buildSnapshotFor(userId: number): GameSnapshot {
    const you = this.players.find((p) => p.userId === userId);
    const isHost = this.hostId === userId;

    const players: PlayerCardView[] = this.players.map((p) => {
      const youAreMafia = you ? isMafia(you.role) && you.alive : false;
      const targetMafia = isMafia(p.role);
      const revealed = this.reveals.has(p.userId);
      const showRole =
        (you && p.userId === you.userId && this.phase !== 'LOBBY') ||
        revealed ||
        (youAreMafia && targetMafia && this.phase !== 'LOBBY') ||
        this.phase === 'GAME_OVER';
      return {
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        photoUrl: p.photoUrl,
        seat: p.seat,
        alive: p.alive,
        connected: p.connected,
        isBot: p.isBot,
        role: showRole ? p.role : undefined,
        ally: youAreMafia && targetMafia && p.userId !== you?.userId,
      };
    });

    const channels: GameSnapshot['channels'] = [];
    if (you) {
      if (!you.alive) channels.push('ghosts');
      if (isMafia(you.role) && you.alive) channels.push('mafia');
      if (you.alive) channels.push('day');
    }

    const voteCounts: Record<string, number> = {};
    for (const targetId of this.votes.values()) {
      const key = String(targetId);
      voteCounts[key] = (voteCounts[key] ?? 0) + 1;
    }

    const myChannel: ChatMessage[] = [];
    if (you) {
      const visible = (['day', 'mafia', 'ghosts'] as const).filter((c) =>
        this.canSeeChannel(you, c),
      );
      for (const c of visible) myChannel.push(...this.logs[c]);
    }
    myChannel.sort((a, b) => a.at - b.at);

    const canVote =
      this.phase === 'VOTING' && !!you && you.alive && !this.votes.has(userId);

    return {
      roomId: this.code,
      roomCode: this.code,
      phase: {
        phase: this.phase,
        round: this.round,
        endsAt: this.phaseEndsAt,
        secondsLeft: this.phaseEndsAt ? Math.max(0, Math.ceil((this.phaseEndsAt - Date.now()) / 1000)) : 0,
      },
      you: {
        userId,
        alive: you?.alive ?? false,
        role: you && this.phase !== 'LOBBY' ? you.role : null,
        hasActed: this.nightActions.has(userId) || (this.phase === 'VOTING' && this.votes.has(userId)),
        investigations: you?.investigations ?? [],
      },
      players,
      chat: myChannel,
      channels,
      canVote,
      myVote: this.votes.get(userId) ?? null,
      voteCounts: this.settings.anonymousVoting ? {} : voteCounts,
      settings: this.settings,
      winner: this.winner,
    };
  }

  publicPlayers(): PublicPlayer[] {
    return this.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      photoUrl: p.photoUrl,
      isHost: p.userId === this.hostId,
      isBot: p.isBot,
      ready: this.ready.has(p.userId),
      connected: p.connected,
      seat: p.seat,
    }));
  }

  broadcastSnapshot(): void {
    const map = new Map<number, GameSnapshot>();
    for (const p of this.players) {
      if (!p.isBot) map.set(p.userId, this.buildSnapshotFor(p.userId));
    }
    this.hooks.onSnapshot(map);
  }

  // ---------- TIMERS ----------

  /** Phase timers drive the state machine forward when players idle out. */
  private beginPhaseTimer(ms: number, fn: () => void): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(fn, ms);
  }

  /** Short auto-resolve timers fire when all players have acted/voted early. */
  private beginResolveTimer(ms: number, fn: () => void): void {
    if (this.resolveTimer) clearTimeout(this.resolveTimer);
    this.resolveTimer = setTimeout(fn, ms);
  }

  private clearTimers(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
    if (this.resolveTimer) {
      clearTimeout(this.resolveTimer);
      this.resolveTimer = null;
    }
  }

  startHeartbeat(): void {
    if (this.snapshotTimer) return;
    this.snapshotTimer = setInterval(() => {
      if (this.phase !== 'LOBBY' && this.phase !== 'GAME_OVER') {
        this.broadcastSnapshot();
      }
    }, 10_000);
  }

  dispose(): void {
    this.clearTimers();
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.snapshotTimer = null;
  }

  alivePlayers(): GamePlayer[] {
    return this.players.filter((p) => p.alive);
  }

  get isOver(): boolean {
    return this.over;
  }

  get winnerTeam(): Team | null {
    return this.winner;
  }

  get winReasonText(): string {
    return this.winReason;
  }

  get startedAtTime(): number {
    return this.startedAt;
  }
}

export function isMafia(role: RoleId): boolean {
  return role === 'MAFIA' || role === 'DON';
}

export function buildRolePlan(settings: RoomSettings, count: number): RoleId[] {
  const roles: RoleId[] = [];
  const mafia = Math.max(1, Math.min(settings.mafiaCount, Math.floor((count - 1) / 2)));
  for (let i = 0; i < mafia; i++) roles.push('MAFIA');
  if (settings.donEnabled && mafia >= 2) roles[0] = 'DON';
  if (settings.serialKillerEnabled) roles.push('SERIAL_KILLER');
  if (settings.jesterEnabled) roles.push('JESTER');
  if (settings.doctorEnabled) roles.push('DOCTOR');
  if (settings.detectiveEnabled) roles.push('DETECTIVE');
  if (settings.bodyguardEnabled) roles.push('BODYGUARD');
  while (roles.length < count) roles.push('CITIZEN');
  if (roles.length > count) return roles.slice(0, count);
  void DEFAULT_SETTINGS;
  void startingTeamCounts;
  return roles;
}
