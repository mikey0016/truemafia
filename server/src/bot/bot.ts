/**
 * Telegram Bot — /start bosganda bot haqida ma'lumot + Mini App tugmasi.
 *
 * Qo'shimcha kutubxonasiz, faqat Bot HTTP API (fetch) + getUpdates long polling.
 * - BOT_TOKEN bo'lmasa: jim turadi (Mini App auth'siz local dev'da kerak emas).
 * - WEBAPP_URL (yoki PUBLIC_URL) bo'lsa: "🎮 O'ynash" tugmasi web_app sifatida chiqadi.
 */
import { adminIdList } from '../auth/admin.js';

interface BotConfig {
  webAppUrl: string;
}

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id?: number; first_name?: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id?: number; first_name?: string; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

const START_TEXT = `🎭 <b>Nightfall Mafia — Telegram Mini App</b>

Ko'p o'yinchili «Mafiya» o'yini: do'stlaringiz bilan xona yarating, rol oling, tunda harakat qiling, kunduzi ovoz bering!

<b>Rollar:</b>
🕵️ Mafiya — tunda o'ldiradi
🔎 Detektiv — rolni tekshiradi
💊 Doktor — davolaydi
🧑‍🌾 Fuqaro — muhokama + ovoz
🃏 Mustaqil rollar — o'z sharti bilan yutadi

<b>Fazalar:</b>
LOBBY → NIGHT → DAY → DISCUSSION → VOTING → GAME_OVER

<b>Buyruqlar:</b>
/play — o'yinni ochish
/rules — qoidalar
/help — yordam

Pastdagi tugma orqali o'yinga kiring 👇`;

const RULES_TEXT = `📖 <b>Nightfall Mafia — qisqacha qoidalar</b>

1️⃣ Xona yarating yoki kod orqali qo'shiling (4–15 kishi).
2️⃣ <b>ROLE_REVEAL</b> — rolingizni maxfiy saqlang.
3️⃣ <b>NIGHT</b> — Mafiya o'ldiradi, Detektiv tekshiradi, Doktor davolaydi.
4️⃣ <b>DAY + DISCUSSION</b> — chatda muhokama qiling.
5️⃣ <b>VOTING</b> — shubhali o'yinchiga ovoz bering.
6️⃣ Mafiya shaharliklar soniga tenglashsa — <b>MAFIA</b> yutadi, aks holda — <b>TOWN</b>.

Maslahat: rolni erta oshkor qilmang, Detektiv topilmalari o'yinni buradi!`;

const HELP_TEXT = `🆘 <b>Yordam</b>

/start — bot haqida
/play — Mini App'ni ochish (doim yangi versiya)
/id — sening Telegram ID va admin holati
/rules — o'yin qoidalari
/help — shu xabar

Muammo bo'lsa: avval Telegram'ni yangilang, keyin /play orqali qayta kiring.`;

/**
 * Telegram webview URL bo'yicha cache qiladi — har ochishda unikal param
 * qo'shsak, webview doim eng yangi index.html + bundle'ni yuklaydi.
 */
function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now().toString(36)}`;
}

export function resolveWebAppUrl(): string {
  const url = (
    process.env.WEBAPP_URL ||
    process.env.PUBLIC_URL ||
    'https://mikey0016.github.io/truemafia/'
  ).trim().replace(/\/+$/, '');
  return url || 'https://mikey0016.github.io/truemafia/';
}

function commandOf(text: string | undefined): string {
  if (!text) return '';
  const first = text.trim().split(/\s+/)[0].toLowerCase();
  // "/start@BotName" ko'rinishini ham qo'llash
  return first.split('@')[0];
}

async function api<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`telegram ${method} -> ${res.status}`);
  return (await res.json()) as T;
}

async function sendInfo(token: string, chatId: number, webAppUrl: string): Promise<void> {
  const useWebApp = /^https:\/\//i.test(webAppUrl);
  const playButton = useWebApp
    ? { text: "🎮 O'ynash", web_app: { url: withCacheBust(webAppUrl) } }
    : { text: "🎮 O'ynash", url: withCacheBust(webAppUrl) };
  await api(token, 'sendMessage', {
    chat_id: chatId,
    text: START_TEXT,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [playButton],
        [{ text: '📖 Qoidalar', callback_data: 'rules' }, { text: '🆘 Yordam', callback_data: 'help' }],
      ],
    },
  });
}

async function handleUpdate(token: string, cfg: BotConfig, u: TgUpdate): Promise<void> {
  // Tugmalar (callback)
  if (u.callback_query) {
    const chatId = u.callback_query.message?.chat.id;
    if (chatId) {
      if (u.callback_query.data === 'rules') {
        await api(token, 'sendMessage', { chat_id: chatId, text: RULES_TEXT, parse_mode: 'HTML' });
      } else if (u.callback_query.data === 'help') {
        await api(token, 'sendMessage', { chat_id: chatId, text: HELP_TEXT, parse_mode: 'HTML' });
      } else {
        await sendInfo(token, chatId, cfg.webAppUrl);
      }
    }
    await api(token, 'answerCallbackQuery', { callback_query_id: u.callback_query.id }).catch(() => {});
    return;
  }

  const msg = u.message;
  if (!msg?.text) return;
  const cmd = commandOf(msg.text);
  const chatId = msg.chat.id;

  switch (cmd) {
    case '/start':
      await sendInfo(token, chatId, cfg.webAppUrl);
      break;
    case '/play': {
      const useWebApp = /^https:\/\//i.test(cfg.webAppUrl);
      await api(token, 'sendMessage', {
        chat_id: chatId,
        text: `🎮 <b>O'yinni ochish uchun bosing:</b>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [useWebApp ? { text: "▶️ Boshlash", web_app: { url: withCacheBust(cfg.webAppUrl) } } : { text: '▶️ Boshlash', url: withCacheBust(cfg.webAppUrl) }],
          ],
        },
      });
      break;
    }
    case '/id': {
      const tid = msg.from?.id;
      const isAdmin = typeof tid === 'number' && adminIdList().includes(tid);
      await api(token, 'sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `🆔 <b>Telegram ID:</b> <code>${tid ?? 'nomalum'}</code>\n👮 <b>Admin:</b> ${isAdmin ? 'HA ✅' : 'YOQ ❌'}\n\nAdmin bolish uchun shu ID ADMIN_IDS royxatida bolishi kerak.`,
      });
      break;
    }
    case '/rules':
      await api(token, 'sendMessage', { chat_id: chatId, text: RULES_TEXT, parse_mode: 'HTML' });
      break;
    case '/help':
      await api(token, 'sendMessage', { chat_id: chatId, text: HELP_TEXT, parse_mode: 'HTML' });
      break;
    default:
      break;
  }
}

export function startTelegramBot(): () => void {
  const token = (process.env.BOT_TOKEN || '').trim();
  if (!token) {
    console.log('[bot] BOT_TOKEN topilmadi — Telegram bot o‘chirildi.');
    return () => {};
  }

  const cfg: BotConfig = { webAppUrl: resolveWebAppUrl() };
  let stopped = false;
  let offset = 0;

  console.log(`[bot] polling boshlandi (webApp=${cfg.webAppUrl})`);

  // Menyuda /start, /play, /rules, /help chiqishi uchun
  api(token, 'setMyCommands', {
    commands: [
      { command: 'start', description: "Bot haqida + o'yinni ochish" },
      { command: 'play', description: "Mini App'ni ochish" },
      { command: 'id', description: 'Telegram ID va admin holati' },
      { command: 'rules', description: "O'yin qoidalari" },
      { command: 'help', description: 'Yordam' },
    ],
  }).catch((e) => console.error('[bot] setMyCommands:', e));

  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const data = (await (
          await fetch(
            `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30&allowed_updates=${encodeURIComponent(
              JSON.stringify(['message', 'callback_query']),
            )}`,
            { signal: AbortSignal.timeout(35_000) },
          )
        ).json()) as { ok: boolean; result: TgUpdate[] };

        for (const u of data.result ?? []) {
          offset = Math.max(offset, u.update_id + 1);
          await handleUpdate(token, cfg, u).catch((e) => console.error('[bot] handle error:', e));
        }
      } catch (e) {
        // Tarmoq uzilishi — 2 soniya kutib qayta urinish
        if (!stopped) await new Promise((r) => setTimeout(r, 2000));
        else break;
        void e;
      }
    }
  };

  void loop();

  return () => {
    stopped = true;
  };
}
