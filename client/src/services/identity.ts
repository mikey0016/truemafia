import { getTgUser } from './telegram';

export interface Identity {
  id: number | null;
  name: string;
  photo?: string;
}

const GUEST_KEY = 'tm_guest_name';

/** Telegram bo'lmasa — mehmon ismi (localStorage'da saqlanadi, avatar harfi uchun). */
export function getGuestName(): string {
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 24);
    const name = `Guest${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(GUEST_KEY, name);
    return name;
  } catch {
    return 'Guest';
  }
}

export function setGuestName(name: string): void {
  try {
    localStorage.setItem(GUEST_KEY, name.trim().slice(0, 24));
  } catch {
    /* ignore */
  }
}

/** Telegram user bo'lsa uni, bo'lmasa mehmon identity'ni qaytaradi. */
export function getIdentity(): Identity {
  const tg = getTgUser();
  if (tg) {
    return {
      id: tg.id,
      name: tg.username || tg.first_name || 'Player',
      photo: tg.photo_url,
    };
  }
  return { id: null, name: getGuestName() };
}
