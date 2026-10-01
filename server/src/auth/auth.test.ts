/**
 * Auth unit test: initData validation (rasmiy test vektori) + guest helper.
 * Run: npm -w server run test:auth
 */
import {
  guestUser,
  validateInitData,
  validateInitDataDetailed,
} from '../auth/telegram.js';
import crypto from 'node:crypto';

// Rasmiy Telegram hujjatlaridagi test vektor (WebApp token + initData + hash).
const OFFICIAL_INITDATA =
  'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%7D&auth_date=1662771648';
const OFFICIAL_TOKEN = '5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8';
const OFFICIAL_HASH = 'c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';
// Rasmiy vektorda hash yo'q — validatsiya uchun hash qo'shilgan variant kerak.
const OFFICIAL_INITDATA_SIGNED = `${OFFICIAL_INITDATA}&hash=${OFFICIAL_HASH}`;

function sign(token: string, initData: string): string {
  // Imzolash uchun rasmiy algoritm (decode qilingan qiymatlar, saralangan).
  const params = new URLSearchParams(initData);
  params.delete('hash');
  params.delete('signature');
  const pairs = [...params.keys()].sort().map((k) => `${k}=${params.get(k)}`);
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  return crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
}

function freshInitData(token: string, authDate: number): string {
  const userObj = { id: 279058397, first_name: 'Vladislav', username: 'vdkfrost' };
  const userEncoded = encodeURIComponent(JSON.stringify(userObj));
  // Imzo DECODE qilingan qiymatlar bilan (rasmiy spetsifikatsiya),
  // initData'ga esa ENCODE qilingan holda qo'shiladi.
  const dcs = `query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=${JSON.stringify(userObj)}&auth_date=${authDate}`;
  return `query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=${userEncoded}&auth_date=${authDate}&hash=${sign(
    token,
    dcs,
  )}`;
}

let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`  ok: ${name}`);
  else {
    console.error(`  FAIL: ${name}`);
    failed++;
  }
}

function main(): void {
  // 1. Rasmiy test vektori
  const official = validateInitDataDetailed(OFFICIAL_INITDATA_SIGNED, OFFICIAL_TOKEN, {
    maxAgeMs: 0,
  });
  check('official vector accepted', official.user !== null);
  check('official userId', official.user?.userId === 279058397);
  check('official displayName', official.user?.displayName === 'Vladislav Kibenko');

  // 2. Noto'g'ri token -> bad signature
  const badToken = validateInitDataDetailed(OFFICIAL_INITDATA_SIGNED, '12345:WRONGTOKEN', {
    maxAgeMs: 0,
  });
  check('wrong token rejected', badToken.user === null && badToken.failure === 'bad signature');

  // 3. Bo'sh initData
  check(
    'empty initData rejected',
    validateInitDataDetailed('', OFFICIAL_TOKEN).failure === 'empty initData',
  );

  // 4. Hash yo'q
  const noHash = OFFICIAL_INITDATA;
  check(
    'missing hash rejected',
    validateInitDataDetailed(noHash, OFFICIAL_TOKEN).failure === 'no hash',
  );

  // 5. Eskirgan initData — yangi imzolangani maxAge'dan oshsa rad etiladi
  const nowSec = Math.floor(Date.now() / 1000);
  const oldData = freshInitData(OFFICIAL_TOKEN, nowSec - 25 * 3600);
  const expired = validateInitDataDetailed(oldData, OFFICIAL_TOKEN, { maxAgeMs: 24 * 3600_000 });
  check('expired rejected', expired.user === null && expired.failure === 'expired initData');

  // 6. Yangi imzolangan initData (auth_date = hozir) qabul qilinadi
  const now = Math.floor(Date.now() / 1000);
  const fresh = validateInitDataDetailed(freshInitData(OFFICIAL_TOKEN, now), OFFICIAL_TOKEN, {
    maxAgeMs: 24 * 3600_000,
  });
  check('fresh signed initData accepted', fresh.user !== null);
  check('fresh userId', fresh.user?.userId === 279058397);

  // 7. "bot" prefiksli token ham ishlaydi
  const prefixed = validateInitData(OFFICIAL_INITDATA_SIGNED, `bot${OFFICIAL_TOKEN}`, {
    maxAgeMs: 0,
  });
  check('bot-prefixed token accepted', prefixed?.userId === 279058397);

  // 8. guestUser
  const g = guestUser(-123456789, 'Guest1');
  check('guest id negative', g.userId < 0 && g.isGuest === true);

  if (failed > 0) {
    console.error(`FAIL: ${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('PASS: auth validation tests.');
  process.exit(0);
}

main();
