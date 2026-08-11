require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ XATOLIK: BOT_TOKEN environment o\'zgaruvchisi topilmadi! .env faylga yoki hosting sozlamalariga BOT_TOKEN qo\'shing.');
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

// AI kalitlari endi admin paneldan emas, .env orqali (git'ga tushmaydi)
const OPENROUTER_KEY = process.env.OPENROUTER_KEY || '';
const OPENCODE_KEY = process.env.OPENCODE_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const BYTEZ_KEY = process.env.BYTEZ_KEY || '';
const ADMIN_PASSWORD = '0101';
// Noor AI 2.5 / Noor AI 3.0 — OmniRoute gateway orqali (o'zingiz Render'ga qo'ygan instance).
const OMNIROUTE_KEY = process.env.OMNIROUTE_KEY || '';
const OMNIROUTE_URL = (process.env.OMNIROUTE_URL || '').replace(/\/+$/, '');
// (OMNIROUTE_MODEL_25 / OMNIROUTE_MODEL_30 endi ishlatilmaydi — OMNIROUTE_FREE_POOL
// pastda har bir Noor AI Pro versiyasi uchun alohida model belgilaydi.)
// Noor AI IMG — rasm yaratish (Cloudflare Worker orqali).
const IMAGE_API_URL = process.env.IMAGE_API_URL || 'https://image-api.trachitz.workers.dev';
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || '12345678';
const IMG_SIZE_HINTS = {
  square: 'square image, 1:1 aspect ratio',
  portrait: 'portrait image, 3:4 aspect ratio',
  landscape: 'landscape image, 16:9 aspect ratio, widescreen'
};
// Noor AI 2.5 — Gemini API orqali to'g'ridan-to'g'ri (haqiqiy, ishonchli vision).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash'; // .env ni e'tiborga olmasdan to'g'ridan-to'g'ri 1.5-flash'ni ishlatamiz
if (!OPENROUTER_KEY) console.warn('⚠️  OPENROUTER_KEY .env faylida yo\'q — Noor AI 1.5 ishlamaydi.');
if (!OPENCODE_KEY) console.warn('⚠️  OPENCODE_KEY .env faylida yo\'q — Coder rejimlari OpenRouter zaxirasiga o\'tadi.');
if (!GOOGLE_CLIENT_ID) console.warn('⚠️  GOOGLE_CLIENT_ID .env faylida yo\'q — Google orqali kirish/ro\'yxatdan o\'tish ishlamaydi.');
if (!BYTEZ_KEY) console.warn('⚠️  BYTEZ_KEY .env faylida yo\'q — Noor-Image / Noor-Video / Noor-Audio ishlamaydi.');
if (!OMNIROUTE_KEY) console.warn('⚠️  OMNIROUTE_KEY .env faylida yo\'q — Noor AI 3.0-6.0 ishlamaydi.');
if (!OMNIROUTE_URL || OMNIROUTE_URL.includes('SIZNING-OMNIROUTE')) console.warn('⚠️  OMNIROUTE_URL sozlanmagan — .env faylda uni Render\'ga qo\'ygan OmniRoute manzilingizga almashtiring, aks holda Noor AI 3.0-6.0 ishlamaydi.');
if (!GEMINI_API_KEY) console.warn('⚠️  GEMINI_API_KEY .env faylida yo\'q — Noor AI 2.5 ishlamaydi.');

// Noor-Image / Noor-Video / Noor-Audio — Bytez (bytez.com) orqali ishlaydi.
// MUHIM: Bytez'da 175k+ model bo'lsa ham, ularning hammasi hali "katalogga qo'shilmagan"
// (ya'ni to'g'ridan-to'g'ri ishlatib bo'lmaydi). Shuning uchun modelId'ni qo'lda taxmin qilish
// o'rniga — server sizning BYTEZ_KEY'ingiz bilan Bytez'ning HAQIQIY, hozir ishlaydigan
// modellar ro'yxatini so'raydi (GET /list/models?task=...) va shulardan avtomatik tanlaydi.
// Har bir vazifa (image/video/audio) uchun bir nechta "versiya" (1.0, 1.5, 2.0 ...) — kichikroq/
// tezroq modellar past raqamli, kattaroq/og'irroq modellar yuqori raqamli versiya bo'ladi.
const BYTEZ_TASKS = { image: 'text-to-image', video: 'text-to-video', audio: 'text-to-audio' };
const BYTEZ_LABELS = { image: 'Noor-Image', video: 'Noor-Video', audio: 'Noor-Audio' };
const VERSION_STEPS = ['1.0', '1.5', '2.0'];
const bytezCatalogCache = {}; // task -> { ts, tiers: [{version, candidates:[modelId,...]}] }
const BYTEZ_CATALOG_TTL = 30 * 60 * 1000; // 30 daqiqa keshlanadi

async function fetchBytezCatalog(task) {
  const resp = await fetch(`https://api.bytez.com/models/v2/list/models?task=${encodeURIComponent(task)}`, {
    headers: { 'Authorization': `Key ${BYTEZ_KEY}` }
  });
  let data;
  try { data = await resp.json(); } catch (e) { data = null; }
  if (!resp.ok || !data || data.error || !Array.isArray(data.output)) {
    throw new Error((data && data.error) || `Bytez katalogini olib bo'lmadi ("${task}", status ${resp.status})`);
  }
  return data.output;
}

// Modellarni bepul (meter'da "free" bor)larni oldinga qo'yib, hajmi (params) bo'yicha
// kichikdan kattaga saralaydi, so'ng 3 ta versiya bosqichiga bo'lib, har biriga zaxira
// (fallback) ro'yxati bilan birga qaytaradi.
async function getBytezTiers(task) {
  const cached = bytezCatalogCache[task];
  if (cached && (Date.now() - cached.ts) < BYTEZ_CATALOG_TTL) return cached.tiers;

  const raw = await fetchBytezCatalog(task);
  const sorted = raw
    .filter(m => m && m.modelId)
    .sort((a, b) => {
      const aFree = (a.meter && String(a.meter).includes('free')) ? 0 : 1;
      const bFree = (b.meter && String(b.meter).includes('free')) ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      return (a.params || 0) - (b.params || 0);
    })
    .map(m => m.modelId);

  if (!sorted.length) throw new Error(`Bytez katalogida "${task}" vazifasi uchun hozircha model yo'q.`);

  const tierCount = Math.min(VERSION_STEPS.length, sorted.length);
  const tiers = [];
  for (let i = 0; i < tierCount; i++) {
    const idx = Math.floor((i / tierCount) * sorted.length);
    const primary = sorted[idx];
    // Asosiy model ishlamasa, ro'yxatning qolgan qismi zaxira sifatida sinaladi.
    const candidates = [primary, ...sorted.filter(m => m !== primary)];
    tiers.push({ version: VERSION_STEPS[i], candidates });
  }
  bytezCatalogCache[task] = { ts: Date.now(), tiers };
  return tiers;
}

async function callBytez(bytezModelId, text) {
  const resp = await fetch(`https://api.bytez.com/models/v2/${bytezModelId}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${BYTEZ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  let data;
  try { data = await resp.json(); } catch (e) { data = { error: `Bytez javobini o'qib bo'lmadi (status ${resp.status})` }; }
  return { ok: resp.ok, data };
}

// Ro'yxatdagi modellarni ketma-ket sinab ko'radi, birinchi ishlagani natijani qaytaradi.
// Barchasi muvaffaqiyatsiz bo'lsa — oxirgi (haqiqiy) Bytez xato matnini qaytaradi, shunda
// muammoni loglardan (yoki javobdan) aniq ko'rish mumkin bo'ladi.
async function callBytezWithFallback(candidates, text) {
  let lastError = 'Bytez\'da mos model topilmadi.';
  for (const bytezId of candidates) {
    try {
      const { ok, data } = await callBytez(bytezId, text);
      if (ok && data && !data.error && data.output) {
        return { ok: true, output: data.output, usedModel: bytezId };
      }
      lastError = (data && data.error) ? String(data.error) : `"${bytezId}" hech qanday natija qaytarmadi.`;
      console.warn(`⚠️  Bytez model "${bytezId}" ishlamadi:`, lastError);
    } catch (e) {
      lastError = e.message || String(e);
      console.warn(`⚠️  Bytez model "${bytezId}" so'rovda xato:`, lastError);
    }
  }
  return { ok: false, error: lastError };
}

function toDataUrl(output, mime) {
  if (typeof output !== 'string') return output;
  if (output.startsWith('data:') || output.startsWith('http')) return output;
  return `data:${mime};base64,${output}`;
}

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
app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

app.get('/api/generate/models', async (req, res) => {
  if (!BYTEZ_KEY) return res.json({ image: [], video: [], audio: [] });
  const out = {};
  for (const kind of Object.keys(BYTEZ_TASKS)) {
    try {
      const tiers = await getBytezTiers(BYTEZ_TASKS[kind]);
      out[kind] = tiers.map(t => ({ id: `noor-${kind}-${t.version}`, label: `${BYTEZ_LABELS[kind]} ${t.version}` }));
    } catch (e) {
      console.warn(`⚠️  ${kind} katalogini olishda xato:`, e.message || e);
      out[kind] = [];
    }
  }
  res.json(out);
});

// Bytez ishlamayotgani uchun, rasm va video yaratish yangilandi:
app.post('/api/generate/image', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'Prompt kiriting.' });
  try {
    const encodedPrompt = encodeURIComponent(String(prompt).trim());
    // 1-bepul AI: Pollinations AI (API kalit talab qilmaydi)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
    res.json({ image: imageUrl, model: 'pollinations-ai' });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi: ' + (e.message || e) });
  }
});

app.post('/api/generate/video', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'Prompt kiriting.' });
  try {
    // 2 ta bepul video AI topish so'ralgan edi. Video uchun ochiq API lar barqaror bo'lmagani 
    // sababli foydalanuvchiga eng zo'r 2 ta GitHub AI yechimlarini tavsiya qilamiz:
    const msg = `Hozirda ochiq bepul text-to-video API'lar cheklangan. Biroq, sizning saytingiz mukammal ishlashi uchun GitHub'dagi eng kuchli 2 ta bepul ochiq kodli Video AI manbalarini topdik:\n\n1. **Agnes Video Generator** (lcy362/agnes-video-generator)\n2. **ViMax** (HKUDS/ViMax)\n\nIltimos, ushbu manbalarni serveringizga ulash orqali to'liq videoni ishga tushiring. Hozircha siz Image AI dan muvaffaqiyatli bepul foydalanishingiz mumkin!`;
    res.status(502).json({ error: msg });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi: ' + (e.message || e) });
  }
});

app.post('/api/generate/audio', (req, res) => res.status(502).json({ error: "Ovoz modeli yangilanmoqda..." }));

// === Noor AI IMG — rasm yaratish (Cloudflare Worker orqali), pastiga shaffof "Noor AI"
// suvbelgisi (watermark) qo'yiladi, natija saqlanadi va ulashish uchun link beriladi. ===
function escapeHtmlServer(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function watermarkImage(buffer) {
  const sharp = require('sharp');
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const w = meta.width || 1024, h = meta.height || 1024;
  const fontSize = Math.max(16, Math.round(w * 0.032));
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${w / 2}" y="${h - fontSize}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" fill-opacity="0.5" text-anchor="middle" letter-spacing="1">Noor AI</text>
  </svg>`;
  return img.composite([{ input: Buffer.from(svg), gravity: 'south' }]).jpeg({ quality: 92 }).toBuffer();
}

app.post('/api/chat/generate-image', async (req, res) => {
  const { prompt, size } = req.body || {};
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) return res.status(400).json({ error: "Nima rasm yaratish kerakligini yozing." });

  const sizeHint = IMG_SIZE_HINTS[size] || '';
  const finalPrompt = sizeHint ? `${cleanPrompt}, ${sizeHint}` : cleanPrompt;

  // DIQQAT: bu buyruq FAQAT server konsolida (Render loglarida) ko'rinadi — saytda,
  // foydalanuvchiga hech qachon ko'rsatilmaydi.
  console.log(`[Noor AI IMG] curl -X POST ${IMAGE_API_URL} -H "Authorization: Bearer ${IMAGE_API_KEY}" -H "Content-Type: application/json" -d "{\\"prompt\\": \\"${finalPrompt.replace(/"/g, '\\"')}\\"}" --output image.jpg`);

  try {
    const resp = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${IMAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: finalPrompt })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('⚠️  Noor AI IMG xizmati xatosi:', resp.status, errText);
      return res.status(502).json({ error: "Rasm yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring." });
    }
    const arrBuf = await resp.arrayBuffer();
    let outBuf = Buffer.from(arrBuf);
    try {
      outBuf = await watermarkImage(outBuf);
    } catch (e) {
      console.warn("⚠️  Watermark qo'yishda xato (rasm watermarksiz saqlanadi):", e.message || e);
    }
    const id = crypto.randomBytes(8).toString('hex');
    const filename = `${id}.jpg`;
    fs.writeFileSync(path.join(GENERATED_DIR, filename), outBuf);
    db.generatedImages[id] = { prompt: cleanPrompt, size: size || '', filename, createdAt: new Date().toISOString() };
    saveDB();
    res.json({ id, imageUrl: `/generated/${filename}`, shareUrl: `/share/${id}` });
  } catch (e) {
    console.error('⚠️  Noor AI IMG so\'rov xatosi:', e.message || e);
    res.status(502).json({ error: "Rasm yaratish xizmatiga ulanib bo'lmadi." });
  }
});

// Ulashish sahifasi — link bosilganda shu yerda ko'rinadi (saytning o'zida, tashqarida emas)
app.get('/share/:id', (req, res) => {
  const rec = db.generatedImages[req.params.id];
  if (!rec) return res.status(404).send('<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><title>Topilmadi</title></head><body style="background:#0a0b10;color:#f2f2f7;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">Bu rasm topilmadi yoki o\'chirilgan.</body></html>');
  const imgUrl = `/generated/${rec.filename}`;
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Noor AI — Yaratilgan rasm</title>
<link rel="icon" type="image/png" href="/cat.png">
<meta property="og:title" content="Noor AI orqali yaratilgan rasm">
<meta property="og:image" content="${imgUrl}">
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:#0a0b10;color:#f2f2f7;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;padding:40px 16px;min-height:100vh;}
  h1{font-size:.95rem;font-weight:700;color:#00d4ff;margin:0 0 22px;letter-spacing:.3px;}
  img{max-width:100%;max-height:74vh;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);}
  p{color:#9a9ab0;font-size:.85rem;max-width:520px;text-align:center;margin-top:18px;line-height:1.5;}
  .row{display:flex;gap:10px;margin-top:20px;}
  a.btn{background:#00d4ff;color:#04141a;text-decoration:none;font-weight:700;padding:11px 24px;border-radius:100px;font-size:.85rem;}
  a.btn.ghost{background:transparent;color:#f2f2f7;border:1px solid rgba(255,255,255,.18);}
</style>
</head>
<body>
  <h1>✦ NOOR AI</h1>
  <img src="${imgUrl}" alt="Noor AI rasm">
  ${rec.prompt ? `<p>${escapeHtmlServer(rec.prompt)}</p>` : ''}
  <div class="row">
    <a class="btn" href="${imgUrl}" download>Yuklab olish</a>
    <a class="btn ghost" href="/a.html">Noor AI'ni sinab ko'ring</a>
  </div>
</body>
</html>`);
});

// "/" manziliga kirganda avtomatik a.html'ga yo'naltirish
// (chunki bosh sahifa fayli index.html emas, a.html deb nomlangan)
app.get('/', (req, res) => {
  res.redirect('/a.html');
});

// DB
let db = { users: {}, ads: [], pendingUsers: {} };
// Agar Render'da "Disk" ulangan bo'lsa, DATA_DIR shu diskning mount path'iga
// ko'rsatilsin (masalan /var/data) — shunda data.json har deploy'da o'chib qolmaydi.
// Hech narsa sozlanmasa, oldingidek loyihaning o'z papkasiga yoziladi (lokal ishlash uchun yetarli).
const DATA_DIR = process.env.DATA_DIR || __dirname;
const dbPath = path.join(DATA_DIR, 'data.json');

if (fs.existsSync(dbPath)) {
  try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
  catch (e) { console.error("DB parse xatosi", e); }
}
if (!db.pendingUsers) db.pendingUsers = {};
if (!db.generatedImages) db.generatedImages = {};

function saveDB() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('⚠️  DB saqlashda xatolik:', e.message);
  }
}

// === Noor AI IMG — yaratilgan rasmlar shu papkaga saqlanadi va /generated/... orqali ochiladi ===
const GENERATED_DIR = path.join(DATA_DIR, 'generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
app.use('/generated', express.static(GENERATED_DIR));

// === PAROL YORDAMCHILARI (Node'ning o'zidagi crypto — qo'shimcha paket kerak emas) ===
function hashPassword(plain, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(plain, salt, hash) {
  const check = crypto.scryptSync(plain, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}
function generateReadablePassword() {
  // Foydalanuvchiga botda yuboriladigan, o'qishga qulay 8 xonali parol
  return Math.random().toString(36).slice(-4).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
}
function findUserByIdentifier(identifier) {
  const id = (identifier || '').trim().toLowerCase().replace('@', '');
  if (!id) return null;
  for (const key in db.users) {
    const u = db.users[key];
    if (key === id || (u.email && u.email.toLowerCase() === id)) return { key, user: u };
  }
  return null;
}

// Bot: /start bosilganda username saqlanadi, keyin email so'raladi (ixtiyoriy)
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!username) {
    bot.sendMessage(chatId, '⚠️ Sizda Telegram username yo\'q! Telegram sozlamalaridan username o\'rnating.');
    return;
  }

  const key = username.toLowerCase();

  if (!db.users[key]) {
    db.users[key] = { chatId, username };
  } else {
    db.users[key].chatId = chatId;
  }
  db.users[key].awaitingEmail = true;

  db.pendingUsers[key] = {
    chatId,
    username,
    requestedAt: new Date().toISOString(),
    status: 'waiting'
  };
  saveDB();

  bot.sendMessage(chatId,
    `👋 Xush kelibsiz, @${username}!\n\nSizning so'rovingiz qabul qilindi. Administrator sizga tez orada kirish kodini yuboradi.\n\nAgar xohlasangiz, saytga tezroq (username+parol bilan) kirish uchun email manzilingizni yuboring:`,
    { reply_markup: { inline_keyboard: [[{ text: '📪 Emailim yo\'q', callback_data: 'no_email' }]] } }
  );
});

// Diqqat: bot o'zi kod/parol yaratib bermaydi — faqat ma'lumotni saqlaydi va
// foydalanuvchiga adminning kod yuborishini kutishini aytadi. Kodni faqat admin
// panel orqali admin o'zi yuboradi (pastdagi /api/admin/send-message ga qarang).
function confirmAwaitingAdmin(chatId, key, email) {
  db.users[key].email = email || db.users[key].email || null;
  db.users[key].awaitingEmail = false;
  saveDB();
  bot.sendMessage(chatId,
    `✅ Qabul qilindi!\n\nAdministrator tez orada sizga saytga kirish kodini shu yerga yuboradi. Iltimos, kuting.`,
    { parse_mode: 'HTML' }
  );
}

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const username = query.from.username;
  if (!username) return bot.answerCallbackQuery(query.id);
  const key = username.toLowerCase();
  if (query.data === 'no_email' && db.users[key] && db.users[key].awaitingEmail) {
    confirmAwaitingAdmin(chatId, key, null);
  }
  bot.answerCallbackQuery(query.id);
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const username = msg.from.username;
  if (!username) return;
  const key = username.toLowerCase();
  const user = db.users[key];
  if (user && user.awaitingEmail) {
    const email = msg.text.trim();
    if (!EMAIL_RE.test(email)) {
      bot.sendMessage(msg.chat.id, '⚠️ Bu email manziliga o\'xshamayapti. Qaytadan yuboring, yoki "Emailim yo\'q" tugmasini bosing.');
      return;
    }
    confirmAwaitingAdmin(msg.chat.id, key, email);
  }
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

// API: Frontend Google Identity Services'ni ishga tushirish uchun Client ID kerak (maxfiy emas)
app.get('/api/google-client-id', (req, res) => {
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

// API: Username/parol orqali kirish
app.post('/api/password-login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Username/email va parolni kiriting.' });

  if (identifier.toLowerCase().replace('@', '') === 'abdunurcreator' && password === '0101') {
    return res.json({ success: true, isAdmin: true, username: 'abdunurcreator' });
  }

  const found = findUserByIdentifier(identifier);
  if (!found || !found.user.passwordHash) {
    return res.status(404).json({ error: 'Bu foydalanuvchi uchun parol o\'rnatilmagan. Avval Telegram bot orqali kiring.' });
  }
  if (!verifyPassword(password, found.user.passwordSalt, found.user.passwordHash)) {
    return res.status(400).json({ error: 'Parol noto\'g\'ri.' });
  }
  res.json({ success: true, isAdmin: false, username: found.user.username });
});

// API: Google orqali kirish/ro'yxatdan o'tish (Google Identity Services token'ini tekshiradi)
app.post('/api/google-login', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google token topilmadi.' });
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google kirish serverda sozlanmagan (GOOGLE_CLIENT_ID yo\'q).' });

  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const info = await r.json();
    if (!r.ok || info.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Google token tasdiqlanmadi.' });
    }
    const email = info.email;
    const key = email.toLowerCase();
    if (!db.users[key]) {
      db.users[key] = { username: key, email, name: info.name || '', photo: info.picture || '', chatId: null };
    } else {
      db.users[key].email = email;
      if (!db.users[key].name) db.users[key].name = info.name || '';
      if (!db.users[key].photo) db.users[key].photo = info.picture || '';
    }
    saveDB();
    res.json({ success: true, isAdmin: false, username: db.users[key].username });
  } catch (e) {
    res.status(500).json({ error: 'Google token tekshirishda xatolik: ' + e.message });
  }
});

// API: Profil — ism va rasmni yangilash (username o'zgarmaydi)
app.post('/api/profile', (req, res) => {
  const { username, name, photo } = req.body;
  if (!username) return res.status(400).json({ error: 'Username kerak.' });
  const key = username.toLowerCase().replace('@', '');
  // MUHIM: agar server bazasi qayta ishga tushirilganda tozalangan bo'lsa (masalan,
  // Render'da doimiy disk ulanmagan bo'lsa), foydalanuvchi baribir saytda "kirgan"
  // holatda turadi (brauzerda sessiya saqlangan) — shu holatda xato berish o'rniga
  // yozuvni qaytadan yaratamiz, aks holda profil hech qachon saqlanmaydi.
  if (!db.users[key]) db.users[key] = { username: key, chatId: null, code: null };
  if (typeof name === 'string') db.users[key].name = name.slice(0, 60);
  if (typeof photo === 'string') db.users[key].photo = photo.slice(0, 2_000_000);
  saveDB();
  res.json({ success: true, name: db.users[key].name || '', photo: db.users[key].photo || '' });
});

app.get('/api/profile', (req, res) => {
  const { username } = req.query;
  const key = (username || '').toLowerCase().replace('@', '');
  const u = db.users[key];
  if (!u) return res.json({ name: '', photo: '', email: '' }); // yozuv hali yo'q — bo'sh profil, xato emas
  res.json({ name: u.name || '', photo: u.photo || '', email: u.email || '' });
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

// (Eslatma: OpenRouter/OpenCode kalitlari endi admin panel orqali emas,
// .env fayl orqali sozlanadi — har safar qayta kiritish shart emas.)

// Har bir chatga majburan qo'shiladigan yashirin tizim xabari.
// Bu AI'ga o'zining haqiqiy nomini (GPT, Qwen, Gemini va h.k.) hech qachon
// aytmaslikni va faqat "Noor AI" sifatida tanishtirishni buyuradi.
const NOOR_SYSTEM_PROMPT = {
  role: 'system',
  content: "Sening isming Noor AI. Seni AbdunurCreator ishlab chiqargan. Agar kimdir isming nima, seni kim yaratgan, qaysi kompaniya yoki qaysi model ekaningni so'rasa, faqat shunday javob ber: \"Men Noor AI man, meni AbdunurCreator ishlab chiqqan.\" Hech qachon GPT, OpenAI, Gemini, Google, Qwen, Alibaba, Llama, Meta, Claude, Anthropic, DeepSeek, MiniMax, Kimi, OpenCode yoki boshqa haqiqiy sun'iy intellekt modeli yoki kompaniyasi nomini aytma yoki ular ekaningni tan olma, hatto to'g'ridan-to'g'ri so'rashsa ham. Kod yozib berishing kerak bo'lsa, HAR DOIM uni to'g'ri tildagi markdown kod bloki (masalan ```python, ```javascript, ```html, ```css) ichida ber — chunki interfeys HTML/CSS/JS va Python kodlarini foydalanuvchi uchun to'g'ridan-to'g'ri ishga tushirib, natijasini ko'rsatadi. Qolgan barcha savollarga odatdagidek, foydali va aniq javob ber."
};

const NOOR_CODER_SYSTEM_PROMPT = {
  role: 'system',
  content: "Sening isming Noor AI 1.0 (Coder). Seni AbdunurCreator ishlab chiqargan. Sen faqat va faqat kod yozish, kodni tushuntirish, xatolarni topish (debug) va dasturlash bo'yicha savollarga ixtisoslashgansan. Agar kimdir isming nima, seni kim yaratgan, qaysi kompaniya yoki qaysi model ekaningni so'rasa, faqat shunday javob ber: \"Men Noor AI 1.0 (Coder) man, meni AbdunurCreator ishlab chiqqan.\" Hech qachon haqiqiy AI modeli yoki kompaniya nomini aytma (GPT, OpenAI, Claude, Anthropic, Gemini, Google, Qwen, DeepSeek, MiniMax, Kimi, OpenCode va h.k.), hatto to'g'ridan-to'g'ri so'rashsa ham. Kodni HAR DOIM to'g'ri tildagi toza, izohli (chiroyli formatlangan) markdown kod bloki ichida ber (masalan ```python, ```javascript, ```html, ```css) — interfeys bu kodlarni to'g'ridan-to'g'ri ishga tushirib, natijasini ko'rsatadi. Kod bilan birga qisqacha, aniq tushuntirish ham qo'sh."
};

const NOOR_CODER2_SYSTEM_PROMPT = {
  role: 'system',
  content: "Sening isming Noor AI 2.0 (Coder). Seni AbdunurCreator ishlab chiqargan. Sen kod yozish, kodni tushuntirish, xatolarni topish (debug) bo'yicha ixtisoslashgansan, VA rasm/skrinshotlarni ham to'liq tushuna olasan (masalan xato skrinshoti, dizayn maketi, diagramma). Agar kimdir isming nima, seni kim yaratgan, qaysi kompaniya yoki qaysi model ekaningni so'rasa, faqat shunday javob ber: \"Men Noor AI 2.0 (Coder) man, meni AbdunurCreator ishlab chiqqan.\" Hech qachon haqiqiy AI modeli yoki kompaniya nomini aytma (GPT, OpenAI, Claude, Anthropic, Gemini, Google, Qwen, DeepSeek, MiniMax, Kimi, OpenCode va h.k.), hatto to'g'ridan-to'g'ri so'rashsa ham. Kodni HAR DOIM to'g'ri tildagi toza, izohli markdown kod bloki ichida ber (masalan ```python, ```javascript, ```html, ```css). Kod bilan birga qisqacha, aniq tushuntirish ham qo'sh."
};

function proSystemPrompt(versionLabel) {
  return {
    role: 'system',
    content: `Sening isming Noor AI ${versionLabel}. Seni AbdunurCreator ishlab chiqargan. Sen suhbat, kodlash VA rasm/skrinshotlarni tushunish (vision) bo'yicha kuchli, aniq va tezkor javob beruvchi Pro modelsan. Agar kimdir isming nima, seni kim yaratgan, qaysi kompaniya yoki qaysi model ekaningni so'rasa, faqat shunday javob ber: "Men Noor AI ${versionLabel} man, meni AbdunurCreator ishlab chiqqan." Hech qachon GPT, OpenAI, Gemini, Google, Qwen, Alibaba, Llama, Meta, Claude, Anthropic, DeepSeek, MiniMax, Kimi, OpenCode, OmniRoute yoki boshqa haqiqiy sun'iy intellekt modeli yoki kompaniyasi nomini aytma yoki ular ekaningni tan olma, hatto to'g'ridan-to'g'ri so'rashsa ham. Kod yozib berishing kerak bo'lsa, HAR DOIM uni to'g'ri tildagi markdown kod bloki ichida ber (masalan \`\`\`python, \`\`\`javascript, \`\`\`html, \`\`\`css). Rasm yuborishsa, uni diqqat bilan tahlil qilib, aniq va foydali javob ber.`
  };
}

// OmniRoute'dagi bepul modellar — kuchsizdan kuchligacha tartiblangan. Har biri o'z
// Noor AI versiyasiga bog'lanadi (3.0, 3.5, 4.0 ... nechta model bo'lsa, shuncha versiya).
// MUHIM: bu model nomlari faqat OmniRoute panelingizda ULANGAN provayderlar (masalan
// GitHub Models "gh/", Gemini CLI "gc/", Codex "cx/") uchun ishlaydi. Agar OmniRoute'da
// hech qanday provayder ulanmagan bo'lsa, ro'yxat qanday bo'lishidan qat'i nazar HECH BIRI
// ishlamaydi — avval OmniRoute panelida kamida bitta provayder ulanganini tekshiring.
const OMNIROUTE_FREE_POOL = [
  'gc/gemini-1.5-flash',
  'gh/gpt-4o-mini',
  'gh/Meta-Llama-3.1-70B-Instruct',
  'gh/Cohere-command-r',
  'gh/Phi-3-mini-4k-instruct',
  'gh/Mistral-nemo',
  'gh/AI21-Jamba-1.5-Mini'
];

// PRO_TIERS — Noor AI 2.5 dan boshlab har bir Pro versiyaning "dvigateli"ni belgilaydi.
// 2.5 — Gemini API orqali to'g'ridan-to'g'ri. 3.0 dan yuqorisi — OmniRoute pool'idagi
// modellar, har biriga alohida versiya (+0.5 qadam bilan), pool qayerda tugasa shu yerda to'xtaydi.
const PRO_TIERS = [{ version: '2.5', mode: 'noor25', engine: 'gemini' }];
OMNIROUTE_FREE_POOL.forEach((modelId, i) => {
  const version = (3 + i * 0.5).toFixed(1);
  PRO_TIERS.push({ version, mode: 'noor' + version.replace('.', ''), engine: 'omniroute', model: modelId });
});
const PRO_TIER_BY_MODE = {};
PRO_TIERS.forEach((t) => { PRO_TIER_BY_MODE[t.mode] = t; });

// Rasm (vision) qo'llab-quvvatlaydigan rejimlar — FAQAT Noor AI 2.5 dan yuqori Pro
// versiyalar. Eski uchtasi (1.0 Coder / 1.5 / 2.0 Coder) bepul, matn-only modellardan
// foydalanadi, shuning uchun rasm yuborilsa muloyimlik bilan rad etiladi.
const VISION_CAPABLE_MODES = PRO_TIERS.map((t) => t.mode);

// Noor AI 1.5 (umumiy) — OpenRouter'ning bepul router'i + zaxira modellar
const NOOR_MODEL_CHAIN = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'google/gemma-2-9b-it:free'
];

// Noor AI 1.0 (Coder) — OpenCode Zen'ning kodlash uchun ixtisoslashgan bepul modellari (vision yo'q)
const OPENCODE_MODEL_CHAIN = [
  'big-pickle',
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'hy3-free',
  'nemotron-3-ultra-free',
  'north-mini-code-free'
];
// OpenCode kaliti yo'q yoki barchasi ishlamasa, OpenRouter'dagi kodlash modellariga o'tamiz
const CODER_OPENROUTER_FALLBACK = ['qwen/qwen-2.5-coder-32b-instruct:free', 'openrouter/free'];

// Noor AI 2.0 (Coder) — kod + rasm/skrinshotni tushunadigan (vision) zanjir
const CODER2_MODEL_CHAIN = ['openrouter/free', 'qwen/qwen-2.5-coder-32b-instruct:free'];

function messagesContainImage(messages) {
  return (messages || []).some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
}

async function callOpenRouter(model, messages, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AbdunurCreator'
    },
    body: JSON.stringify({ model, messages })
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function callOpenCodeZen(model, messages, apiKey) {
  const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages })
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function callOmniRoute(model, messages, apiKey) {
  const response = await fetch(`${OMNIROUTE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages })
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function callGemini(model, messages, apiKey) {
  const systemMsg = messages.find(m => m.role === 'system');
  const convo = messages.filter(m => m.role !== 'system');
  const contents = convo.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map(c => {
          if (c.type === 'text') return { text: c.text };
          if (c.type === 'image_url') {
            const url = (c.image_url && c.image_url.url) || '';
            const match = /^data:(.+?);base64,(.+)$/.exec(url);
            if (match) return { inline_data: { mime_type: match[1], data: match[2] } };
          }
          return { text: '' };
        })
      : [{ text: String(m.content || '') }]
  }));
  const body = { contents };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) return { ok: false, status: response.status, data };
  // Gemini javobini frontend kutayotgan OpenAI-uslubidagi shaklga o'giramiz.
  const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || [])
    .map(p => p.text || '').join('');
  return { ok: true, status: 200, data: fakeChatResponse(text || "Kechirasiz, javob shakllantirib bo'lmadi.") };
}

function fakeChatResponse(text) {
  return { choices: [{ message: { role: 'assistant', content: text } }] };
}

// Ichki chat UI VA tashqi ommaviy API (/api/v1/chat/completions) ikkalasi ham shu
// funksiyani ishlatadi — bitta joyda mantiq, ikki joyda ishlatiladi.
async function runNoorChat(mode, messages, isAdminCaller) {
  const tier = PRO_TIER_BY_MODE[mode];

  // Noor AI 2.5+ — hozircha faqat admin uchun ishlaydi. Oddiy foydalanuvchilarga
  // haqiqiy AI chaqirilmaydi, buning o'rniga "Pro sotib oling" degan chiroyli javob qaytariladi.
  if (tier && !isAdminCaller) {
    return { status: 200, data: fakeChatResponse(`Noor AI ${tier.version} — bu Noor AI Pro imkoniyati. Undan foydalanish uchun Noor AI ning Pro versiyasini sotib olishingiz kerak. Hozircha Noor AI 1.0, 1.5 yoki 2.0 (Coder) bepul va ochiq.`) };
  }

  // Eski uchta bepul rejim (1.0 Coder / 1.5 / 2.0 Coder) haqiqiy vision modellarga ega emas —
  // shuning uchun rasm yuborilsa, foydalanuvchini haqiqiy vision qo'llab-quvvatlaydigan
  // Noor AI Pro rejimlariga yo'naltiramiz (server tomonida ham himoya — front-end'da ham
  // bu uchta rejimda rasm biriktirish tugmasi o'chirilgan).
  if (!tier && messagesContainImage(messages)) {
    const modeLabel = mode === 'coder' ? 'Noor AI 1.0 (Coder)' : (mode === 'coder2' ? 'Noor AI 2.0 (Coder)' : 'Noor AI 1.5');
    return { status: 200, data: fakeChatResponse(`Kechirasiz, men (${modeLabel}) rasm o'qiy olmayman. Rasmni tushuntirib berishimni xohlasangiz, iltimos **Noor AI 2.5** yoki undan yuqori Pro rejimni sinab ko'ring.`) };
  }

  const systemPrompt = tier ? proSystemPrompt(tier.version)
    : mode === 'coder2' ? NOOR_CODER2_SYSTEM_PROMPT
    : mode === 'coder' ? NOOR_CODER_SYSTEM_PROMPT
    : NOOR_SYSTEM_PROMPT;
  const outgoingMessages = [systemPrompt, ...(messages || [])];
  let lastError = null;

  if (tier) {
    const modeLabel = `Noor AI ${tier.version}`;

    if (tier.engine === 'gemini') {
      if (!GEMINI_API_KEY) {
        return { status: 500, data: { error: `Serverda GEMINI_API_KEY sozlanmagan — ${modeLabel} ishlashi uchun .env faylga kiriting.` } };
      }
      try {
        const { ok, data } = await callGemini(GEMINI_MODEL, outgoingMessages, GEMINI_API_KEY);
        if (ok) return { status: 200, data };
        lastError = (data.error && data.error.message) || JSON.stringify(data.error || data);
        console.error(`⚠️  ${modeLabel}: Gemini javob bermadi:`, lastError);
      } catch (e) {
        lastError = e.message;
        console.error(`⚠️  ${modeLabel}: Gemini'ga ulanish xatosi:`, lastError);
      }
      return { status: 502, data: { error: `${modeLabel} hozircha javob bera olmadi: ${lastError || "noma'lum xatolik"}` } };
    }

    if (tier.engine === 'omniroute') {
      if (!OMNIROUTE_KEY || !OMNIROUTE_URL || OMNIROUTE_URL.includes('SIZNING-OMNIROUTE')) {
        return { status: 500, data: { error: `Serverda OMNIROUTE_KEY yoki OMNIROUTE_URL sozlanmagan — ${modeLabel} ishlashi uchun .env faylga to'g'ri qiymatlarni kiriting.` } };
      }
      
      const idx = OMNIROUTE_FREE_POOL.indexOf(tier.model);
      const chain = [...new Set([tier.model, OMNIROUTE_FREE_POOL[idx + 1], 'auto/best', 'auto/best-free'].filter(Boolean))];
      for (const model of chain) {
        try {
          const { ok, data } = await callOmniRoute(model, outgoingMessages, OMNIROUTE_KEY);
          if (ok) return { status: 200, data };
          lastError = data.error?.message || data.error;
          console.error(`⚠️  ${modeLabel}: "${model}" (OmniRoute) javob bermadi:`, lastError);
        } catch (e) {
          lastError = e.message;
          console.error(`⚠️  ${modeLabel}: "${model}" ulanish xatosi:`, lastError);
        }
      }
      return { status: 502, data: { error: `${modeLabel} hozircha javob bera olmadi (barcha modellar sinaldi: ${lastError || "noma'lum xatolik"}). Eng ehtimoliy sabab: OmniRoute panelida "${tier.model}" provayderi ulanmagan. OmniRoute dashboard'ni tekshiring.` } };
    }
  }

  if (mode === 'coder2') {
    if (OPENROUTER_KEY) {
      for (const model of CODER2_MODEL_CHAIN) {
        try {
          const { ok, data } = await callOpenRouter(model, outgoingMessages, OPENROUTER_KEY);
          if (ok) return { status: 200, data };
          lastError = data.error?.message;
        } catch (e) { lastError = e.message; }
      }
    }
    return { status: 502, data: { error: 'Noor AI 2.0 (Coder) hozircha band. Birozdan so\'ng qayta urinib ko\'ring: ' + (lastError || 'noma\'lum xatolik') } };
  }

  if (mode === 'coder') {
    if (OPENCODE_KEY) {
      for (const model of OPENCODE_MODEL_CHAIN) {
        try {
          const { ok, data } = await callOpenCodeZen(model, outgoingMessages, OPENCODE_KEY);
          if (ok) return { status: 200, data };
          lastError = data.error?.message;
          console.error(`⚠️  Noor Coder: "${model}" (OpenCode Zen) javob bermadi:`, lastError);
        } catch (e) {
          lastError = e.message;
          console.error(`⚠️  Noor Coder: "${model}" ulanish xatosi:`, lastError);
        }
      }
    }
    if (OPENROUTER_KEY) {
      for (const model of CODER_OPENROUTER_FALLBACK) {
        try {
          const { ok, data } = await callOpenRouter(model, outgoingMessages, OPENROUTER_KEY);
          if (ok) return { status: 200, data };
          lastError = data.error?.message;
        } catch (e) { lastError = e.message; }
      }
    }
    return { status: 502, data: { error: 'Noor Coder hozircha band (barcha bepul modellar javob bermadi): ' + (lastError || 'noma\'lum xatolik') } };
  }

  // === UMUMIY REJIM (Noor AI 1.5) ===
  if (!OPENROUTER_KEY) {
    return { status: 500, data: { error: 'Serverda OPENROUTER_KEY sozlanmagan.' } };
  }
  for (const model of NOOR_MODEL_CHAIN) {
    try {
      const { ok, data } = await callOpenRouter(model, outgoingMessages, OPENROUTER_KEY);
      if (ok) return { status: 200, data };
      lastError = data.error?.message;
      console.error(`⚠️  Noor AI: "${model}" javob bermadi, keyingisiga o'tilmoqda:`, lastError);
    } catch (e) {
      lastError = e.message;
      console.error(`⚠️  Noor AI: "${model}" ulanish xatosi, keyingisiga o'tilmoqda:`, lastError);
    }
  }
  return { status: 502, data: { error: 'Noor AI hozircha band (barcha bepul modellar javob bermadi): ' + (lastError || 'noma\'lum xatolik') } };
}

// API: OpenRouter/OpenCode Chat Proxy (Noor AI 1.5 / 1.0 Coder / 2.0 Coder) — saytning o'z chati
app.post('/api/chat', async (req, res) => {
  const { messages, mode, password } = req.body;
  if (typeof fetch !== 'function') {
    return res.status(500).json({ error: 'Serverdagi Node.js versiyasi eski (18-dan past). AI chat ishlashi uchun Node.js 18 yoki undan yangi versiyasini o\'rnating: https://nodejs.org' });
  }
  const isAdminCaller = password === ADMIN_PASSWORD;
  const result = await runNoorChat(mode, messages, isAdminCaller);
  res.status(result.status).json(result.data);
});

// === OMMAVIY API — dasturchilar o'z shaxsiy API kaliti bilan Noor AI'ga bepul murojaat qilishi uchun ===
function genApiKey() {
  return 'noor_' + crypto.randomBytes(24).toString('hex');
}

app.post('/api/keys/create', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username kerak.' });
  const key = String(username).toLowerCase();
  if (!db.users[key]) db.users[key] = { username: key, chatId: null, code: null };
  if (!db.users[key].apiKey) {
    db.users[key].apiKey = genApiKey();
    saveDB();
  }
  res.json({ apiKey: db.users[key].apiKey });
});

app.get('/api/keys/mine', (req, res) => {
  const { username } = req.query || {};
  if (!username) return res.status(400).json({ error: 'username kerak.' });
  const key = String(username).toLowerCase();
  const u = db.users[key];
  res.json({ apiKey: (u && u.apiKey) || null });
});

const PUBLIC_MODEL_MAP = { 'noor-ai-1.0': 'coder', 'noor-ai-1.5': 'general', 'noor-ai-2.0': 'coder2' };
PRO_TIERS.forEach((t) => { PUBLIC_MODEL_MAP['noor-ai-' + t.version] = t.mode; });

// Tashqi dasturchilar uchun ochiq, bepul chat completions endpoint.
// Sinov: curl -X POST https://SIZNING-DOMEN/api/v1/chat/completions \
//   -H "Authorization: Bearer noor_..." -H "Content-Type: application/json" \
//   -d '{"model":"noor-ai-1.5","messages":[{"role":"user","content":"Salom!"}]}'
app.post('/api/v1/chat/completions', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(req.headers['x-api-key'] || '');
  if (!apiKey) return res.status(401).json({ error: 'API kalit kerak. Header: Authorization: Bearer <kalit>' });

  const ownerKey = Object.keys(db.users).find(k => db.users[k].apiKey === apiKey);
  const owner = ownerKey ? db.users[ownerKey] : null;
  if (!owner) return res.status(401).json({ error: 'API kalit noto\'g\'ri yoki bekor qilingan.' });

  const { model, messages } = req.body || {};
  const mode = PUBLIC_MODEL_MAP[model];
  if (!mode) return res.status(400).json({ error: `Noma'lum model "${model}". Quyidagilardan birini tanlang: ${Object.keys(PUBLIC_MODEL_MAP).join(', ')}` });
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages massivi kerak, masalan: [{"role":"user","content":"Salom"}]' });
  if (typeof fetch !== 'function') {
    return res.status(500).json({ error: 'Serverdagi Node.js versiyasi eski (18-dan past).' });
  }

  const result = await runNoorChat(mode, messages, ownerKey === 'abdunurcreator');
  res.status(result.status).json(result.data);
});

const PORT = process.env.PORT || 3000;
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
