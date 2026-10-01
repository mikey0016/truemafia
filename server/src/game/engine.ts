import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLES,
  type ChatMessage,
  type GamePhase,
  type GameSnapshot,
  type PlayerCardView,
  type PublicPlayer,
  type RoleId,
  type RoomSettings,
  type Team,
  isPremiumRole,
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
  /** Karta tanlash rejimi (blind): userId -> {yashirin rol, pozitsiya} */
  private rolePicks = new Map<number, { role: RoleId; slot: number }>();
  /** Detektivning ishlatilgan bir martalik o‘qlari */
  private detectiveShots = new Set<number>();
  /** Ketma-ket "o'lik" raundlar (na o'lim, na ovoz, na tungi harakat) — stall himoyasi */
  private stallRounds = 0;
  /** Qayta ovoz (runoff): teng ovoz chiqqanda faqat shu nomzodlar orasida ovoz beriladi */
  private runoffCandidates: number[] | null = null;

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
    title?: string;
  }): { ok: boolean; error?: string } {
    if (this.phase !== 'LOBBY') return { ok: false, error: 'O‘yin allaqachon boshlangan' };
    if (this.players.some((x) => x.userId === p.userId)) return { ok: true };
    if (this.players.length >= this.settings.playerCount)
      return { ok: false, error: 'Xona to‘lgan' };

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
      title: p.title,
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
        this.pushSystem('day', `🚪 ${p.displayName} o‘yindan chiqdi.`);
      this.checkWin();
      if (!this.over) this.broadcastSnapshot();
    }
  }

  setReady(userId: number, ready: boolean): void {
    if (ready) this.ready.add(userId);
    else this.ready.delete(userId);
  }

  /**
   * Host xona sozlamasini o'zgartirishi (faqat LOBBY'da). Ijozat berilgan
   * maydonlar merge qilinadi — nomaqbul kalitlar e'tiborga olinmaydi.
   */
  updateSettings(patch: Partial<RoomSettings>): void {
    if (this.phase !== 'LOBBY') return;
    const allowed: (keyof RoomSettings)[] = [
      'anonymousVoting',
      'revealRolesOnDeath',
      'discussionSeconds',
      'votingSeconds',
      'nightSeconds',
      'privateRoom',
    ];
    for (const key of allowed) {
      const v = patch[key];
      if (v !== undefined) {
        (this.settings as RoomSettings)[key] = v as never;
      }
    }
    this.hooks.onPhaseChanged();
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
    if (this.phase !== 'LOBBY') return { ok: false, error: 'Allaqachon boshlangan' };
    if (hostId !== this.hostId) return { ok: false, error: 'Faqat host boshlay oladi' };
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
    // 1) tasdiqlangan tanlovlar
    for (const p of this.players) {
      const pick = this.rolePicks.get(p.userId)?.role;
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
      const pick = this.rolePicks.get(p.userId)?.role;
      return !pick || p.role !== pick;
    });
    need.forEach((p, i) => {
      p.role = rest[i] ?? 'CITIZEN';
    });
    this.rolePicks.clear();
  }

  /**
   * Blind draft: o'yinchi yopiq pozitsiyani tanlaydi, server qolgan
   * kartalardan random rol beradi (rol faqat egasiga ko'rinadi).
   * slot null = tanlovni bekor qilish. owned — marketdan olingan rollar.
   */
  pickRole(
    userId: number,
    slot: number | null,
    owned: RoleId[] = [],
  ): { ok: boolean; error?: string } {
    if (!this.settings.roleDraft) return { ok: false, error: 'Tanlash o‘chiq' };
    if (this.phase !== 'LOBBY') return { ok: false, error: 'Juda kech' };
    const p = this.players.find((x) => x.userId === userId);
    if (!p || p.isBot) return { ok: false, error: 'Xonada emassiz' };
    if (slot === null) {
      this.rolePicks.delete(userId);
      this.hooks.onPhaseChanged();
      return { ok: true };
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.settings.playerCount) {
      return { ok: false, error: 'Noto‘g‘ri karta' };
    }
    const cur = this.rolePicks.get(userId);
    if (cur && cur.slot === slot) return { ok: true };
    for (const [uid, v] of this.rolePicks) {
      if (uid !== userId && v.slot === slot) return { ok: false, error: 'Karta band' };
    }
    // qolgan kartalar (o'zimnikidan tashqari band qilinganlar chiqariladi)
    const pool = buildRolePlan(this.settings, this.settings.playerCount);
    const taken = new Map<RoleId, number>();
    for (const [uid, v] of this.rolePicks) {
      if (uid !== userId) taken.set(v.role, (taken.get(v.role) ?? 0) + 1);
    }
    const remaining: RoleId[] = [];
    const seen = new Map<RoleId, number>();
    for (const r of pool) {
      const n = (seen.get(r) ?? 0) + 1;
      seen.set(r, n);
      if (n > (taken.get(r) ?? 0)) remaining.push(r);
    }
    // premium rollar — faqat marketdan olganlarga (bo'lmasa yashirincha chiqariladi)
    let allowed = remaining.filter((r) => !isPremiumRole(r) || owned.includes(r));
    if (allowed.length === 0) allowed = remaining;
    if (allowed.length === 0) return { ok: false, error: 'Kartalar tugadi' };
    const role = allowed[Math.floor(Math.random() * allowed.length)];
    this.rolePicks.set(userId, { role, slot });
    this.hooks.onPhaseChanged();
    return { ok: true };
  }

  /** Efirga: kim qaysi pozitsiyani olgani (rol — sir, har kim o'zinikini you.slot'da oladi) */
  getRolePicks(): { userId: number; displayName: string; slot: number }[] {
    const out: { userId: number; displayName: string; slot: number }[] = [];
    for (const [uid, v] of this.rolePicks) {
      const p = this.players.find((x) => x.userId === uid);
      if (p) out.push({ userId: uid, displayName: p.displayName, slot: v.slot });
    }
    return out;
  }

  /** Faqat o'z tanlovining pozitsiyasi — room:state dagi `you` orqali yuboriladi */
  getPickSlot(userId: number): number | null {
    return this.rolePicks.get(userId)?.slot ?? null;
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

  submitNightAction(
    userId: number,
    targetId: number,
    mode?: 'kill' | 'investigate',
  ): { ok: boolean; error?: string } {
    const actor = this.players.find((p) => p.userId === userId);
    if (!actor) return { ok: false, error: 'O‘yinda emassiz' };
    if (this.phase !== 'NIGHT') return { ok: false, error: 'Hozir tun emas' };
    if (!actor.alive) return { ok: false, error: 'O‘lganlar harakat qilolmaydi' };
    const def = ROLES[actor.role];
    if (!def.nightAction || !def.actionKind) return { ok: false, error: 'Rolingizda tungi harakat yo‘q' };
    let kind = def.actionKind;
    if (actor.role === 'DETECTIVE') {
      if (mode === 'kill') {
        if (this.detectiveShots.has(userId)) return { ok: false, error: 'O‘qingiz tugagan' };
        kind = 'kill';
        this.detectiveShots.add(userId);
      } else if (mode !== undefined && mode !== 'investigate') {
        return { ok: false, error: 'Noto‘g‘ri harakat' };
      }
    } else if (mode !== undefined && mode !== def.actionKind) {
      return { ok: false, error: 'Noto‘g‘ri harakat' };
    }
    const target = this.players.find((p) => p.userId === targetId);
    if (!target || !target.alive) return { ok: false, error: 'Noto‘g‘ri nishon' };

    // mafia cannot target mafia; doctor self-heal allowed once? keep simple: self-protect allowed
    // (detektiv va seriyali qotil kimnidir nishonga olsa bo'ladi)
    if (kind === 'kill' && isMafia(actor.role)) {
      if (isMafia(target.role)) return { ok: false, error: 'O‘z oilangizga tegolmaysiz' };
    }
    if ((kind === 'protect' || kind === 'save') && actor.lastNightTarget === targetId) {
      return { ok: false, error: 'Bir kishini ikki tun ketma-ket himoyalab bo‘lmaydi' };
    }

    this.nightActions.set(userId, { actorId: userId, kind, targetId });
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
    const detActions = [...this.nightActions.values()].filter(
      (a) => a.kind === 'kill' && this.players.find((p) => p.userId === a.actorId)?.role === 'DETECTIVE',
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
    for (const a of detActions) killTargets.add(a.targetId);

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
    if (deaths.length > 0) this.stallRounds = 0;

    // O'yin shu tunda hal bo'lishi mumkin (masalan 1v1) — keraksiz kun o'tkazmaymiz
    if (this.checkWin()) return;

    this.phase = 'NIGHT_RESULT';
    this.phaseEndsAt = Date.now() + this.resultSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();

    // system message about deaths (public, no roles)
    const names = deaths.map((d) => this.players.find((p) => p.userId === d.userId)?.displayName ?? '?');
    let text: string;
    if (deaths.length === 0) {
      text = '☀️ Shahar uyg‘ondi. Hamma tunni omon o‘tkazdi.';
    } else {
      text = `🌙 Tongda ${names.join(', ')} o‘lik topildi.`;
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
    this.pushSystem('day', `☀️ ${this.round}-kun. ${this.alivePlayers().length} o‘yinchi qoldi.`);
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
    this.runoffCandidates = null;
    this.phaseEndsAt = Date.now() + this.settings.votingSeconds * 1000;
    this.hooks.onPhaseChanged();
    this.broadcastSnapshot();
    this.beginPhaseTimer(this.settings.votingSeconds * 1000, () => this.resolveVote());
  }

  castVote(voterId: number, targetId: number): { ok: boolean; error?: string } {
    if (this.phase !== 'VOTING') return { ok: false, error: 'Hozir ovoz berish emas' };
    const voter = this.players.find((p) => p.userId === voterId);
    if (!voter) return { ok: false, error: 'O‘yinda emassiz' };
    if (!voter.alive) return { ok: false, error: 'O‘lganlar ovoz berolmaydi' };
    const target = this.players.find((p) => p.userId === targetId);
    if (!target || !target.alive) return { ok: false, error: 'Noto‘g‘ri nishon' };
    // qayta ovoz rejimi: faqat runoff nomzodlariga ovoz beriladi
    if (this.runoffCandidates && !this.runoffCandidates.includes(targetId)) {
      return { ok: false, error: 'Qayta ovoz faqat nomzodlar orasida' };
    }
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
    } else if (top.length >= 2 && max > 0) {
      // Teng ovoz — QAYTA OVOZ: faqat teng qolgan nomzodlar orasida yana bir marta
      // ovoz beriladi. Qayta ovozda ham teng chiqsa — hech kim chiqarilmaydi.
      if (!this.runoffCandidates) {
        const names = top
          .map((id) => this.players.find((p) => p.userId === id)?.displayName ?? '?')
          .join(' va ');
        this.runoffCandidates = top;
        this.votes.clear();
        this.continueVotes.clear();
        this.pushSystem(
          'day',
          `⚖️ Ovozlar teng bo‘ldi — ${names} orasida QAYTA OVOZ e’lon qilinadi!`,
        );
        this.phaseEndsAt = Date.now() + this.settings.votingSeconds * 1000;
        this.hooks.onPhaseChanged();
        this.broadcastSnapshot();
        this.beginPhaseTimer(this.settings.votingSeconds * 1000, () => this.resolveVote());
        return;
      }
      this.pushSystem('day', '⚖️ Qayta ovozda ham tenglik — hech kim chiqarilmadi.');
    }

    const lines = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, c]) => {
        const p = this.players.find((x) => x.userId === id);
        return `• ${p?.displayName ?? id} — ${c} ovoz`;
      });
    this.pushSystem('day', lines.length ? `🗳 Ovoz natijalari:\n${lines.join('\n')}` : '🗳 Hech kim ovoz bermadi.');

    if (eliminatedId !== null) {
      const elim = this.players.find((p) => p.userId === eliminatedId);
      if (elim) {
        elim.alive = false;
        elim.deathRound = this.round;
        elim.deathCause = 'VOTED';
        if (this.settings.revealRolesOnDeath) this.reveals.set(elim.userId, elim.role);

        if (elim.role === 'JESTER') {
          // Jester wins instantly
          this.finish(['INDEPENDENT'], 'Masxaraboz ovoz bilan chiqarildi — tartibsizlik g‘olib!');
          return;
        }
        this.pushSystem('day', `⚖️ ${elim.displayName} chiqarib yuborildi.`);
        if (this.settings.revealRolesOnDeath) {
          this.pushSystem('day', `U ${ROLES[elim.role].name.toUpperCase()} edi.`);
        }
      }
    } else {
      this.pushSystem('day', '⚖️ Shahar bir qarorga kelolmadi. Hech kim chiqarilmadi.');
    }

    // Stall himoyasi: 3 raund ketma-ket hech kim ovoz bermasa va tunda
    // hech kim harakat qilmasa (AFK) — o'yin abadiy aylanmasligi uchun yakunlaymiz
    if (eliminatedId === null && this.nightActions.size === 0 && this.votes.size === 0) {
      this.stallRounds++;
    } else {
      this.stallRounds = 0;
    }
    if (this.stallRounds >= 3) {
      const mafiaLeft = this.alivePlayers().some((p) => isMafia(p.role));
      this.finish(
        [mafiaLeft ? 'MAFIA' : 'TOWN'],
        'Turg‘unlik — 3 raund davomida na ovoz, na tungi harakat bo‘ldi.',
      );
      return;
    }

    this.phase = 'VOTE_RESULT';
    this.runoffCandidates = null;
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
      reason = 'Barcha xavf bartaraf etildi.';
    } else if (mafiaAlive === 1 && townAlive === 1 && skAlive === 0 && indAlive === 0) {
      // 1v1: mafiya tunda baribir o'ldiradi — o'yinni cho'zmaymiz
      winner = 'MAFIA';
      reason = 'Yakama-yakka — Mafiya tunda zarba beradi.';
    } else if (mafiaAlive > 0 && mafiaAlive >= alive.length - mafiaAlive - skAlive - indAlive) {
      winner = 'MAFIA';
      reason = 'Mafiya shahardan ko‘pchilikni tashkil qiladi.';
    } else if (skAlive === 1 && alive.length === 1) {
      winner = 'INDEPENDENT';
      reason = 'Seriyali qotil so‘nggi nafas oluvchi bo‘ldi.';
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
    if (!p) return { ok: false, error: 'O‘yinda emassiz' };
    if (this.over) return { ok: false, error: 'O‘yin tugagan' };
    const trimmed = text.trim().slice(0, 240);
    if (!trimmed) return { ok: false, error: 'Bo‘sh xabar' };

    if (channel === 'day') {
      if (this.phase !== 'DISCUSSION' && this.phase !== 'DAY' && this.phase !== 'VOTING')
        return { ok: false, error: 'Chat yopiq' };
      if (!p.alive) return { ok: false, error: 'O‘lganlar gapirolmaydi' };
    } else if (channel === 'mafia') {
      if (!isMafia(p.role) || !p.alive) return { ok: false, error: 'Ruxsat yo‘q' };
      if (this.phase !== 'NIGHT' && this.phase !== 'DISCUSSION' && this.phase !== 'DAY')
        return { ok: false, error: 'Mafiya chati yopiq' };
    } else {
      // ghosts channel: dead players only
      if (p.alive) return { ok: false, error: 'Tiriklar bu kanalni ko‘rolmaydi' };
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
      senderName: 'TIZIM',
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
    this.runoffCandidates = null;
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
        title: p.title,
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

    const voteLog: GameSnapshot['voteLog'] = this.settings.anonymousVoting
      ? []
      : [...this.votes.entries()].map(([voterId, targetId]) => ({ voterId, targetId }));

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
        shotLeft: you?.role === 'DETECTIVE' && !this.detectiveShots.has(userId),
      },
      players,
      chat: myChannel,
      channels,
      canVote,
      myVote: this.votes.get(userId) ?? null,
      voteCounts: this.settings.anonymousVoting ? {} : voteCounts,
      voteLog,
      runoff: this.runoffCandidates,
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
      title: p.title,
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
  return roles;
}
