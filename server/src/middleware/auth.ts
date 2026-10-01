import type { NextFunction, Request, Response } from 'express';
import { parseInitDataInsecure, validateInitData, type TelegramAuthUser } from '../auth/telegram.js';

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
  return Number.isSafeInteger(n) && n < 0 ? n : null;
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
  const user = botToken ? validateInitData(initData, botToken) : null;

  if (user) {
    req.tgUser = user;
  } else if (DEV_SKIP()) {
    // dev fallback: parse without verification so local testing works
    req.tgUser = parseInitDataInsecure(initData) || {
      userId: 1,
      username: 'devuser',
      displayName: 'Dev User',
      authDate: Date.now(),
    };
  } else {
    // Mehmon rejimi: Telegram'siz brauzerda o'ynash uchun (id manfiy bo'ladi).
    const guestId = parseGuestId(req.headers['x-guest-id']);
    if (guestId !== null) {
      const guestName = parseGuestName(req.headers['x-guest-name']) || `Guest${-guestId % 10000}`;
      req.tgUser = {
        userId: guestId,
        username: guestName,
        displayName: guestName,
        authDate: Date.now(),
        isGuest: true,
      };
    } else {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ids = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  const uid = req.tgUser?.userId;
  if (!uid || !ids.includes(uid)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
