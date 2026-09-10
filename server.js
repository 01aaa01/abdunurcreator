require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const EMAIL_HOST = process.env.EMAIL_HOST || '';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@abdunurcreator.com';

let emailTransporter = null;
if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: EMAIL_HOST, port: EMAIL_PORT, secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
  console.log('Email configured');
} else {
  console.log('Email not configured');
}

const token = process.env.BOT_TOKEN;
if (!token) { console.error('BOT_TOKEN required'); process.exit(1); }
const bot = new TelegramBot(token, { polling: true });

let OPENROUTER_KEY = process.env.OPENROUTER_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = '0101';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const DB_FILE = path.join(__dirname, 'data.json');
let db = { users: {}, sessions: {} };

function loadDB() {
  try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { console.error('DB load error:', e.message); }
}

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('DB save error:', e.message); }
}

loadDB();
db.telegramUsers = db.telegramUsers || {};
db.ads = db.ads || [];

// OPENROUTER_KEY .env da bo'lmasa — data.json > config.openRouterKey dan olamiz
if (!OPENROUTER_KEY && db.config && db.config.openRouterKey) {
  OPENROUTER_KEY = db.config.openRouterKey;
}

const verificationCodes = {};
const pendingRegistrations = {};
const telegramPendingCodes = {};
const passwordResetCodes = {};
const loginCodes = {};
const completedRegistrations = {};

function generateCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
  return code;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

async function sendEmailCode(email, code, type) {
  if (!emailTransporter) {
    console.log('Email to ' + email + ': Code = ' + code);
    return true;
  }
  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM, to: email,
      subject: type === 'reset' ? 'Noor AI - Password Reset' : (type === 'login' ? 'Noor AI - Login Code' : 'Noor AI - Verification'),
      html: '<h2>Noor AI</h2><p>Your code: <strong>' + code + '</strong></p><p>Valid for 5 minutes.</p>'
    });
    return true;
  } catch (e) { console.error('Email error:', e.message); return false; }
}

function findUser(identifier) {
  if (!identifier) return null;
  const norm = String(identifier).toLowerCase().replace('@', '');
  const entry = Object.entries(db.users).find(([k, u]) =>
    (u.username || k).toLowerCase().replace('@', '') === norm ||
    (u.email || '').toLowerCase() === String(identifier).toLowerCase()
  );
  return entry || null;
}

async function sendTelegramCode(chatId, code, type) {
  try {
    let msg;
    if (type === 'reset') msg = '🔐 Noor AI password reset code: <b>' + code + '</b>\n\nEnter it on the website to set a new password.\nValid for 10 minutes.';
    else if (type === 'signup') msg = '🔐 Noor AI verification code: <b>' + code + '</b>\n\nEnter it on the website to finish signing up.\nValid for 5 minutes.';
    else msg = '🔐 Noor AI verification code: <b>' + code + '</b>\n\nValid for 5 minutes.';
    await bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    return true;
  } catch (e) { console.error('Telegram error:', e.message); return false; }
}

bot.onText(/\/start(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = (match[1] || '').trim();
  
  if (args.startsWith('verify_')) {
    const code = args.replace('verify_', '');
    const v = verificationCodes[code];
    if (v && v.expires > Date.now()) {
      const pending = pendingRegistrations[v.sessionId];
      if (pending) {
        const key = pending.username.toLowerCase().replace('@', '');
        db.users[key] = {
          username: pending.username, name: pending.name || '', email: pending.email || '',
          chatId: chatId, passwordHash: pending.passwordHash, passwordSalt: pending.passwordSalt, createdAt: Date.now()
        };
        delete pendingRegistrations[v.sessionId];
        delete verificationCodes[code];
        completedRegistrations[v.sessionId] = { username: pending.username };
        saveDB();
        await bot.sendMessage(chatId, 'Registration complete! You can now login.');
        return;
      }
    } else {
      await bot.sendMessage(chatId, 'Invalid or expired code.');
      return;
    }
  }
  
  if (args.startsWith('reset_')) {
    const code = args.replace('reset_', '');
    const r = passwordResetCodes[code];
    if (r && r.expires > Date.now()) {
      telegramPendingCodes[chatId] = { code, method: 'telegram' };
      await bot.sendMessage(chatId, 'Please enter your new password:');
      return;
    }
  }
  
  await bot.sendMessage(chatId, 'Welcome to Noor AI! Use the website to register or login.');
});

bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/') && telegramPendingCodes[msg.chat.id]) {
    const newPassword = msg.text.trim();
    if (newPassword.length >= 6) {
      const r = passwordResetCodes[telegramPendingCodes[msg.chat.id].code];
      if (r) {
        const key = r.identifier.toLowerCase().replace('@', '');
        if (db.users[key]) {
          const salt = generateSalt();
          db.users[key].passwordSalt = salt;
          db.users[key].passwordHash = hashPassword(newPassword, salt);
          saveDB();
          delete passwordResetCodes[telegramPendingCodes[msg.chat.id].code];
          delete telegramPendingCodes[msg.chat.id];
          await bot.sendMessage(msg.chat.id, 'Password updated!');
        }
      }
    }
  }
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'a.html')));
app.get('/coder', (req, res) => res.sendFile(path.join(__dirname, 'coder.html')));

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID, hasEmail: !!(EMAIL_HOST && EMAIL_USER && EMAIL_PASS) });
});

app.post('/api/check-user', (req, res) => {
  const { identifier } = req.body;
  const found = Object.entries(db.users).find(([k, u]) => 
    u.username?.toLowerCase().replace('@', '') === identifier?.toLowerCase().replace('@', '') ||
    u.email?.toLowerCase() === identifier?.toLowerCase()
  );
  res.json({ exists: !!found, hasPassword: !!(found && found[1].passwordHash), hasEmail: !!(found && found[1].email), hasTelegram: !!(found && found[1].chatId) });
});

app.post('/api/send-verification', async (req, res) => {
  const { name, username, email, password, method } = req.body;
  if (!username || !password || !method) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores (3-30)' });
  if (username.toLowerCase() === 'abdunurcreator') return res.status(400).json({ error: 'This username is reserved' });
  
  const existing = Object.values(db.users).find(u => u.username?.toLowerCase() === username?.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Username taken' });
  
  const code = generateCode();
  const sessionId = crypto.randomBytes(16).toString('hex');
  const salt = generateSalt();
  
  pendingRegistrations[sessionId] = { name: name || '', username, email: email || '', passwordHash: hashPassword(password, salt), passwordSalt: salt };
  verificationCodes[code] = { sessionId, expires: Date.now() + 5 * 60 * 1000, type: 'signup' };
  
  if (method === 'email' && email) {
    const sent = await sendEmailCode(email, code, 'verification');
    return sent ? res.json({ success: true }) : res.status(500).json({ error: 'Failed to send email' });
  }
  if (method === 'google') {
    const key = email.toLowerCase();
    db.users[key] = { username: username, name: name || '', email, chatId: null, passwordHash: hashPassword(password, salt), passwordSalt: salt, createdAt: Date.now() };
    delete pendingRegistrations[sessionId];
    delete verificationCodes[code];
    saveDB();
    return res.json({ success: true, verified: true, username: db.users[key].username });
  }
  if (method === 'telegram') return res.json({ success: true, sessionId, verifyUrl: 'https://t.me/abdunurcreator_bot?start=verify_' + code });
  return res.status(400).json({ error: 'Unknown method' });
});

app.post('/api/verify-code', (req, res) => {
  const { code } = req.body;
  // Signup verification code
  const v = verificationCodes[code];
  if (v && v.expires >= Date.now()) {
    const pending = pendingRegistrations[v.sessionId];
    if (pending) {
      const key = pending.username.toLowerCase().replace('@', '');
      db.users[key] = {
        username: pending.username, name: pending.name || '', email: pending.email || '',
        chatId: null, passwordHash: pending.passwordHash, passwordSalt: pending.passwordSalt, createdAt: Date.now()
      };
      delete pendingRegistrations[v.sessionId];
      delete verificationCodes[code];
      saveDB();
      return res.json({ success: true, verified: true, username: db.users[key].username });
    }
  }
  // Login code (email / telegram login)
  const lc = loginCodes[code];
  if (lc && lc.expires >= Date.now()) {
    delete loginCodes[code];
    const found = findUser(lc.identifier);
    if (!found) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, verified: true, username: found[1].username });
  }
  res.status(400).json({ error: 'Invalid code' });
});

app.get('/api/verify-status', (req, res) => {
  const { sessionId } = req.query;
  const done = completedRegistrations[sessionId];
  if (!done) return res.json({ verified: false });
  delete completedRegistrations[sessionId];
  res.json({ verified: true, username: done.username });
});

app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Missing fields' });
  // ADMIN: abdunurcreator / 0101
  if (identifier.toLowerCase() === 'abdunurcreator' && password === '0101') return res.json({ success: true, isAdmin: true, username: 'abdunurcreator' });
  
  const found = findUser(identifier);
  if (!found || !found[1].passwordHash) return res.status(400).json({ error: 'User not found or no password' });
  if (!verifyPassword(password, found[1].passwordSalt, found[1].passwordHash)) return res.status(400).json({ error: 'Wrong password' });
  res.json({ success: true, isAdmin: false, username: found[1].username });
});

app.post('/api/send-login-code', async (req, res) => {
  const { identifier, method } = req.body;
  if (!identifier || !method) return res.status(400).json({ error: 'Missing fields' });
  const found = findUser(identifier);
  if (!found) return res.status(404).json({ error: 'User not found' });
  const code = generateCode();
  loginCodes[code] = { identifier: found[1].username, expires: Date.now() + 5 * 60 * 1000 };
  if (method === 'telegram') {
    if (!found[1].chatId) return res.status(400).json({ error: 'Account is not linked to Telegram' });
    const sent = await sendTelegramCode(found[1].chatId, code, 'login');
    if (!sent) return res.status(500).json({ error: 'Failed to send code' });
    return res.json({ success: true, method: 'telegram' });
  }
  if (method === 'email') {
    if (!found[1].email) return res.status(400).json({ error: 'No email on this account' });
    const sent = await sendEmailCode(found[1].email, code, 'login');
    if (!sent) return res.status(500).json({ error: 'Failed to send email' });
    return res.json({ success: true, method: 'email' });
  }
  res.status(400).json({ error: 'Unknown method' });
});

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt) === hash;
}

app.post('/api/forgot-password', async (req, res) => {
  const { identifier } = req.body;
  const found = Object.entries(db.users).find(([k, u]) =>
    u.username?.toLowerCase().replace('@', '') === identifier?.toLowerCase().replace('@', '') ||
    u.email?.toLowerCase() === identifier?.toLowerCase()
  );
  if (!found) return res.status(404).json({ error: 'User not found' });
  
  const code = generateCode();
  passwordResetCodes[code] = { identifier, expires: Date.now() + 10 * 60 * 1000 };
  
  if (found[1].chatId) {
    const sent = await sendTelegramCode(found[1].chatId, code, 'reset');
    if (sent) return res.json({ success: true, method: 'telegram' });
  }
  if (found[1].email) {
    const sent = await sendEmailCode(found[1].email, code, 'reset');
    if (sent) return res.json({ success: true, method: 'email' });
  }
  res.status(500).json({ error: 'Failed to send code' });
});

app.post('/api/reset-password', (req, res) => {
  const { code, newPassword } = req.body;
  if (!code || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Invalid request' });
  const r = passwordResetCodes[code];
  if (!r || r.expires < Date.now()) return res.status(400).json({ error: 'Invalid code' });
  
  const found = Object.entries(db.users).find(([k, u]) =>
    u.username?.toLowerCase().replace('@', '') === r.identifier?.toLowerCase().replace('@', '') ||
    u.email?.toLowerCase() === r.identifier?.toLowerCase()
  );
  if (!found) return res.status(404).json({ error: 'User not found' });
  
  const salt = generateSalt();
  found[1].passwordSalt = salt;
  found[1].passwordHash = hashPassword(newPassword, salt);
  saveDB();
  delete passwordResetCodes[code];
  res.json({ success: true });
});

app.post('/api/google-login', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credential required' });
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google not configured' });
  
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    const info = await r.json();
    if (!r.ok || info.aud !== GOOGLE_CLIENT_ID) return res.status(401).json({ error: 'Invalid token' });
    
    const email = info.email;
    const key = email.toLowerCase();
    if (!db.users[key]) {
      db.users[key] = { username: email.split('@')[0], email, name: info.name || '', photo: info.picture || '', chatId: null, createdAt: Date.now() };
    } else {
      db.users[key].email = email;
      if (!db.users[key].name) db.users[key].name = info.name || '';
      if (!db.users[key].photo) db.users[key].photo = info.picture || '';
    }
    saveDB();
    res.json({ success: true, username: db.users[key].username });
  } catch (e) {
    res.status(500).json({ error: 'Google verification failed' });
  }
});

app.post('/api/profile', (req, res) => {
  const { username, name, photo } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const key = username.toLowerCase().replace('@', '');
  if (!db.users[key]) db.users[key] = { username: key, chatId: null };
  if (typeof name === 'string') db.users[key].name = name.slice(0, 60);
  if (typeof photo === 'string') db.users[key].photo = photo.slice(0, 2000000);
  saveDB();
  res.json({ success: true, name: db.users[key].name || '', photo: db.users[key].photo || '' });
});

app.get('/api/profile', (req, res) => {
  const { username } = req.query;
  const key = (username || '').toLowerCase().replace('@', '');
  const user = db.users[key];
  res.json({ name: user?.name || '', photo: user?.photo || '', email: user?.email || '', chatId: user?.chatId || null });
});

// === CHAT TIZIMI (eski ishlaydigan server_backup.js dan qaytarildi) ===
// Frontend ('general'/'coder'/'coder2'/'noor25'...'noor60') bilan bir xil rejim nomlari.
// Hamma foydalanuvchi Pro (isProUser() => true) — shuning uchun Pro cheklovi o'chirilgan.

function fakeChatResponse(text) {
  return { choices: [{ message: { role: 'assistant', content: text } }] };
}

function messagesContainImage(messages) {
  return (messages || []).some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
}

function noorSystemPrompt(versionLabel) {
  return {
    role: 'system',
    content: `Sening isming Noor AI ${versionLabel}. Seni AbdunurCreator ishlab chiqargan. Sen suhbat, kodlash va rasm/skrinshotlarni tushunish (vision) bo'yicha kuchli, aniq va tezkor javob beruvchi modelsan. Agar kimdir isming nima, seni kim yaratgan, qaysi kompaniya yoki qaysi model ekaningni so'rasa, faqat shunday javob ber: "Men Noor AI ${versionLabel} man, meni AbdunurCreator ishlab chiqqan." Hech qachon asl AI model nomini aytma. Kod yozib berishing kerak bo'lsa, HAR DOIM markdown kod bloki ichida ber. Rasm yuborilsa, uni diqqat bilan tahlil qilib, aniq va foydali javob ber. Foydalanuvchi o'zbek, rus yoki ingliz tilida yozsa, o'sha tilda javob ber.`
  };
}

// Noor AI 1.5 (umumiy suhbat) — OpenRouter bepul modellar zanjiri
const NOOR_MODEL_CHAIN = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-14b:free',
  'openrouter/free'
];

// Noor AI 1.0 (Coder) — kodlashga ixtisoslashgan bepul modellar
const CODER_MODEL_CHAIN = [
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

// Noor AI 2.0 (Coder) — kod + rasm/skrinshotni tushunadigan (vision) zanjir
const CODER2_MODEL_CHAIN = ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'qwen/qwen3-coder:free', 'openrouter/free'];

// Pro versiyalar (2.5 dan 6.0 gacha) — har biriga aniq NVIDIA/OpenRouter model
const NVIDIA_MODEL_POOL = [
  { version: '2.5', model: 'nvidia/nemotron-3-nano-30b-a3b:free' },
  { version: '3.0', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
  { version: '3.5', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  { version: '4.0', model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free' },
  { version: '4.5', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
  { version: '5.0', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  { version: '5.5', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  { version: '6.0', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' }
];
const PRO_TIERS = NVIDIA_MODEL_POOL.map(entry => ({
  version: entry.version,
  mode: 'noor' + entry.version.replace('.', ''),
  model: entry.model
}));
const PRO_TIER_BY_MODE = {};
PRO_TIERS.forEach((t) => { PRO_TIER_BY_MODE[t.mode] = t; });

async function callOpenRouter(model, messages, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': 'Noor AI'
    },
    body: JSON.stringify({ model, messages })
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Ichki chat UI VA tashqi ommaviy API (/api/v1/chat/completions) ikkalasi ham shu funksiyani ishlatadi.
async function runNoorChat(mode, messages) {
  const tier = PRO_TIER_BY_MODE[mode];

  // Eski uchta bepul rejim (1.0 Coder / 1.5 / 2.0 Coder) haqiqiy vision modellarga ega emas.
  if (!tier && messagesContainImage(messages)) {
    const modeLabel = mode === 'coder' ? 'Noor AI 1.0 (Coder)' : (mode === 'coder2' ? 'Noor AI 2.0 (Coder)' : 'Noor AI 1.5');
    return { status: 200, data: fakeChatResponse(`Kechirasiz, men (${modeLabel}) rasm o'qiy olmayman. Rasmni tushuntirib berishimni xohlasangiz, iltimos Noor AI 2.5 yoki undan yuqori Pro rejimni sinab ko'ring.`) };
  }

  const versionLabel = tier ? tier.version : (mode === 'coder' ? '1.0 (Coder)' : (mode === 'coder2' ? '2.0 (Coder)' : '1.5'));
  const outgoingMessages = [noorSystemPrompt(versionLabel), ...(messages || [])];
  let lastError = null;

  if (!OPENROUTER_KEY) {
    return { status: 500, data: { error: "Serverda OPENROUTER_KEY sozlanmagan. .env faylga kalitni kiriting yoki data.json > config.openRouterKey ga joylang." } };
  }

  let chain;
  if (tier) {
    // Avval versiyaga tegishli model, ishlamasa eng kuchli Ultra, oxirida openrouter/free
    chain = [...new Set([tier.model, 'nvidia/nemotron-3-ultra-550b-a55b:free', 'openrouter/free'].filter(Boolean))];
  } else if (mode === 'coder') {
    chain = CODER_MODEL_CHAIN;
  } else if (mode === 'coder2') {
    chain = CODER2_MODEL_CHAIN;
  } else {
    chain = NOOR_MODEL_CHAIN;
  }

  for (const model of chain) {
    try {
      const { ok, data } = await callOpenRouter(model, outgoingMessages, OPENROUTER_KEY);
      if (ok) return { status: 200, data };
      lastError = (data.error && data.error.message) || JSON.stringify(data.error || data);
      console.error(`Noor AI: "${model}" javob bermadi, keyingisiga o'tilmoqda:`, lastError);
    } catch (e) {
      lastError = e.message;
      console.error(`Noor AI: "${model}" ulanish xatosi, keyingisiga o'tilmoqda:`, lastError);
    }
  }
  return { status: 502, data: { error: `Noor AI hozircha band (barcha modellar javob bermadi): ${lastError || "noma'lum xatolik"}` } };
}

// Saytning o'z chati uchun endpoint (frontend /api/chat ga so'rov yuboradi)
app.post('/api/chat', async (req, res) => {
  const { messages, mode } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages massivi kerak.' });
  if (typeof fetch !== 'function') return res.status(500).json({ error: "Node.js 18+ kerak." });
  const result = await runNoorChat(mode || 'general', messages);
  res.status(result.status).json(result.data);
});

// === OMMAVIY API — dasturchilar shaxsiy API kaliti bilan Noor AI'ga murojaat qilishi uchun ===
function genApiKey() {
  return 'noor_' + crypto.randomBytes(24).toString('hex');
}

app.post('/api/keys/create', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username kerak.' });
  const key = String(username).toLowerCase().replace('@', '');
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
  const key = String(username).toLowerCase().replace('@', '');
  const u = db.users[key];
  res.json({ apiKey: (u && u.apiKey) || null });
});

const PUBLIC_MODEL_MAP = { 'noor-ai-1.0': 'coder', 'noor-ai-1.5': 'general', 'noor-ai-2.0': 'coder2' };
PRO_TIERS.forEach((t) => { PUBLIC_MODEL_MAP['noor-ai-' + t.version] = t.mode; });

app.post('/api/v1/chat/completions', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(req.headers['x-api-key'] || '');
    if (!apiKey) return res.status(401).json({ error: { message: "API kalit kerak. Header: Authorization: Bearer <kalit>" } });

    const ownerKey = Object.keys(db.users).find(k => db.users[k].apiKey === apiKey);
    if (!ownerKey) return res.status(401).json({ error: { message: "API kalit noto'g'ri yoki bekor qilingan." } });

    const { model, messages } = req.body || {};
    const mode = PUBLIC_MODEL_MAP[model];
    if (!mode) return res.status(400).json({ error: { message: `Noma'lum model "${model}". Quyidagilardan birini tanlang: ${Object.keys(PUBLIC_MODEL_MAP).join(', ')}` } });
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: { message: 'messages massivi kerak.' } });

    const result = await runNoorChat(mode, messages);
    res.status(result.status).json(result.data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

app.get('/api/v1/models', (req, res) => {
  res.json({ data: [
    { id: 'noor-ai-1.5', name: 'Noor AI 1.5 (Free)' },
    { id: 'noor-ai-2.5', name: 'Noor AI 2.5 (Pro)' },
    { id: 'noor-ai-3.0', name: 'Noor AI 3.0 (Ultra)' },
    { id: 'noorimg', name: 'Noor Image', type: 'image' },
    { id: 'noorvideo10', name: 'Noor Video', type: 'video' },
    { id: 'nooraudio', name: 'Noor Audio', type: 'audio' }
  ]});
});

app.post('/api/v1/images/generations', async (req, res) => {
  try {
    const { prompt, size } = req.body;
    const encoded = encodeURIComponent(prompt + (size ? '. ' + size + ' aspect ratio' : ''));
    res.json({ data: [{ url: 'https://image.pollinations.ai/prompt/' + encoded + '?width=1024&height=1024&seed=' + Math.floor(Math.random() * 1000000) }] });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

app.post('/api/v1/videos/generations', async (req, res) => {
  try {
    const { prompt } = req.body;
    const encoded = encodeURIComponent(prompt);
    res.json({ data: [{ url: 'https://video.pollinations.ai/prompt/' + encoded }] });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

app.post('/api/v1/audio/generations', async (req, res) => {
  try {
    const { input, voice } = req.body;
    const encoded = encodeURIComponent(input);
    res.json({ data: [{ url: 'https://audio.pollinations.ai/prompt/' + encoded + '?voice=' + (voice || 'alloy') }] });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

app.get('/api/admin/users', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ users: Object.values(db.users).map(u => ({ username: u.username, email: u.email, chatId: u.chatId, createdAt: u.createdAt })) });
});

function isAdminPassword(pass) { return pass === ADMIN_PASSWORD; }

app.get('/api/admin/pending', (req, res) => {
  if (!isAdminPassword(req.query.password)) return res.status(401).json({ error: 'Unauthorized' });
  const users = Object.values(db.users)
    .map(u => ({ username: u.username, name: u.name || '', email: u.email || '', chatId: u.chatId || null, requestedAt: u.createdAt || Date.now() }))
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
  res.json({ users });
});

app.post('/api/admin/send-message', async (req, res) => {
  const { password, username, message, code, color } = req.body;
  if (!isAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  if (!username || !message) return res.status(400).json({ error: 'Username and message required' });
  const found = findUser(username);
  if (!found) return res.status(404).json({ error: 'User not found' });
  if (!found[1].chatId) return res.status(400).json({ error: 'User has no Telegram chat' });
  let text = (color === 'red' ? '❌ ' : '✅ ') + message;
  if (code) text += '\n\n🔑 Kirish kodi: <b>' + code + '</b>';
  try {
    await bot.sendMessage(found[1].chatId, text, { parse_mode: 'HTML' });
    res.json({ message: 'Xabar yuborildi!' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send: ' + e.message });
  }
});

app.post('/api/admin/delete-user', (req, res) => {
  const { password, username } = req.body;
  if (!isAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  if (!username) return res.status(400).json({ error: 'Username required' });
  const found = findUser(username);
  if (!found) return res.status(404).json({ error: 'User not found' });
  delete db.users[found[0]];
  saveDB();
  res.json({ success: true });
});

app.get('/api/ads', (req, res) => res.json({ ads: db.ads || [] }));

app.post('/api/ads', async (req, res) => {
  const { password, image, company, link, text } = req.body;
  if (!isAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  if (!image || !company || !link || !text) return res.status(400).json({ error: 'All fields required' });
  db.ads = db.ads || [];
  db.ads.push({ image, company, link, text, createdAt: Date.now() });
  saveDB();
  let broadcastCount = 0;
  const chatIds = [...new Set(Object.values(db.users).map(u => u.chatId).filter(Boolean))];
  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, '📢 <b>' + company + '</b>\n\n' + text + '\n\n<a href="' + link + '">Batafsil</a>', { parse_mode: 'HTML' });
      broadcastCount++;
    } catch (e) { /* skip failed chats */ }
  }
  res.json({ success: true, broadcastCount });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Noor AI server running on port ' + PORT));
