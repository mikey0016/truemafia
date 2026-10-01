# True Mafia 🎭

Telegram Mini App orqali o'ynaladigan ko'p o'yinchili «Mafiya» o'yini. Real vaqt rejimida ovoz berish, tungi harakatlar, botlar va to'liq statistika bilan.

## Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Server | Node.js 24+, TypeScript, Express, Socket.IO, `node:sqlite` |
| Client | React 18, Vite, Zustand, Socket.IO Client |
| Umumiy | `shared/` workspace — protokol, rollar, konstantalar |
| Ma'lumotlar bazasi | SQLite (standart) yoki PostgreSQL (`DB_CLIENT=postgres`) |
| Deploy | Render (Docker), Dockerfile tayyor |

## Loyiha tuzilishi

```
├── client/          # React + Vite (Telegram Mini App UI)
│   └── src/screens/ # Home, Lobby, Game, Profile, Leaderboard, ...
├── server/          # Express + Socket.IO o'yin serveri
│   └── src/
│       ├── game/    # Engine (holat mashinasi), RoomManager, botlar
│       ├── websocket/handler.ts
│       ├── routes/api.ts
│       ├── services/ # UserService, GameRecorder
│       └── database/ # db.ts (SQLite/PG), migrate.ts
└── shared/          # Protokol turlari, rollar, konstantalar
```

## Ishga tushirish (lokal)

Talablar: **Node.js >= 24** (`node:sqlite` uchun).

```bash
npm install          # barcha workspace'lar
cp .env .env.local   # yoki .env ni to'ldiring (hozirgi .env ishlaydi)
npm run dev          # server (:3000) + client (:5173) birga
```

- Client: http://localhost:5173 (Vite proxy `/api` va socket'larni :3000 ga yo'naltiradi)
- Dev rejimida `.env` ga `DEV_SKIP_AUTH=1` qo'yilsa Telegram autentifikatsiyasiz kirish mumkin (faqat `NODE_ENV!=production` da ishlaydi)

### Testlar

```bash
npm test             # engine + gameRecorder testlari
npm run typecheck    # tsc -b shared server client
```

## Environment o'zgaruvchilari

| O'zgaruvchi | Majburiy | Tavsif |
|-------------|----------|--------|
| `DATABASE_URL` | ✅ | SQLite fayl yo'li (masalan `./data/true-mafia.sqlite`) **yoki** `DB_CLIENT=postgres` bo'lsa Postgres connection string |
| `DB_CLIENT` | — | `postgres` bo'lsa PostgreSQL ishlatiladi, aks holda SQLite |
| `BOT_TOKEN` | ✅ (prod) | Telegram bot tokeni — `initData` imzosini tekshirish + `/start` javobi uchun. **MUHIM:** Mini App ochilgan bot bilan aynan bir xil token bo'lishi shart, aks holda auth `bad signature` beradi |
| `TELEGRAM_AUTH_MAX_AGE_HOURS` | — | initData yashash muddati (soat). Standart: 24. Telegram soati orqada qolsa bu qiymatni oshiring |
| `WEBAPP_URL` | — | Mini App URL (`/start` dagi 🎮 tugma uchun). Standart: `https://mikey0016.github.io/truemafia/` |
| `ADMIN_IDS` | — | Vergul bilan ajratilgan admin Telegram ID'lari |
| `PORT` | — | Standart: `3000` |
| `DEV_SKIP_AUTH` | — | `1` = dev rejimida auth'ni o'tkazib yuborish |
| `DEV_BOTS` | — | `1` = dev rejimida botlarni yoqish |
| `VITE_API_URL` | — | Client dev proxy uchun (standart: `http://localhost:3000`) |

## Deploy (Render)

Blueprint tayyor: `render.yaml` → Render Dashboard → **New → Blueprint** → repoga ulashing.

1. **Postgres**: Neon (yoki boshqa) dan connection string oling
2. Render'da env qilib qo'ying:
   - `DATABASE_URL` = postgres connection string
   - `BOT_TOKEN` = @BotFather dan olingan token
   - `ADMIN_IDS` = o'zingizning Telegram ID
3. `DB_CLIENT=postgres` blueprint'da allaqachon bor — server Postgres'ga ulanadi
4. Health check: `/api/health`

> **Muhim**: Render'da bepul plan diskni saqlamaydi — shuning uchun Postgres ishlatiladi. Agar SQLite bilan qisqa muddatli test qilmoqchi bo'lsangiz, `DB_CLIENT` o'chirib qo'ying (konteyner qayta yoqilganda ma'lumot yo'qoladi).

### BotFather sozlamalari

1. @BotFather → `/newbot` → token'ni `BOT_TOKEN` qilib qo'ying
2. `/newapp` yoki Bot Settings → Menu Button → Web App URL = Render URL'ingiz
3. Mini App Tayyor!

Botda `/start` bossangiz — bot haqida ma'lumot (rollar, fazalar) + 🎮 O'ynash tugmasi chiqadi. Tugma `WEBAPP_URL` ga ochiladi. Qo'shimcha: `/play`, `/rules`, `/help`.

## O'yin qoidalari (qisqacha)

- **Rollar**: Mafiya (tunda o'ldiradi), Detektiv (tekshiradi), Doktor (davolaydi), Oddiy fuqarolar, Mustaqil rollar
- **Fazalar**: LOBBY → NIGHT → NIGHT_RESULT → DAY → DISCUSSION → VOTING → VOTE_RESULT → GAME_OVER
- **🤖 Botlar**: Create Room'da BOTS sonini tanlang — lobby botlar bilan to'ladi, o'yin to'liq o'tadi. Botli o'yinlar reytingga yozilmaydi (casual)
- **🎴 Role draft**: Create Room'da yoqilsa, random o'rniga har kim lobby'da o'z kartasini tanlaydi (kim birinchi — o'shaniki). **Tanlov yashirin**: kim nima olgani ko'rinmaydi, har kim faqat o'z kartasini ko'radi. Qolgan kartalar startda random tarqatiladi

## Skriptlar

| Buyruq | Nima qiladi |
|--------|-------------|
| `npm run dev` | Server + client parallel (watch rejimida) |
| `npm run build` | Shared + client production build |
| `npm start` | Faqat server (production) |
| `npm test` | Server testlari (engine, recorder, auth, draft) |
| `npm run typecheck` | Barcha workspace'larni tip tekshiruvi |
