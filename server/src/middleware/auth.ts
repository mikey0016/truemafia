import type { NextFunction, Request, Response } from 'express';
import {
  guestUser,
  logAuthFailure,
  parseInitDataInsecure,
  validateInitDataDetailed,
  type TelegramAuthUser,
} from '../auth/telegram.js';
import { isAdminId } from '../auth/admin.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tgUser?: TelegramAuthUser;
    }
  }
}

const DEV_SKIP = (): boolean =>
  process.env.DEV_SKIP_AUTH === '1' && process.env.NODE_ENV !== 'production';

/** Mehmon id faqat manfiy butun son (real Telegram id'lar musbat). */
function parseGuestId(raw: unknown): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string' || !/^-\d{6,12}$/.test(s.trim())) return null;
  const n = parseInt(s.trim(), 10);
  return Number.isSafeInteger(n) ? n : null;
}

function parseGuestName(raw: unknown): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, 24).replace(/[<>&"']/g, '');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const botToken = process.env.BOT_TOKEN || '';
  const header = req.headers['x-telegram-init-data'] || '';
  const initData = Array.isArray(header) ? header[0] : header;
  const result = botToken ? validateInitDataDetailed(initData, botToken) : { user: null };

  if (result.user) {
    req.tgUser = result.user;
  } else if (DEV_SKIP()) {
    // dev fallback: parse without verification so local testing works
    req.tgUser = parseInitDataInsecure(initData) || {
      userId: 1,
      username: 'devuser',
      displayName: 'Dev User',
      authDate: Date.now(),
    };
  } else {
    // Telegram imzosi yaroqsiz — mehmon rejimiga tushirish (o'yin davom etsin).
    const guestId = parseGuestId(req.headers['x-guest-id']);
    if (guestId !== null) {
      const guestName = parseGuestName(req.headers['x-guest-name']) || `Guest${-guestId % 10000}`;
      req.tgUser = guestUser(guestId, guestName);
      if (result.failure) logAuthFailure('REST', `${result.failure} -> guest`);
    } else {
      logAuthFailure('REST', result.failure || 'no guest id');
      res.status(401).json({ error: 'Ruxsatsiz' });
      return;
    }
  }
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const uid = req.tgUser?.userId;
  if (!uid || !isAdminId(uid)) {
    res.status(403).json({ error: 'Taqiqlangan' });
    return;
  }
  next();
}
