/** ADMIN_IDS ro'yxati + dev rejim uchun umumiy admin tekshiruvi. */

/**
 * Kod ichidagi zaxira admin ro'yxati — Render env'da ADMIN_IDS yozilmasa ham
 * egasi panelga kira olsin. Telegram id maxfiy emas; adminlik faqat
 * BOT_TOKEN bilan imzolangan initData orqali isbotlanadi.
 */
const BUILTIN_ADMIN_IDS: number[] = [7692914031];

export function adminIdList(): number[] {
  const fromEnv = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  return [...new Set([...BUILTIN_ADMIN_IDS, ...fromEnv])];
}

/**
 * Admin tekshiruvi: ADMIN_IDS (yoki zaxira ro'yxat) ichida bo'lsa admin.
 * Qo'shimcha — dev rejimda (DEV_SKIP_AUTH=1) dev user (id=1) ham ko'radi.
 */
export function isAdminId(uid: number | null | undefined): boolean {
  if (uid === null || uid === undefined) return false;
  if (adminIdList().includes(uid)) return true;
  return (
    process.env.DEV_SKIP_AUTH === '1' &&
    process.env.NODE_ENV !== 'production' &&
    uid === 1
  );
}
