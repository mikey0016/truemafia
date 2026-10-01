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
  assert(SHOP_ITEMS.length === 4, 'katalogda 4 rol');
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
  await db.run('UPDATE users SET coins = 500 WHERE user_id = 42');
  const ok = await users.buyItem(42, 'role_don', 300);
  assert(ok.ok && ok.balance === 200, 'sotib olindi, balans 200');
  assert(await users.ownsItem(42, 'role_don'), 'egalik yozildi');
  assert((await users.ownedItems(42)).includes('role_don'), 'royxatda bor');

  // ikkinchi marta — Already owned, pul yechilmaydi
  const dbl = await users.buyItem(42, 'role_don', 300);
  assert(!dbl.ok && dbl.balance === 200, 'qayta olinmaydi, balans ozgarmaydi');

  db.close();
  console.log('PASS: market buy/insufficient/double-buy/owns.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
