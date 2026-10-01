import crypto from 'node:crypto';

export interface TelegramAuthUser {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  authDate: number;
  /** true = Telegram'siz mehmon (brauzer). Real id'lar har doim musbat. */
  isGuest?: boolean;
}

export type InitDataFailure =
  | 'empty initData'
  | 'no bot token'
  | 'no hash'
  | 'bad signature'
  | 'expired initData'
  | 'no user'
  | 'invalid user';

export interface ValidateResult {
  user: TelegramAuthUser | null;
  /** user === null bo'lsa — nima uchun rad etilgani (diagnostika uchun). */
  failure?: InitDataFailure;
}

/** .env'dan o'qilganda yuzaga keladigan probel/qatorlarni tozalash. */
function normalizeToken(raw: string | undefined): string {
  // Ba'zilar tokenni "bot123:ABC" ko'rinishida nusxalaydi — "bot" prefiksi ham qabul qilinadi.
  return (raw || '').trim().replace(/^bot(?=\d)/i, '');
}

function maxAgeMs(): number {
  const h = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_HOURS || '', 10);
  return Number.isFinite(h) && h > 0 ? h * 3600_000 : 24 * 3600_000;
}

/**
 * Validates Telegram WebApp initData per official spec:
 *   secret_key = HMAC_SHA256("WebAppData", bot_token)
 *   computed   = HMAC_SHA256(secret_key, data_check_string)
 *   valid      = computed === hash
 * (data_check_string = decoded values, sorted by key — rasmiy test vektori bilan tekshirilgan.)
 * Rejects data older than 24h (TELEGRAM_AUTH_MAX_AGE_HOURS bilan sozlanadi) unless maxAge check disabled.
 */
export function validateInitDataDetailed(
  initData: string,
  botToken: string,
  opts: { maxAgeMs?: number } = {},
): ValidateResult {
  const token = normalizeToken(botToken);
  if (!initData) return { user: null, failure: 'empty initData' };
  if (!token) return { user: null, failure: 'no bot token' };
  try {
    const params = new URLSearchParams(initData);
    const hash = (params.get('hash') || '').toLowerCase();
    params.delete('hash');
    params.delete('signature');
    if (!hash) return { user: null, failure: 'no hash' };

    const pairs: string[] = [];
    const keys = [...params.keys()].sort();
    for (const k of keys) pairs.push(`${k}=${params.get(k)}`);
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed !== hash) return { user: null, failure: 'bad signature' };

    const userRaw = params.get('user');
    if (!userRaw) return { user: null, failure: 'no user' };
    let user: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    };
    try {
      user = JSON.parse(userRaw);
    } catch {
      return { user: null, failure: 'invalid user' };
    }
    if (typeof user?.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) {
      return { user: null, failure: 'invalid user' };
    }

    const authDate = parseInt(params.get('auth_date') || '0', 10) * 1000;
    const maxAge = opts.maxAgeMs ?? maxAgeMs();
    // maxAge = 0 — tekshiruvni o'chirish (tma.js konventsiyasi).
    if (maxAge > 0 && authDate && Date.now() - authDate > maxAge) {
      return { user: null, failure: 'expired initData' };
    }

    return {
      user: {
        userId: user.id,
        username: user.username || `user${user.id}`,
        displayName:
          [user.first_name, user.last_name].filter(Boolean).join(' ') ||
          user.username ||
          `User ${user.id}`,
        photoUrl: user.photo_url,
        authDate,
      },
    };
  } catch {
    return { user: null, failure: 'bad signature' };
  }
}

/** Orqaga moslik uchun saqlangan qisqa variant. */
export function validateInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeMs?: number } = {},
): TelegramAuthUser | null {
  return validateInitDataDetailed(initData, botToken, opts).user;
}

/** Mehmon (guest) foydalanuvchi — id manfiy, real Telegram id'lar bilan to'qnashmaydi. */
export function guestUser(guestId: number, guestName: string): TelegramAuthUser {
  return {
    userId: guestId,
    username: guestName,
    displayName: guestName,
    authDate: Date.now(),
    isGuest: true,
  };
}

/** Foydalanuvchiga ko'rinadigan auth xato sababi (ichki kodlar inglizcha qoladi). */
export function failureUz(failure: string): string {
  switch (failure) {
    case 'empty initData':
      return 'bo‘sh initData';
    case 'no bot token':
    case 'no server token':
      return 'serverda token yo‘q';
    case 'no hash':
      return 'imzo yo‘q';
    case 'bad signature':
      return 'imzo xato';
    case 'no user':
    case 'invalid user':
      return 'foydalanuvchi topilmadi';
    case 'expired initData':
      return 'muddati o‘tgan';
    case 'no guest id':
      return 'mehmon id yo‘q';
    default:
      return 'noma’lum';
  }
}

/**
 * Diagnostika: auth muvaffaqiyatsizliklarini (birinchi 10 tasini) loglaydi.
 * BOT_TOKEN id'si (nuqtadan oldingi qism) ko'rsatiladi — token mismatch'ni aniqlashga yordam beradi.
 */
let authFailLogs = 0;
export function logAuthFailure(kind: string, failure: string): void {
  if (authFailLogs >= 10) return;
  authFailLogs++;
  const token = (process.env.BOT_TOKEN || '').trim();
  const botId = token.split(':')[0];
  console.warn(
    `[auth] ${kind} auth failed (${failure}); BOT_TOKEN=${token ? `set (id ${botId})` : 'MISSING'}`,
  );
}

/** Dev-only: parse initData without verifying the signature (local testing without a real bot). */
export function parseInitDataInsecure(initData: string): TelegramAuthUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    };
    return {
      userId: user.id,
      username: user.username || `user${user.id}`,
      displayName:
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.username ||
        `User ${user.id}`,
      photoUrl: user.photo_url,
      authDate: Date.now(),
    };
  } catch {
    return null;
  }
}
