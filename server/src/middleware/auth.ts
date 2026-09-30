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

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const DEV_SKIP = process.env.DEV_SKIP_AUTH === '1' && process.env.NODE_ENV !== 'production';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['x-telegram-init-data'] || '';
  const initData = Array.isArray(header) ? header[0] : header;
  const user = BOT_TOKEN ? validateInitData(initData, BOT_TOKEN) : null;

  if (user) {
    req.tgUser = user;
  } else if (DEV_SKIP) {
    // dev fallback: parse without verification so local testing works
    req.tgUser = parseInitDataInsecure(initData) || {
      userId: 1,
      username: 'devuser',
      displayName: 'Dev User',
      authDate: Date.now(),
    };
  } else {
    res.status(401).json({ error: 'Unauthorized' });
    return;
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
