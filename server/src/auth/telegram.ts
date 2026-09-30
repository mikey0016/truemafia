import crypto from 'node:crypto';

export interface TelegramAuthUser {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  authDate: number;
}

/**
 * Validates Telegram WebApp initData per official spec:
 *   secret_key = HMAC_SHA256("WebAppData", bot_token)
 *   computed   = HMAC_SHA256(secret_key, data_check_string)
 *   valid      = computed === hash
 * Rejects data older than 24h (anti-replay) unless DEV_SKIP_AUTH dev mode.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeMs?: number } = {},
): TelegramAuthUser | null {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    params.delete('hash');
    params.delete('signature');
    const pairs: string[] = [];
    const keys = [...params.keys()].sort();
    for (const k of keys) pairs.push(`${k}=${params.get(k)}`);
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed !== hash) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    };

    const authDate = parseInt(params.get('auth_date') || '0', 10) * 1000;
    const maxAge = opts.maxAgeMs ?? 24 * 3600_000;
    if (authDate && Date.now() - authDate > maxAge) return null;

    return {
      userId: user.id,
      username: user.username || `user${user.id}`,
      displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `User ${user.id}`,
      photoUrl: user.photo_url,
      authDate,
    };
  } catch {
    return null;
  }
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
      displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `User ${user.id}`,
      photoUrl: user.photo_url,
      authDate: Date.now(),
    };
  } catch {
    return null;
  }
}
