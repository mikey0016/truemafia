export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'NIGHT_RESULT'
  | 'DAY'
  | 'DISCUSSION'
  | 'VOTING'
  | 'VOTE_RESULT'
  | 'GAME_OVER';

export type Team = 'TOWN' | 'MAFIA' | 'INDEPENDENT';

export type RoleId =
  | 'CITIZEN'
  | 'MAFIA'
  | 'DON'
  | 'DOCTOR'
  | 'DETECTIVE'
  | 'BODYGUARD'
  | 'SERIAL_KILLER'
  | 'JESTER';

export interface RoleDefinition {
  id: RoleId;
  name: string;
  team: Team;
  icon: string;
  tagline: string;
  description: string;
  ability: string;
  color: string;
  nightAction: boolean;
  /** which night-action "slot" this role fills; mafia/don share 'mafia' */
  actionKind?: 'kill' | 'protect' | 'investigate' | 'save';
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  CITIZEN: {
    id: 'CITIZEN',
    name: 'Fuqaro',
    team: 'TOWN',
    icon: 'user',
    tagline: 'MAFIYANI TOPING',
    description: 'Shaharning halol fuqarosi.',
    ability: 'Muhokama qiling va ovoz berib Mafiyani chiqarib yuboring.',
    color: '#94a3b8',
    nightAction: false,
  },
  MAFIA: {
    id: 'MAFIA',
    name: 'Mafiya',
    team: 'MAFIA',
    icon: 'skull',
    tagline: 'SHAHARNI YO‘Q QILING',
    description: 'Jinoiy olam a‘zosi.',
    ability: 'Har tun bir o‘yinchini o‘ldirish uchun tanlang.',
    color: '#ef4444',
    nightAction: true,
    actionKind: 'kill',
  },
  DON: {
    id: 'DON',
    name: 'Don',
    team: 'MAFIA',
    icon: 'crown',
    tagline: 'OILANI BOSHQARING',
    description: 'Mafiya oilasining boshlig‘i.',
    ability: 'Mafiyani boshqaradi va har tun yakuniy o‘ldirish qarorini beradi.',
    color: '#f59e0b',
    nightAction: true,
    actionKind: 'kill',
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'Doktor',
    team: 'TOWN',
    icon: 'plus',
    tagline: 'ULARNI OMON SAQLANG',
    description: 'Qo‘li yengil jarroh.',
    ability: 'Har tun bir o‘yinchini o‘limdan himoya qiling.',
    color: '#22c55e',
    nightAction: true,
    actionKind: 'protect',
  },
  DETECTIVE: {
    id: 'DETECTIVE',
    name: 'Detektiv',
    team: 'TOWN',
    icon: 'search',
    tagline: 'HAQIQATNI BILING',
    description: 'Ziyrak tergovchi.',
    ability: 'Har tun bir o‘yinchini tekshiring: MAFIYA yoki MAFIYA EMAS. Bitta o‘qingiz bor — ishonchingiz komil bo‘lsa otib o‘ldirishingiz mumkin.',
    color: '#38bdf8',
    nightAction: true,
    actionKind: 'investigate',
  },
  BODYGUARD: {
    id: 'BODYGUARD',
    name: 'Tansoqchi',
    team: 'TOWN',
    icon: 'shield',
    tagline: 'O‘Q OLDIDA TURING',
    description: 'O‘qqa ko‘krak tutadigan sodiq himoyachi.',
    ability:
      'Har tun bir o‘yinchini qo‘riqlang. Unga hujum qilinsa, Tansoqchi o‘rniga o‘ladi.',
    color: '#a78bfa',
    nightAction: true,
    actionKind: 'save',
  },
  SERIAL_KILLER: {
    id: 'SERIAL_KILLER',
    name: 'Seriyali qotil',
    team: 'INDEPENDENT',
    icon: 'knife',
    tagline: 'SO‘NGGI NA FAS QOLGUNCHA',
    description: 'Shaxsiy rejali yolg‘iz jinoyatchi.',
    ability: 'Har tun bir o‘yinchini o‘ldiring. Oxirgi tirik qolgan sifatida yolg‘iz yutasiz.',
    color: '#a3e635',
    nightAction: true,
    actionKind: 'kill',
  },
  JESTER: {
    id: 'JESTER',
    name: 'Masxaraboz',
    team: 'INDEPENDENT',
    icon: 'masks',
    tagline: 'HAMMANI ALDANG',
    description: 'Begunohlar orasiga yashiringan tartibsizlik agenti.',
    ability: 'Kunduzi ovoz bilan chiqarilsa darhol yutadi.',
    color: '#ec4899',
    nightAction: false,
  },
};

export interface RoomSettings {
  gameType: 'CLASSIC' | 'ADVANCED' | 'CUSTOM';
  playerCount: number;
  mafiaCount: number;
  donEnabled: boolean;
  doctorEnabled: boolean;
  detectiveEnabled: boolean;
  bodyguardEnabled: boolean;
  serialKillerEnabled: boolean;
  jesterEnabled: boolean;
  discussionSeconds: number;
  votingSeconds: number;
  nightSeconds: number;
  privateRoom: boolean;
  revealRolesOnDeath: boolean;
  anonymousVoting: boolean;
  /** Botlar soni (0 = yo‘q). O‘yin boshlanishida lobby‘ga qo‘shiladi. */
  botCount: number;
  /**
   * Karta tanlash rejimi: random o‘rniga har kim lobby‘da o‘z kartasini tanlaydi
   * (bo‘sh kartalar startda random to‘ldiriladi).
   */
  roleDraft: boolean;
}

export interface PublicPlayer {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  seat: number;
  /** marketdan kiyilgan unvon (kosmetik) */
  title?: string;
}

export interface PlayerCardView {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  seat: number;
  alive: boolean;
  connected: boolean;
  isBot: boolean;
  /** your own role, or revealed roles (on death when setting enabled) */
  role?: RoleId;
  /** marketdan kiyilgan unvon (kosmetik) */
  title?: string;
  /** true when you and target share a night chat channel (mafia) */
  ally?: boolean;
}

export interface ChatMessage {
  id: string;
  channel: 'day' | 'mafia' | 'ghosts';
  senderId: number; // 0 = system
  senderName: string;
  photoUrl?: string;
  text: string;
  at: number;
}

export interface PhaseInfo {
  phase: GamePhase;
  round: number;
  endsAt: number | null; // server epoch ms
  secondsLeft: number;
}

export interface GameSnapshot {
  roomId: string;
  roomCode: string;
  phase: PhaseInfo;
  you: {
    userId: number;
    alive: boolean;
    role: RoleId | null;
    hasActed: boolean;
    investigations: { targetId: number; result: 'MAFIA' | 'NOT_MAFIA' }[];
    /** detektivning bir martalik o‘qi qolganmi */
    shotLeft: boolean;
  };
  players: PlayerCardView[];
  chat: ChatMessage[];
  channels: ('day' | 'mafia' | 'ghosts')[];
  canVote: boolean;
  myVote?: number | null;
  voteCounts?: Record<string, number>;
  /** kim kimga ovoz bergan (yashirin ovoz rejimida bo‘sh) */
  voteLog?: { voterId: number; targetId: number }[];
  /** qayta ovoz (runoff): faqat shu nomzodlar orasida ovoz beriladi */
  runoff?: number[] | null;
  settings: RoomSettings;
  winner: Team | null;
}

export interface ProfileStats {
  userId: number;
  username: string;
  photoUrl?: string;
  level: number;
  xp: number;
  xpToNext: number;
  games: number;
  wins: number;
  mafiaWins: number;
  townWins: number;
  independentWins: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  reputation: number;
  coins: number;
  achievements: { id: string; unlockedAt: number }[];
  /** marketdan kiyilgan avatar ramkasi (frame_bronze|frame_neon|frame_gold) */
  frame?: string;
  /** marketdan kiyilgan unvon matni */
  title?: string;
  /** shu foydalanuvchi adminmi (ADMIN_IDS) */
  isAdmin?: boolean;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  photoUrl?: string;
  wins: number;
  games: number;
  rating: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rare?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'FIRST_BLOOD', name: 'Ilk qon', description: 'Birinchi o‘yiningizni yuting.', icon: 'drop' },
  { id: 'SHADOW', name: 'Soya', description: '5 ta Mafiya o‘yinida yuting.', icon: 'skull' },
  {
    id: 'DETECTIVE',
    name: 'Detektiv',
    description: 'Mafiyani 10 marta muvaffaqiyatli aniqlang.',
    icon: 'search',
  },
  { id: 'SURVIVOR', name: 'Omon qolgan', description: '10 ta o‘yinda omon qoling.', icon: 'shield' },
  {
    id: 'LAST_STANDING',
    name: 'So‘nggi tik turgan',
    description: 'G‘alabada oxirgi tirik o‘yinchi bo‘ling.',
    icon: 'crown',
    rare: true,
  },
  { id: 'VETERAN', name: 'Faxriy', description: '25 ta o‘yin o‘ynang.', icon: 'user' },
];
