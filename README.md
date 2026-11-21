# ♟ Shaxmat: Telegram Mini App

Onlayn shaxmat: akkaunt, do'stlar, chat, reyting, soat, kompyuterga qarshi o'yin.
Tillar: o'zbekcha, ruscha, inglizcha. Tashqi kutubxona yo'q, faqat Node.js 18+.

## Ishga tushirish (kompyuterda sinash)
```
node server.js
```
`http://localhost:3000` ni oching. Akkaunt yarating, ikkinchi brauzer oynasida (yoki inkognito) boshqa akkaunt yarating va o'ynang.

## Telegramga ulash
1. **HTTPS hosting** kerak (Mini App faqat https bilan ishlaydi). Masalan Render, Railway, Fly.io yoki o'z serveringiz (Nginx + Let's Encrypt).
   Server doimiy ishlashi va `data.json` saqlanadigan **doimiy disk** bo'lishi shart.
2. @BotFather: `/newbot` bilan bot yarating, tokenni oling.
3. `/newapp` (yoki `/mybots` → Bot Settings → Menu Button) orqali Mini App manzilini kiriting: `https://sizning-domen.uz/`.
4. Serverni quyidagi o'zgaruvchilar bilan ishga tushiring:

| O'zgaruvchi | Ma'nosi |
|---|---|
| `BOT_TOKEN` | BotFather tokeni. Telegram orqali avtomatik kirish va bot xabarnomalari uchun |
| `BOT_USERNAME` | Bot nomi (`@`siz). Do'st taklif havolasi uchun |
| `APP_NAME` | `/newapp` dagi qisqa nom (havola: `t.me/bot/app?startapp=...`) |
| `APP_URL` | Mini App https manzili. Bot xabaridagi «Ochish» tugmasi uchun |
| `PORT` | Port (standart 3000) |
| `DATA_FILE` | Baza fayli yo'li (standart `./data.json`) |
| `TRUST_PROXY=1` | Nginx/Cloudflare orqasida bo'lsa (so'rov cheklovi to'g'ri IP ni ko'rishi uchun) |

Misol: `BOT_TOKEN=123:ABC BOT_USERNAME=shaxmat_bot APP_NAME=play APP_URL=https://sizning-domen.uz/ node server.js`

## Imkoniyatlar
- Telegram orqali avtomatik kirish yoki login/parol; til tanlash (uz/ru/en)
- Do'st qo'shish (qidiruv, so'rov, qabul/rad), do'st taklif havolasi, bloklash
- Do'stlar bilan chat (o'qilmagan belgisi), o'yin ichida chat va tezkor iboralar
- Do'stni o'yinga chaqirish (vaqt va rang tanlash), tezkor juftlash (reytingi yaqin raqib)
- Soat (1+0 … 15+10 yoki cheksiz), durang taklifi, taslim bo'lish, qayta o'ynash
- To'liq qoidalar: qal'alash, en passant, piyoda almashtirish, mat/pat, 50 yurish, uch marta takrorlanish
- Reyting (Elo), reyting jadvali, g'alaba/durang/mag'lubiyat statistikasi
- Kompyuterga qarshi 4 daraja, maslahat, yurishni qaytarish (internet shart emas)
- Yurishlarni ko'rib chiqish, PGN nusxalash, 4 ta taxta mavzusi, ovoz
- Raqib Telegramni yopib qo'ygan bo'lsa, bot xabar yuboradi (navbat, do'stlik so'rovi, chaqiriq, chat)
- Aloqa uzilsa avtomatik qayta ulanadi

## Xavfsizlik
Parollar `scrypt` bilan, sessiya tokenlari xesh holida saqlanadi. Telegram `initData` imzosi tekshiriladi. Kirish, ro'yxatdan o'tish, chat va yurishlarga so'rov cheklovi bor. Yurishlar faqat serverda tekshiriladi.

## Cheklovlar
- Baza bitta JSON fayl: o'nlab-yuzlab foydalanuvchiga yetadi. Minglab bo'lsa, PostgreSQL ga o'tish kerak.
- Server bitta nusxada ishlaydi (real-time ulanishlar xotirada).
