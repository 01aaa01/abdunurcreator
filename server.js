const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const token = '8913262769:AAHIqKxQKMl1ANSp-jh6FGkcgLY92W6YhwE';
const bot = new TelegramBot(token, { polling: true });

// Bot polling xatoliklari (masalan, server bir necha marta ishga tushirilib
// qolsa "409 Conflict" xatosi chiqadi) serverni yiqitib qo'ymasligi uchun ushlab qolamiz.
bot.on('polling_error', (err) => {
  console.error('⚠️  Telegram polling xatosi:', err.code || '', err.message);
});

// Kutilmagan xatoliklar butun serverni to'xtatib qo'ymasligi uchun (aks holda
// admin panel "Server xatoligi" ko'rsatib, sayt butunlay ishlamay qolishi mumkin edi).
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Kutilmagan xatolik (unhandledRejection):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️  Kutilmagan xatolik (uncaughtException):', err);
});

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));

// DB
let db = { users: {}, ads: [], pendingUsers: {}, config: { openRouterKey: '' } };
const dbPath = path.join(__dirname, 'data.json');

if (fs.existsSync(dbPath)) {
  try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
  catch (e) { console.error("DB parse xatosi", e); }
}
if (!db.pendingUsers) db.pendingUsers = {};
if (!db.config) db.config = { openRouterKey: '' };

function saveDB() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('⚠️  DB saqlashda xatolik:', e.message);
  }
}

// Bot: /start bosilganda username saqlanadi (lekin kod yuborilmaydi)
// Kod faqat admin yuboradi
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!username) {
    bot.sendMessage(chatId, '⚠️ Sizda Telegram username yo\'q! Telegram sozlamalaridan username o\'rnating.');
    return;
  }

  const key = username.toLowerCase();

  // Foydalanuvchi chat_id ni saqlaymiz
  if (!db.users[key]) {
    db.users[key] = { chatId, username };
  } else {
    db.users[key].chatId = chatId;
  }

  // pendingUsers ga qo'shamiz (admin ko'radi)
  db.pendingUsers[key] = {
    chatId,
    username,
    requestedAt: new Date().toISOString(),
    status: 'waiting' // waiting | approved | rejected
  };
  saveDB();

  bot.sendMessage(chatId, `👋 Xush kelibsiz, @${username}!\n\nSizning so'rovingiz qabul qilindi. Administrator sizga tez orada kirish kodini yuboradi. Kuting...`);
});

// API: Saytga kirish tekshiruvi
app.post('/api/verify', (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: 'Username va kod kiritilishi shart.' });

  const key = username.toLowerCase().replace('@', '');

  // Admin tekshiruvi
  if (key === 'abdunurcreator' && code === '0101') {
    return res.json({ success: true, isAdmin: true });
  }

  const user = db.users[key];
  if (!user) {
    return res.status(404).json({ error: 'Username topilmadi. Iltimos botga /start bosing.' });
  }

  if (!user.code) {
    return res.status(400).json({ error: 'Sizga hali kod yuborilmagan. Admin tasdiqlashini kuting.' });
  }

  if (user.code === String(code)) {
    user.code = null; // kodni o'chiramiz (bir marta ishlatiladi)
    saveDB();
    return res.json({ success: true, isAdmin: false });
  }

  return res.status(400).json({ error: 'Kod noto\'g\'ri. Qaytadan tekshiring.' });
});

// API: Admin - kutayotgan foydalanuvchilar ro'yxati
app.get('/api/admin/pending', (req, res) => {
  const { password } = req.query;
  if (password !== '0101') return res.status(403).json({ error: 'Ruxsat yo\'q.' });

  const list = Object.values(db.pendingUsers).sort((a, b) =>
    new Date(b.requestedAt) - new Date(a.requestedAt)
  );
  res.json({ users: list });
});

// API: Admin - foydalanuvchiga xabar yuborish
app.post('/api/admin/send-message', async (req, res) => {
  const { password, username, message, color, code } = req.body;

  if (password !== '0101') return res.status(403).json({ error: 'Ruxsat yo\'q.' });

  const key = username.toLowerCase().replace('@', '');
  const user = db.users[key] || db.pendingUsers[key];

  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });

  const chatId = user.chatId;
  if (!chatId) return res.status(404).json({ error: 'Chat ID topilmadi.' });

  // Agar kod yuborish kerak bo'lsa
  if (code) {
    db.users[key] = db.users[key] || { chatId, username };
    db.users[key].code = String(code);
    saveDB();
  }

  // Rang belgisi
  const prefix = color === 'green' ? '✅' : '❌';
  // Kod berilgan bo'lsa, uni xabar matniga avtomatik qo'shamiz — aks holda
  // foydalanuvchi kodni hech qachon ko'rmaydi va saytga kira olmaydi.
  const codeLine = code ? `\n\n🔑 Kirish kodingiz: <b>${code}</b>\nUshbu kodni saytdagi "Kod" maydoniga kiriting.` : '';
  const fullMessage = `${prefix} ${message}${codeLine}`;

  try {
    await bot.sendMessage(chatId, fullMessage, { parse_mode: 'HTML' });
    res.json({ success: true, message: `Xabar @${username} ga yuborildi.` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Xabar yuborishda xatolik: ' + e.message });
  }
});

// API: Admin - foydalanuvchini butunlay o'chirish
// (Bot ma'lumoti ham, kutish ro'yxatidagi yozuvi ham o'chadi.
//  Foydalanuvchi botga qayta /start bossa, yangi foydalanuvchi sifatida qayta paydo bo'ladi.)
app.post('/api/admin/delete-user', (req, res) => {
  const { password, username } = req.body;
  if (password !== '0101') return res.status(403).json({ error: 'Ruxsat yo\'q.' });
  if (!username) return res.status(400).json({ error: 'Username kiritilmagan.' });

  const key = username.toLowerCase().replace('@', '');
  if (key === 'abdunurcreator') return res.status(400).json({ error: 'Admin akkauntini o\'chirib bo\'lmaydi.' });

  let found = false;
  if (db.users[key]) { delete db.users[key]; found = true; }
  if (db.pendingUsers[key]) { delete db.pendingUsers[key]; found = true; }

  if (!found) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });

  saveDB();
  res.json({ success: true, message: `@${username} o'chirildi.` });
});

// API: Reklamalar
app.get('/api/ads', (req, res) => {
  res.json({ ads: db.ads || [] });
});

app.post('/api/ads', async (req, res) => {
  const { image, text, company, link, password } = req.body;
  if (password !== '0101') return res.status(403).json({ error: 'Ruxsat yo\'q.' });

  const newAd = { id: Date.now(), image, text, company, link };
  if (!db.ads) db.ads = [];
  db.ads.push(newAd);
  saveDB();

  let count = 0;
  for (const key in db.users) {
    const u = db.users[key];
    if (u.chatId) {
      try {
        await bot.sendPhoto(u.chatId, image, {
          caption: `📰 Yangi reklama!\n\n🏢 [${company}](${link})\n\n${text}`,
          parse_mode: 'Markdown'
        });
        count++;
      } catch (e) {
        console.error('Broadcast xatoligi:', key, e.message);
      }
    }
  }
  res.json({ success: true, broadcastCount: count });
});

// API: Get OpenRouter Key (Admin only)
app.get('/api/admin/config', (req, res) => {
  const { password } = req.query;
  if (password !== '0101') return res.status(403).json({ error: 'Ruxsat yo\'q.' });
  res.json({ config: db.config });
});

// API: Set OpenRouter Key (Admin only)
app.post('/api/admin/config', (req, res) => {
  const { password, openRouterKey } = req.body;
  if (password !== '0101') return res.status(403).json({ error: 'Ruxsat yo\'q.' });
  
  db.config.openRouterKey = openRouterKey || '';
  saveDB();
  res.json({ success: true, message: 'Sozlamalar saqlandi!' });
});

// Har bir chatga majburan qo'shiladigan yashirin tizim xabari.
// Bu AI'ga o'zining haqiqiy nomini (GPT, Qwen, Gemini va h.k.) hech qachon
// aytmaslikni va faqat "Noor AI" sifatida tanishtirishni buyuradi.
const NOOR_SYSTEM_PROMPT = {
  role: 'system',
  content: "Sening isming Noor AI. Seni AbdunurCreator ishlab chiqargan. Agar kimdir isming nima, seni kim yaratgan, qaysi kompaniya yoki qaysi model ekaningni so'rasa, faqat shunday javob ber: \"Men Noor AI man, meni AbdunurCreator ishlab chiqqan.\" Hech qachon GPT, OpenAI, Gemini, Google, Qwen, Alibaba, Llama, Meta, Claude, Anthropic yoki boshqa haqiqiy sun'iy intellekt modeli yoki kompaniyasi nomini aytma yoki ular ekaningni tan olma, hatto to'g'ridan-to'g'ri so'rashsa ham. Qolgan barcha savollarga odatdagidek, foydali va aniq javob ber."
};

// API: OpenRouter Chat Proxy
app.post('/api/chat', async (req, res) => {
  const { model, messages } = req.body;

  if (typeof fetch !== 'function') {
    return res.status(500).json({ error: 'Serverdagi Node.js versiyasi eski (18-dan past). AI chat ishlashi uchun Node.js 18 yoki undan yangi versiyasini o\'rnating: https://nodejs.org' });
  }

  if (!db.config.openRouterKey) {
    return res.status(400).json({ error: 'OpenRouter API kaliti o\'rnatilmagan. Admin panel orqali sozlang.' });
  }

  try {
    const outgoingMessages = [NOOR_SYSTEM_PROMPT, ...(messages || [])];
    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${db.config.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AbdunurCreator'
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-oss-20b:free',
          messages: outgoingMessages
        })
      });
    } catch (netErr) {
      console.error('OpenRouterga ulanishda xatolik:', netErr.message);
      return res.status(502).json({ error: 'OpenRouter serveriga ulanib bo\'lmadi. Internet aloqasini tekshiring: ' + netErr.message });
    }

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenRouter xatoligi (status ' + response.status + ')' });
    }
    res.json(data);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Server xatoligi: ' + error.message });
  }
});

const PORT = 3000;
const httpServer = app.listen(PORT, () => {
  console.log(`✅ Server ishga tushdi: http://localhost:${PORT}`);
  console.log(`✅ Telegram bot polling boshlandi`);
});

// Portni tinglashda xato chiqsa (masalan port band bo'lsa), buni ANIQ ko'rsatamiz
// va dasturni to'xtatamiz — aks holda server "ishlayotgandek" ko'rinib, aslida
// hech qanday so'rovga javob bermay qoladi (aynan shu holat "Server bilan
// aloqa yo'q" xatosini keltirib chiqaradi).
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ XATOLIK: ${PORT}-port band! Boshqa node.exe jarayoni allaqachon shu portda ishlamoqda.`);
    console.error(`   Yechim: Task Manager'da barcha node.exe jarayonlarini to'xtating, so'ng serverni qayta ishga tushiring.`);
  } else {
    console.error('❌ Serverni ishga tushirishda xatolik:', err.message);
  }
  process.exit(1);
});
