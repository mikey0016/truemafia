/** ADMIN_IDS ro'yxati + dev rejim uchun umumiy admin tekshiruvi. */

export function adminIdList(): number[] {
  return (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/**
 * Admin tekshiruvi: ADMIN_IDS ichida bo'lsa admin. Qo'shimcha — dev rejimda
 * (DEV_SKIP_AUTH=1, NODE_ENV!=production) dev user (id=1) ham panelni ko'rsin,
 * lokal testlar uchun. Produksiyada faqat ADMIN_IDS ishlaydi.
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
