// GitHub Pages (static) da frontend alohida host qilinadi,
// backend (Express + Socket.IO) esa Render/Fly da turadi.
// VITE_BACKEND_URL bo'sh bo'lsa — relative (/api) ishlatiladi (local + Telegram WebApp bir domenda).
const raw = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '';

export const BACKEND_URL = raw.trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${BACKEND_URL}${path}`;
}
