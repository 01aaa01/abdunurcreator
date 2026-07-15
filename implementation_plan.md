# AbdunurCreator - Bot Integration & Fullstack Upgrade Plan

Bizning maqsadimiz hozirgi statik `a.html` saytini haqiqiy Telegram botga ulangan, reklama tizimiga ega, va yangi AI bo'limlari qo'shilgan to'laqonli web-ilovaga aylantirishdir. 

## User Review Required

> [!IMPORTANT]
> Loyiha Node.js va Telegram bot API yordamida ishlashi uchun bizga orqa fon (backend) server kerak bo'ladi. Men fayllarni strukturalashtirib, `server.js` ni yarataman. Siz bu rejaga rozi bo'lsangiz, men kodlarni yozishni boshlayman. 
> Saytning orqa fonidagi (background) rasmlar va dizayn uchun men internetdagi mavjud tekin rasmlar va sifatli CSS animatsiyalaridan foydalanaman.

## Open Questions

- Telegram bot tokeni to'g'ri ishlayotganligiga ishonchingiz komilmi? Manabu token ishlatiladi: `8913262769:AAHIqKxQKMl1ANSp-jh6FGkcgLY92W6YhwE`.
- Ma'lumotlarni vaqtincha faylda (`data.json`) saqlayman (username'lar va reklamalar uchun). Bu hozircha yetarli bo'ladimi?

## Proposed Changes

### Orqa fon (Backend) va Bot - Node.js

Serverni Express va `node-telegram-bot-api` yordamida yozamiz.

#### [NEW] [package.json](file:///c:/Users/user/OneDrive/Desktop/abdunurcreator/package.json)
- Express, body-parser, va node-telegram-bot-api kutubxonalarini o'z ichiga oladi.

#### [NEW] [server.js](file:///c:/Users/user/OneDrive/Desktop/abdunurcreator/server.js)
- **Bot mantig'i:** `/start` bosilganda tasodifiy 6 xonali kod yaratadi va foydalanuvchiga yuboradi, hamda bu kodni username bilan eslab qoladi.
- **API `/api/verify`**: Saytdan username va kodni qabul qilib, tekshiradi. Agar to'g'ri bo'lsa, kirishga ruxsat beradi.
- **API `/api/ads`**: Admin panel orqali yuborilgan reklamalarni saqlaydi va barcha foydalanuvchilarga (`/start` bosganlarga) bot orqali tarqatadi (broadcast). Kompaniya nomi ko'k rangli havola (link) shaklida bo'ladi.

#### [NEW] [data.json](file:///c:/Users/user/OneDrive/Desktop/abdunurcreator/data.json)
- Foydalanuvchilar (username, chat_id, kod) va reklamalarni saqlash uchun kichik ma'lumotlar bazasi vazifasini bajaradi.

---

### Front-end (Foydalanuvchi interfeysi)

Fayllarni toza bo'lishi uchun `public` jildiga ajratamiz va hozirgi `a.html` ni kengaytiramiz.

#### [MODIFY] [a.html](file:///c:/Users/user/OneDrive/Desktop/abdunurcreator/a.html) -> `public/index.html` ga ko'chiriladi va yangilanadi
- **Login qismi:** Endi kodni o'zi yaratmaydi, faqat username va botdan kelgan kodni so'raydi. Orqa fonda `/api/verify` ga ulanadi.
- **Yangi Orqa Fon (Background):** Turli AI vositalarining rasmlari (chiroyli float / parallax effektda) sichqonchaga qarab harakatlanadi.
- **Admin Panel:**
  - Admin ismining yoniga "Verified Badge" (ko'k pichka) SVG formati o'rnatiladi.
  - "Reklama joylash" bo'limi qo'shiladi: Rasm URL, Ma'lumot, Kompaniya nomi va Link so'raladi.
- **Reklama ko'rish:** Yangi reklama qo'shilganda ekranda 📰 emojisi uchib yuradigan animatsiya bo'ladi. Uni bosganda chiroyli oynada barcha reklamalar ro'yxati chiqadi.
- **Yangi AI Bo'limlari:**
  - *Video yasaydigan AI'lar*: Higgsfield, Kling, Google Veo 3.
  - *Rasm/Matn yasaydigan AI'lar*: Nano, Banana Pro, ChatGPT, Copilot.
  - Har biri haqida qisqacha ma'lumot va *animatsiyali, ranglari qimirlab turadigan* havolali tugmalar bo'ladi.

#### [NEW] [public/style.css](file:///c:/Users/user/OneDrive/Desktop/abdunurcreator/public/style.css)
- Barcha stillar va yangi animatsiyalar (hover effektlar, flying emoji, parallax background) shu yerda yoziladi.

#### [NEW] [public/script.js](file:///c:/Users/user/OneDrive/Desktop/abdunurcreator/public/script.js)
- Saytning interaktiv qismlari, fetch orqali backendga so'rov yuborish, reklamalarni ekranga chiqarish mantig'i.

## Verification Plan

### Automated Tests
1. `npm install` va `node server.js` komandalarini yuritib server va botni ishga tushirish.
2. `/api/verify` va `/api/ads` endpointlari ishlab turganini tekshirish.

### Manual Verification
1. O'zim ixtiyoriy username orqali saytga kirishga urinib, bot ishlayotganini va kod berishini tekshiraman.
2. Admin panelga kirib (`0101` paroli bilan), verified badgeni ko'raman va bitta test reklama yarataman.
3. Yangiliklar emojisi (📰) saytda uchishini va uni bosganda reklamalar chiqishini tasdiqlayman.
4. Bot orqali barchaga kompaniya havolasi ko'k rangda yuborilganini tekshiraman.
5. Yangi Video va Rasm AI bo'limlari to'g'ri ishlashi va ulardagi tugmalar chiroyli animatsiyaga ega bo'lishini ko'zdan kechiraman.
