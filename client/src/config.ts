// GitHub Pages (static) da frontend alohida host qilinadi,
// backend (Express + Socket.IO) esa Render/Fly da turadi.
//
// Ustuvorlik: Settings'da saqlangan URL (localStorage) > build-time VITE_BACKEND_URL > '' (relative).
const BUILD_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '')
  .trim()
  .replace(/\/+$/, '');

const LS_KEY = 'tm_backend_url';

export function getBackendUrl(): string {
  try {
    const saved = localStorage.getItem(LS_KEY)?.trim().replace(/\/+$/, '');
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return BUILD_URL;
}

export function setBackendUrl(url: string): void {
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean) localStorage.setItem(LS_KEY, clean);
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated getBackendUrl() ishlating (Settings override'ni hisobga oladi). */
export const BACKEND_URL = BUILD_URL;

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${getBackendUrl()}${path}`;
}
