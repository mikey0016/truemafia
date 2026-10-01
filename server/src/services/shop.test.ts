/**
 * Market test: catalog, buy success / insufficient / double-buy, ownsItem.
 * Run: npm -w server run test:shop
 */
import { SHOP_ITEMS, isPremiumRole } from '@truemafia/shared';
import { createDb, type Db } from '../database/db.js';
import { migrate } from '../database/migrate.js';
import { UserService } from '../services/userService.js';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main(): Promise<void> {
  const roleItems = SHOP_ITEMS.filter((i) => i.kind === 'role');
  const frameItems = SHOP_ITEMS.filter((i) => i.kind === 'frame');
  const titleItems = SHOP_ITEMS.filter((i) => i.kind === 'title');
  assert(roleItems.length === 4, 'katalogda 4 premium rol');
  assert(frameItems.length === 3, '3 ramka');
  assert(titleItems.length === 3, '3 unvon');
  assert(isPremiumRole('DON'), 'DON premium');
  assert(!isPremiumRole('MAFIA'), 'MAFIA bepul');
  assert(!isPremiumRole('CITIZEN'), 'CITIZEN bepul');

  const db: Db = await createDb(':memory:');
  await migrate(db);
  const users = new UserService(db);
  await users.upsertFromTelegram({ userId: 42, username: 'buyer', displayName: 'Buyer' });
  // yangi user: 100 coin (default)
  assert(!(await users.ownsItem(42, 'role_don')), 'hali olinmagan');

  // yetmaydi (DON 300 > 100)
  const poor = await users.buyItem(42, 'role_don', 300);
  assert(!poor.ok && poor.balance === 100, 'coin yetmaydi');
  assert(!(await users.ownsItem(42, 'role_don')), 'berilmagan');

  // coin qo'shib sotib olish (win bonusi simulyatsiyasi)
  await db.run('UPDATE users SET coins = 800 WHERE user_id = 42');
  const ok = await users.buyItem(42, 'role_don', 300);
  assert(ok.ok && ok.balance === 500, 'sotib olindi, balans 500');
  assert(await users.ownsItem(42, 'role_don'), 'egalik yozildi');
  assert((await users.ownedItems(42)).includes('role_don'), 'royxatda bor');

  // ikkinchi marta — Already owned, pul yechilmaydi
  const dbl = await users.buyItem(42, 'role_don', 300);
  assert(!dbl.ok && dbl.balance === 500, 'qayta olinmaydi, balans ozgarmaydi');

  // ramka olish + kiyish
  const frame = frameItems[0];
  assert(!(await users.ownsItem(42, frame.id)), 'ramka hali yoq');
  const buyF = await users.buyItem(42, frame.id, frame.price);
  assert(buyF.ok, 'ramka olindi');
  const notOwnedEquip = await users.equipItem(42, 'frame_gold');
  assert(!notOwnedEquip.ok, 'olinmagan ramka kiyilmaydi');
  const eq = await users.equipItem(42, frame.id);
  assert(eq.ok && eq.frame === frame.value, 'ramka kiyildi');
  const profile = await users.getProfile(42);
  assert(profile?.frame === frame.value, 'profilida ramka');

  // unvon olish + kiyish
  const title = titleItems[0];
  await db.run('UPDATE users SET coins = 500 WHERE user_id = 42');
  const buyT = await users.buyItem(42, title.id, title.price);
  assert(buyT.ok, 'unvon olindi');
  const eqT = await users.equipItem(42, title.id);
  assert(eqT.ok && eqT.title === title.value, 'unvon kiyildi');
  const profile2 = await users.getProfile(42);
  assert(profile2?.title === title.value, 'profilida unvon');

  // rolni kiyib bo'lmaydi
  const eqRole = await users.equipItem(42, 'role_don');
  assert(!eqRole.ok, 'rol kiyilmaydi (faqat draftda)');

  // yechish
  await users.unequipItem(42, 'frame');
  const profile3 = await users.getProfile(42);
  assert(!profile3?.frame, 'ramka yechildi');

  db.close();
  console.log('PASS: market buy/insufficient/double-buy/owns/equip frame+title.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
