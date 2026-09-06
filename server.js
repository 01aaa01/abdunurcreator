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

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
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

const verificationCodes = {};
const pendingRegistrations = {};
const telegramPendingCodes = {};
const passwordResetCodes = {};

function generateCode(length = 6) {
  return Math.random().toString().slice(2, 2 + length);
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
      subject: type === 'reset' ? 'Noor AI - Password Reset' : 'Noor AI - Verification',
      html: '<h2>Noor AI</h2><p>Your code: <strong>' + code + '</strong></p><p>Valid for 5 minutes.</p>'
    });
    return true;
  } catch (e) { console.error('Email error:', e.message); return false; }
}

async function sendTelegramCode(chatId, code, type) {
  try {
    const msg = type === 'reset' ? 'Password Reset Code: ' + code : 'Verification Code: ' + code;
    await bot.sendMessage(chatId, msg);
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
  return res.json({ success: true, needChatId: true });
});

app.post('/api/send-telegram-code', async (req, res) => {
  const { chatId, sessionId } = req.body;
  const pending = pendingRegistrations[sessionId];
  if (!pending) return res.status(400).json({ error: 'Session not found' });
  const code = generateCode();
  verificationCodes[code] = { sessionId, expires: Date.now() + 5 * 60 * 1000, type: 'signup' };
  const sent = await sendTelegramCode(chatId, code, 'verification');
  return sent ? res.json({ success: true }) : res.status(500).json({ error: 'Failed to send code' });
});

app.post('/api/verify-code', (req, res) => {
  const { code } = req.body;
  const v = verificationCodes[code];
  if (!v || v.expires < Date.now()) return res.status(400).json({ error: 'Invalid code' });
  const pending = pendingRegistrations[v.sessionId];
  if (!pending) return res.status(400).json({ error: 'Session not found' });
  
  const key = pending.username.toLowerCase().replace('@', '');
  db.users[key] = {
    username: pending.username, name: pending.name || '', email: pending.email || '',
    chatId: null, passwordHash: pending.passwordHash, passwordSalt: pending.passwordSalt, createdAt: Date.now()
  };
  delete pendingRegistrations[v.sessionId];
  delete verificationCodes[code];
  saveDB();
  res.json({ success: true, verified: true, username: db.users[key].username });
});

app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Missing fields' });
  if (identifier.toLowerCase() === 'abdunurcreator' && password === '0101') return res.json({ success: true, isAdmin: true, username: 'abdunurcreator' });
  
  const found = Object.entries(db.users).find(([k, u]) =>
    u.username?.toLowerCase().replace('@', '') === identifier?.toLowerCase().replace('@', '') ||
    u.email?.toLowerCase() === identifier?.toLowerCase()
  );
  if (!found || !found[1].passwordHash) return res.status(400).json({ error: 'User not found or no password' });
  if (!verifyPassword(password, found[1].passwordSalt, found[1].passwordHash)) return res.status(400).json({ error: 'Wrong password' });
  res.json({ success: true, isAdmin: false, username: found[1].username });
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

// Chat API
const FREE_MODELS = ['anthropic/claude-3.5-haiku', 'google/gemini-2.0-flash-exp', 'deepseek/deepseek-chat-v3-0324'];
const PRO_MODELS_25 = ['anthropic/claude-sonnet-4-20250514', 'google/gemini-2.5-pro-preview-06-05'];
const PRO_MODELS_30 = ['anthropic/claude-opus-4-20250514', 'google/gemini-3-ultra'];

function pickModel(model) {
  if (model === 'noor-ai-1.5') return FREE_MODELS[Math.floor(Math.random() * FREE_MODELS.length)];
  if (model === 'noor-ai-2.5') return PRO_MODELS_25[Math.floor(Math.random() * PRO_MODELS_25.length)];
  if (model === 'noor-ai-3.0') return PRO_MODELS_30[Math.floor(Math.random() * PRO_MODELS_30.length)];
  return model;
}

app.post('/api/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body;
    if (!OPENROUTER_KEY && model?.includes('noor')) return res.status(503).json({ error: { message: 'API key not configured' } });
    
    const targetModel = pickModel(model);
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://noor-ai.com', 'X-Title': 'Noor AI' },
      body: JSON.stringify({ model: targetModel, messages })
    });
    const data = await resp.json();
    res.json(data);
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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Noor AI server running on port ' + PORT));
