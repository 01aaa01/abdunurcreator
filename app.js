// === API BASE URL ===
// Sayt qanday ochilishidan qat'i nazar to'g'ri ishlaydi:
// - Agar fayl to'g'ridan (file://) ochilsa -> localhost:3000 serverga uladi (lokal test uchun)
// - Agar sayt biror domen/hosting orqali ochilsa (masalan https://sizningdomeningiz.com) ->
//   o'sha domenning o'zidagi API ga uladi, chunki server statik fayllarni ham,
//   API'ni ham bir xil manzilda (bir xil origin'da) beradi.
// Eski versiyada BASE_URL doim 'http://localhost:3000' bo'lgani uchun,
// sayt boshqa foydalanuvchilarning brauzerida ochilganda ular o'zlarining
// localhost:3000'iga (ya'ni hech narsaga) ulanishga urinishgan va shu sababli
// to'g'ri kod kiritsalar ham "Server bilan aloqa yo'q" xatosini olishgan.
const BASE_URL = (location.protocol === 'file:') ? 'http://localhost:3000' : '';

// === PARALLAX BACKGROUND O'CHIRILGAN ===
// (AI nomlari background'da ko'rinmasin)

// === STATE ===
let currentUser='guest'; // AUTO-LOGIN: login oynasini o'tkazib yuborish
let isAdmin=false;
let adminPass='0101';
let selectedMsgUser='';
let msgColor='green';

// === THEME & PRO USER HELPERS ===
function isProUser() {
  return isAdmin || currentUser === 'muslim';
}

function initTheme() {
  const savedTheme = localStorage.getItem('noor_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    updateThemeBtnUI('light');
  } else {
    document.body.classList.remove('light-mode');
    updateThemeBtnUI('dark');
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  const theme = isLight ? 'light' : 'dark';
  localStorage.setItem('noor_theme', theme);
  updateThemeBtnUI(theme);
  noorToast(isLight ? "Kunuzi (Light) rejim faollashdi ☀️" : "Tungi (Dark) rejim faollashdi 🌙");
}

function updateThemeBtnUI(theme) {
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
  if (label) label.textContent = theme === 'light' ? 'Kunuzi rejim' : 'Tungi rejim';
}

document.addEventListener('DOMContentLoaded', initTheme);

// === SESSION PERSISTENCE (login bir marta, keyin saqlanadi) ===
const SESSION_KEY='abdunurcreator_session';
function saveSession(username,admin){
  try{localStorage.setItem(SESSION_KEY,JSON.stringify({username,admin}));}catch(e){}
}
function clearSession(){
  try{localStorage.removeItem(SESSION_KEY);}catch(e){}
}
// === ROUTING & STAGE HELPERS ===
function updateUrlRoute(path, push = true) {
  if (push && window.location.pathname !== path) {
    window.history.pushState({ route: path }, '', path);
  }
}

function handleRouteNavigation(path) {
  const route = path || window.location.pathname;
  if (route === '/admin') {
    openAdminPanel(false);
  } else if (route === '/chat') {
    openChatStage(false);
  } else if (route === '/login') {
    showStage('stage-login', false);
  } else if (route === '/profile') {
    if (currentUser) {
      showStage('main-content', false);
      openProfile();
    } else {
      showStage('stage-login', false);
    }
  } else {
    if (currentUser) {
      showStage('main-content', false);
    } else {
      showStage('stage-login', false);
    }
  }
}

window.addEventListener('popstate', () => {
  handleRouteNavigation(window.location.pathname);
});

function restoreSession(){
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw) {
      // AUTO-LOGIN: login o'rniga darhol chatga o'tkazamiz
      currentUser = 'guest';
      isAdmin = false;
      document.body.classList.add('chat-active');
      showStage('stage-chat', false);
      return false;
    }
    const s=JSON.parse(raw);
    if(!s||!s.username) {
      // AUTO-LOGIN
      currentUser = 'guest';
      isAdmin = false;
      document.body.classList.add('chat-active');
      showStage('stage-chat', false);
      return false;
    }
    currentUser=s.username;isAdmin=!!s.admin;
    document.getElementById('welcome-name').textContent='@'+currentUser;
    document.getElementById('admin-nav-btn').style.display = isAdmin ? 'inline-flex' : 'none';
    document.body.classList.add('chat-active');
    showStage('stage-chat', false);
    fetchAds();
    return true;
  }catch(e){
    // AUTO-LOGIN
    currentUser = 'guest';
    isAdmin = false;
    document.body.classList.add('chat-active');
    showStage('stage-chat', false);
    return false;
  }
}

// === UI HELPERS ===
function showStage(id, pushRoute = true){
  document.querySelectorAll('.stage').forEach(s=>s.classList.add('hidden'));
  const mainContent = document.getElementById('main-content');
  const keepsMainWrapperVisible = id === 'stage-chat' || id === 'stage-admin-dash';
  mainContent.classList.toggle('show', keepsMainWrapperVisible || id === 'main-content');
  mainContent.classList.toggle('stage-overlay-active', keepsMainWrapperVisible);
  document.body.classList.toggle('chat-overlay-active', keepsMainWrapperVisible);
  const el=document.getElementById(id);
  if(el)el.classList.remove('hidden');

  if (pushRoute) {
    let route = '/main';
    if (id === 'stage-chat') route = '/chat';
    else if (id === 'stage-admin-dash') route = '/admin';
    else if (id === 'stage-login') route = '/login';
    else if (id === 'main-content') route = '/main';
    updateUrlRoute(route);
  }
}

// === AUTH TABS (Kirish / Ro'yxatdan o'tish) ===
function switchAuthTab(tab) {
  document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-pane-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-pane-signup').classList.toggle('hidden', tab !== 'signup');
}

function chooseAuthMethod(paneKind, method) {
  document.getElementById('login-err').textContent = '';
  if (paneKind === 'login') {
    document.getElementById('login-sub-telegram').classList.toggle('hidden', method !== 'telegram');
    document.getElementById('login-sub-password').classList.toggle('hidden', method !== 'password');
  }
}

function onLoginSuccess(username, admin) {
  currentUser = username; isAdmin = admin;
  document.getElementById('welcome-name').textContent = '@' + username;
  document.getElementById('admin-nav-btn').style.display = isAdmin ? 'inline-flex' : 'none';
  saveSession(username, isAdmin);
  showStage('main-content');
  fetchAds();
}

// === LOGIN (Telegram OTP) ===
async function doLogin(){
  const uEl=document.getElementById('tg-username');
  const cEl=document.getElementById('login-code');
  const err=document.getElementById('login-err');
  const username=uEl.value.trim().replace('@','');
  const code=cEl.value.trim();
  if(!username||!code){err.textContent='Username va kodni kiriting.';return;}
  err.textContent='Tekshirilmoqda...';
  try{
    const r=await fetch(BASE_URL+'/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,code})});
    const d=await r.json();
    if(r.ok){ err.textContent=''; onLoginSuccess(username, d.isAdmin); }
    else{err.textContent=d.error||'Xatolik.';}
  }catch(e){err.textContent='Server bilan aloqa yo\'q. Node.js server yoniqmi?';}
}
document.getElementById('login-btn').addEventListener('click',doLogin);
document.getElementById('login-code').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

// === LOGIN (username/parol) ===
async function doPasswordLogin() {
  const identifier = document.getElementById('pw-identifier').value.trim();
  const password = document.getElementById('pw-password').value;
  const err = document.getElementById('login-err');
  if (!identifier || !password) { err.textContent = 'Login va parolni kiriting.'; return; }
  err.textContent = 'Tekshirilmoqda...';
  try {
    const r = await fetch(BASE_URL + '/api/password-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
    const d = await r.json();
    if (r.ok) { err.textContent = ''; onLoginSuccess(d.username, d.isAdmin); }
    else { err.textContent = d.error || 'Xatolik.'; }
  } catch (e) { err.textContent = 'Server bilan aloqa yo\'q.'; }
}
document.getElementById('pw-login-btn').addEventListener('click', doPasswordLogin);
document.getElementById('pw-password').addEventListener('keydown', e => { if (e.key === 'Enter') doPasswordLogin(); });

// === GOOGLE SIGN-IN ===
let googleClientIdCache = null;
async function getGoogleClientId() {
  if (googleClientIdCache !== null) return googleClientIdCache;
  try {
    const r = await fetch(BASE_URL + '/api/google-client-id');
    const d = await r.json();
    googleClientIdCache = d.clientId || '';
  } catch (e) { googleClientIdCache = ''; }
  return googleClientIdCache;
}
async function handleGoogleCredential(response) {
  const err = document.getElementById('login-err');
  err.textContent = 'Tekshirilmoqda...';
  try {
    const r = await fetch(BASE_URL + '/api/google-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
    const d = await r.json();
    if (r.ok) { err.textContent = ''; onLoginSuccess(d.username, d.isAdmin); }
    else { err.textContent = d.error || 'Google orqali kirishda xatolik.'; }
  } catch (e) { err.textContent = 'Server bilan aloqa yo\'q.'; }
}
let googleInitialized = false;
async function renderGoogleOverlay(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const clientId = await getGoogleClientId();
  if (!clientId) return; // hali sozlanmagan — jim turadi, xato ko'rsatmaymiz
  if (typeof google === 'undefined' || !google.accounts) return;
  if (!googleInitialized) {
    google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential, ux_mode: 'popup' });
    googleInitialized = true;
  }
  container.innerHTML = '';
  const w = Math.min(container.parentElement ? container.parentElement.offsetWidth : 300, 400) || 300;
  google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', width: w, text: 'continue_with' });
}

function logout(){
  currentUser='';isAdmin=false;
  clearSession();
  document.getElementById('tg-username').value='';
  document.getElementById('login-code').value='';
  document.getElementById('login-err').textContent='';
  showStage('stage-login');
}

// Sahifa ochilganda avval saqlangan sessiya bormi tekshiramiz, va Google tugmalarini
// (login/signup) darhol, ko'rinmas holda chizib qo'yamiz — sizning chiroyli tugmangiz
// tepada ko'rinadi, bosilganda esa aynan shu joydagi haqiqiy Google oynasi ochiladi.
document.addEventListener('DOMContentLoaded',()=>{
  restoreSession();
  renderGoogleOverlay('google-btn-overlay-login');
  renderGoogleOverlay('google-btn-overlay-signup');
});

// === PROFIL (rasm + ism, username o'zgarmaydi) ===
let pendingProfilePhoto = null;
async function openProfile() {
  document.getElementById('profile-username').value = '@' + currentUser;
  document.getElementById('profile-err').textContent = '';
  document.getElementById('profile-ok').textContent = '';
  pendingProfilePhoto = null;
  try {
    const r = await fetch(BASE_URL + '/api/profile?username=' + encodeURIComponent(currentUser));
    const d = await r.json();
    if (r.ok) {
      document.getElementById('profile-name').value = d.name || '';
      if (d.photo) document.getElementById('profile-photo-preview').src = d.photo;
    }
  } catch (e) {}
  try {
    const r2 = await fetch(BASE_URL + '/api/keys/mine?username=' + encodeURIComponent(currentUser));
    const d2 = await r2.json();
    document.getElementById('profile-api-key').value = (r2.ok && d2.apiKey) ? d2.apiKey : '';
  } catch (e) {}
  document.getElementById('profile-overlay').classList.add('active');
}
document.getElementById('profile-photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
  pendingProfilePhoto = dataUrl;
  document.getElementById('profile-photo-preview').src = dataUrl;
});
async function testApiKey() {
  const input = document.getElementById('profile-api-key');
  const result = document.getElementById('profile-api-test-result');
  if (!input.value) { result.textContent = "Avval API kalit yarating."; result.style.color = 'var(--td)'; return; }
  result.textContent = 'Tekshirilmoqda...';
  result.style.color = 'var(--td)';
  try {
    const r = await fetch(BASE_URL + '/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + input.value },
      body: JSON.stringify({ model: 'noor-ai-1.5', messages: [{ role: 'user', content: 'Salom, bu sinov xabari. Faqat "Ishlayapti!" deb javob ber.' }] })
    });
    const d = await r.json();
    if (r.ok && d.choices && d.choices[0]) {
      result.textContent = '✅ Ishlayapti! Model javobi: ' + d.choices[0].message.content;
      result.style.color = '#00c896';
    } else {
      result.textContent = '❌ Ishlamayapti: ' + (d.error || 'noma\'lum xato');
      result.style.color = '#e74c3c';
    }
  } catch (e) {
    result.textContent = '❌ Serverga ulanib bo\'lmadi: ' + e.message;
    result.style.color = '#e74c3c';
  }
}

async function createOrShowApiKey() {
  const input = document.getElementById('profile-api-key');
  const err = document.getElementById('profile-err');
  const ok = document.getElementById('profile-ok');
  err.textContent = ''; ok.textContent = '';
  if (input.value) { ok.textContent = "API kalitingiz allaqachon bor, pastda ko'rinib turibdi."; return; }
  try {
    const r = await fetch(BASE_URL + '/api/keys/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser }) });
    const d = await r.json();
    if (r.ok) { input.value = d.apiKey; ok.textContent = 'API kalit yaratildi!'; }
    else err.textContent = d.error || 'Xatolik.';
  } catch (e) { err.textContent = 'Server xatoligi.'; }
}
function copyApiKey() {
  const input = document.getElementById('profile-api-key');
  if (!input.value) return;
  input.select();
  navigator.clipboard && navigator.clipboard.writeText(input.value).catch(() => {});
  const ok = document.getElementById('profile-ok');
  ok.textContent = 'Nusxalandi!';
}
async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const err = document.getElementById('profile-err');
  const ok = document.getElementById('profile-ok');
  err.textContent = ''; ok.textContent = '';
  try {
    const body = { username: currentUser, name };
    if (pendingProfilePhoto) body.photo = pendingProfilePhoto;
    const r = await fetch(BASE_URL + '/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (r.ok) ok.textContent = 'Saqlandi!';
    else err.textContent = d.error || 'Xatolik.';
  } catch (e) { err.textContent = 'Server xatoligi.'; }
}

// === TO'LIQ EKRANLI CHAT SAHIFASI (ChatGPT/Claude uslubida) ===
const CHAT_SESSIONS_KEY = 'noor_chat_sessions';
let chatSessions = [];
let activeSessionId = null;

function loadSessionsFromStorage() {
  try { chatSessions = JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || '[]'); } catch (e) { chatSessions = []; }
}
function saveSessionsToStorage() {
  try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatSessions)); } catch (e) {}
}
function renderSidebarSessions() {
  const wrap = document.getElementById('sidebar-sessions');
  wrap.innerHTML = '';
  chatSessions.slice().reverse().forEach(session => {
    const item = document.createElement('div');
    item.className = 'sidebar-session-item' + (session.id === activeSessionId ? ' active' : '');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'sidebar-session-title';
    titleSpan.textContent = session.title || 'Yangi suhbat';
    titleSpan.title = 'Nomini o\'zgartirish uchun ikki marta bosing';
    titleSpan.addEventListener('click', () => loadChatSession(session.id));
    titleSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      renameSession(session.id, titleSpan);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'sidebar-session-del';
    delBtn.title = "O'chirish";
    delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(session.id); });

    item.appendChild(titleSpan);
    item.appendChild(delBtn);
    wrap.appendChild(item);
  });
}

function renameSession(id, titleSpan) {
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sidebar-rename-input';
  input.value = session.title || 'Yangi suhbat';
  titleSpan.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    session.title = input.value.trim().slice(0, 40) || 'Yangi suhbat';
    saveSessionsToStorage();
    renderSidebarSessions();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
}

// === Chiroyli, saytga mos tasdiqlash oynasi va bildirishnoma (native confirm()/alert() o'rniga) ===
function noorConfirm(message, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'noor-modal-overlay';
    overlay.innerHTML = `
      <div class="noor-modal">
        <div class="noor-modal-msg">${escapeHtml(message)}</div>
        <div class="noor-modal-actions">
          <button type="button" class="noor-modal-btn noor-modal-cancel">${escapeHtml(opts.cancelText || 'Bekor qilish')}</button>
          <button type="button" class="noor-modal-btn noor-modal-confirm${opts.danger ? ' danger' : ''}">${escapeHtml(opts.confirmText || 'Ha')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    const close = (result) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 180);
      resolve(result);
    };
    overlay.querySelector('.noor-modal-cancel').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('.noor-modal-confirm').addEventListener('click', () => close(true));
  });
}

let noorToastTimer = null;
function noorToast(message) {
  let el = document.getElementById('noor-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'noor-toast';
    el.className = 'noor-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(noorToastTimer);
  noorToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function deleteSession(id) {
  noorConfirm("Ushbu suhbatni o'chirishga ishonchingiz komilmi?", { danger: true, confirmText: "O'chirish" }).then((ok) => {
    if (!ok) return;
    chatSessions = chatSessions.filter(s => s.id !== id);
    saveSessionsToStorage();
    if (activeSessionId === id) {
      if (chatSessions.length > 0) {
        loadChatSession(chatSessions[chatSessions.length - 1].id);
      } else {
        startNewChatSession();
      }
    } else {
      renderSidebarSessions();
    }
  });
}
function startNewChatSession() {
  const session = { id: 'sess' + Date.now(), title: 'Yangi suhbat', mode: 'general', messages: [] };
  chatSessions.push(session);
  saveSessionsToStorage();
  activeSessionId = session.id;
  chatHistory = [];
  currentChatMode = 'general';
  document.getElementById('chat-model-select').value = 'general';
  syncModelPickerUI('general');
  document.getElementById('chat-msg-container').innerHTML = '';
  appendChatBubble("Yangi suhbat boshlandi. Nima bilan yordam bera olaman?", 'system');
  closeCodePanel();
  renderSidebarSessions();
}
function loadChatSession(id) {
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;
  activeSessionId = id;
  currentChatMode = session.mode || 'general';
  chatHistory = session.messages || [];
  document.getElementById('chat-model-select').value = currentChatMode;
  syncModelPickerUI(currentChatMode);
  const container = document.getElementById('chat-msg-container');
  container.innerHTML = '';
  closeCodePanel();
  if (chatHistory.length === 0) {
    appendChatBubble("Suhbatni boshlash uchun quyida xabar yozing.", 'system');
  } else {
    chatHistory.forEach(m => {
      if (m.role === 'user') {
        const textPart = Array.isArray(m.content) ? (m.content.find(c => c.type === 'text')?.text || '') : m.content;
        const imgPart = Array.isArray(m.content) ? m.content.find(c => c.type === 'image_url') : null;
        if (imgPart) appendChatImage(imgPart.image_url.url);
        if (textPart) appendChatBubble(textPart, 'user');
      } else if (m.role === 'assistant') {
        appendChatBubble(m.content, 'ai');
      }
    });
  }
  renderSidebarSessions();
}
function persistActiveSession(title) {
  const session = chatSessions.find(s => s.id === activeSessionId);
  if (!session) return;
  session.messages = chatHistory;
  session.mode = currentChatMode;
  if (title && (session.title === 'Yangi suhbat' || !session.title)) session.title = title.slice(0, 40);
  saveSessionsToStorage();
  renderSidebarSessions();
}

function openChatStage(pushRoute = true) {
  loadSessionsFromStorage();
  showStage('stage-chat', pushRoute);
  if (chatSessions.length === 0 || !activeSessionId) {
    startNewChatSession();
  } else {
    loadChatSession(activeSessionId);
  }
}
function openNewChat(pushRoute = true) {
  loadSessionsFromStorage();
  startNewChatSession();
  showStage('stage-chat', pushRoute);
}
function closeChatStage() {
  showStage('main-content', true);
}
function closeCodePanel() {
  document.getElementById('chat-code-panel').classList.add('hidden');
  document.getElementById('code-panel-body').innerHTML = '';
}

// === ADMIN PANEL ===
function openAdminPanel(pushRoute = true){
  if (currentUser === 'muslim') {
    noorToast("Sizda Admin panelga kirish ruxsati yo'q, lekin barcha Pro imkoniyatlar siz uchun bepul! 🎉");
    return;
  }
  if(!isAdmin){
    const passInp = document.getElementById('admin-pass-input');
    const errEl = document.getElementById('admin-pass-err');
    if (passInp) passInp.value = '';
    if (errEl) errEl.textContent = '';
    const modal = document.getElementById('admin-pass-overlay');
    if (modal) modal.classList.add('active');
    setTimeout(() => { if (passInp) passInp.focus(); }, 100);
    return;
  }
  showStage('stage-admin-dash', pushRoute);
  loadPendingUsers();
  switchTab('tab-users');
}

function verifyAdminPassword() {
  const pass = (document.getElementById('admin-pass-input')?.value || '').trim();
  const errEl = document.getElementById('admin-pass-err');
  if (pass === '0101' || pass === adminPass) {
    isAdmin = true;
    const modal = document.getElementById('admin-pass-overlay');
    if (modal) modal.classList.remove('active');
    saveSession(currentUser || 'admin', true);
    noorToast("Admin rejimi faol! 🎉");
    showStage('stage-admin-dash', true);
    loadPendingUsers();
    switchTab('tab-users');
  } else {
    if (errEl) errEl.textContent = "Noto'g'ri admin paroli!";
  }
}

function closeAdminPanel(){showStage('main-content', true);}

function switchTab(tabId){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.add('hidden'));
  document.getElementById(tabId).classList.add('active');
  document.getElementById('sec-'+tabId).classList.remove('hidden');
}

// === PENDING USERS ===
async function loadPendingUsers(){
  const container=document.getElementById('user-list-container');
  const countEl=document.getElementById('user-count');
  container.innerHTML='<p style="color:var(--td);font-size:.85rem;">Yuklanmoqda...</p>';
  try{
    const r=await fetch(BASE_URL+'/api/admin/pending?password=0101');
    if(!r.ok){
      let msg='';
      try{const d=await r.json();msg=d.error||'';}catch(e){}
      container.innerHTML='<p style="color:var(--p);">Server xatoligi ('+r.status+'). '+msg+'</p>';
      countEl.textContent='';
      return;
    }
    const d=await r.json();
    const users=d.users||[];
    countEl.textContent=users.length+' ta foydalanuvchi so\'rov yuborgan';
    if(users.length===0){container.innerHTML='<p style="color:var(--td);font-size:.85rem;text-align:center;padding:20px;">Hali hech kim so\'rov yubormaggan.</p>';return;}
    container.innerHTML='';
    users.forEach(u=>{
      const el=document.createElement('div');
      el.className='user-item';
      const t=new Date(u.requestedAt).toLocaleString('uz-UZ');
      el.innerHTML=`<div><div class="uname">@${u.username}</div><div class="utime">${t}</div></div><div style="display:flex;gap:6px;"><button class="btn sm" onclick="selectUser('${u.username}')">Xabar yozish</button><button class="btn sm red" title="Foydalanuvchini o'chirish" onclick="deleteUser('${u.username}')">🗑️</button></div>`;
      container.appendChild(el);
    });
  }catch(e){
    container.innerHTML='<p style="color:var(--p);">Server bilan bog\'lanib bo\'lmadi: '+(e.message||'noma\'lum xatolik')+'</p>';
    countEl.textContent='';
  }
}

// === USERNI O'CHIRISH ===
async function deleteUser(username){
  const ok = await noorConfirm(`@${username} ni ro'yxatdan butunlay o'chirishga ishonchingiz komilmi? (U qayta /start bossa, yangi foydalanuvchi sifatida qayta paydo bo'ladi.)`, { danger: true, confirmText: "O'chirish" });
  if(!ok)return;
  try{
    const r=await fetch(BASE_URL+'/api/admin/delete-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPass,username})});
    const d=await r.json();
    if(r.ok){
      if(selectedMsgUser===username){document.getElementById('msg-composer').classList.add('hidden');selectedMsgUser='';}
      loadPendingUsers();
    }else{
      noorToast(d.error||'O\'chirishda xatolik yuz berdi.');
    }
  }catch(e){noorToast('Server bilan aloqa yo\'q.');}
}

function selectUser(username){
  selectedMsgUser=username;
  document.getElementById('msg-target-label').textContent='@'+username+' ga xabar yuboriladi';
  document.getElementById('msg-username').value=username;
  document.getElementById('msg-composer').classList.remove('hidden');
  document.getElementById('msg-text').value='';
  document.getElementById('msg-code').value='';
  document.getElementById('msg-err').textContent='';
  document.getElementById('msg-ok').textContent='';
  // scroll to composer
  document.getElementById('msg-composer').scrollIntoView({behavior:'smooth'});
}

function setMsgColor(c){
  msgColor=c;
  document.getElementById('color-green').classList.toggle('active-color',c==='green');
  document.getElementById('color-red').classList.toggle('active-color',c==='red');
}

async function sendMsg(){
  const username=document.getElementById('msg-username').value.trim();
  const text=document.getElementById('msg-text').value.trim();
  const code=document.getElementById('msg-code').value.trim();
  const err=document.getElementById('msg-err');
  const ok=document.getElementById('msg-ok');
  err.textContent='';ok.textContent='';
  if(!username||!text){err.textContent='Foydalanuvchi va xabar matnini kiriting.';return;}
  ok.textContent='Yuborilmoqda...';
  try{
    const body={password:adminPass,username,message:text,color:msgColor};
    if(code)body.code=code;
    const r=await fetch(BASE_URL+'/api/admin/send-message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(r.ok){ok.textContent=d.message;err.textContent='';}
    else{err.textContent=d.error;ok.textContent='';}
  }catch(e){err.textContent='Server xatoligi.';}
}

// === ADS ===
async function postAd(){
  const image=document.getElementById('ad-img').value.trim();
  const company=document.getElementById('ad-company').value.trim();
  const link=document.getElementById('ad-link').value.trim();
  const text=document.getElementById('ad-text').value.trim();
  const err=document.getElementById('ad-err');
  const ok=document.getElementById('ad-ok');
  err.textContent='';ok.textContent='';
  if(!image||!company||!text||!link){err.textContent='Barcha maydonlarni to\'ldiring.';return;}
  ok.textContent='Yuborilmoqda...';
  try{
    const r=await fetch(BASE_URL+'/api/ads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,company,link,text,password:adminPass})});
    const d=await r.json();
    if(r.ok){ok.textContent=`Yuborildi! ${d.broadcastCount} ta foydalanuvchiga tarqatildi.`;document.getElementById('ad-img').value='';document.getElementById('ad-company').value='';document.getElementById('ad-link').value='';document.getElementById('ad-text').value='';fetchAds();}
    else{err.textContent=d.error;ok.textContent='';}
  }catch(e){err.textContent='Server xatoligi.';}
}

async function fetchAds(){
  try{
    const r=await fetch(BASE_URL+'/api/ads');
    const d=await r.json();
    const ads=d.ads||[];
    if(ads.length>0){
      document.getElementById('news-floater').style.display='block';
      const c=document.getElementById('ads-container');
      c.innerHTML='';
      [...ads].reverse().forEach(ad=>{
        c.innerHTML+=`<div class="ad-item">${ad.image?`<img src="${ad.image}" class="ad-img" alt="Ad" onerror="this.style.display='none'">`:''}
<a href="${ad.link}" target="_blank" class="ad-company">${ad.company}</a>
<p class="ad-text">${ad.text}</p></div>`;
      });
    }
  }catch(e){}
}

document.getElementById('news-floater').addEventListener('click',()=>document.getElementById('ads-overlay').classList.add('active'));
document.getElementById('close-ads').addEventListener('click',()=>document.getElementById('ads-overlay').classList.remove('active'));

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Chat javobidagi ```kod``` bloklarini topib, "Ishga tushirish" va "Nusxa"
// tugmalari bilan ko'rsatadigan qilib render qiladi (faqat AI javoblari uchun).
let codeBlockCounter = 0;
const codeBlocksStore = {};
const RUNNABLE_LANGS = ['html', 'js', 'javascript', 'css', 'python', 'py'];

function renderAiMessageHTML(text) {
  const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let out = '';
  let lastIndex = 0;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    out += escapeHtml(text.slice(lastIndex, match.index)).replace(/\n/g, '<br>');
    const lang = (match[1] || '').toLowerCase();
    const code = match[2].replace(/\n$/, '');
    const id = 'cb' + (++codeBlockCounter);
    codeBlocksStore[id] = { lang, code };
    const runnable = RUNNABLE_LANGS.includes(lang);
    out += `<div class="code-block-wrap">
      <div class="code-block-header"><span class="code-lang">${escapeHtml(lang || 'code')}</span>
        <span class="code-block-actions">
          <button type="button" class="code-copy-btn" onclick="copyCodeBlock('${id}', this)">📋 Nusxa</button>
          ${runnable ? `<button type="button" class="code-run-btn" onclick="runCodeBlock('${id}')">▶ Ishga tushirish</button>` : ''}
        </span>
      </div>
      <pre class="code-block"><code>${escapeHtml(code)}</code></pre>
      <div class="code-result hidden" id="result-${id}"></div>
    </div>`;
    lastIndex = fenceRegex.lastIndex;
  }
  out += escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
  return out;
}

function copyCodeBlock(id, btnEl) {
  const block = codeBlocksStore[id];
  if (!block) return;
  const done = (ok) => {
    const original = btnEl.textContent;
    btnEl.textContent = ok ? '✅ Nusxalandi' : '⚠️ Xatolik';
    setTimeout(() => { btnEl.textContent = original; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(block.code).then(() => done(true)).catch(() => done(false));
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = block.code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done(true);
    } catch (e) { done(false); }
  }
}

// Pyodide (Python'ni brauzerda WebAssembly orqali ishlatadi) — bepul, backend kerak emas
let pyodideInstance = null;
let pyodideLoadingPromise = null;
function ensurePyodide() {
  if (pyodideInstance) return Promise.resolve(pyodideInstance);
  if (pyodideLoadingPromise) return pyodideLoadingPromise;
  pyodideLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.js';
    script.onload = async () => {
      try {
        pyodideInstance = await loadPyodide();
        resolve(pyodideInstance);
      } catch (e) { reject(e); }
    };
    script.onerror = () => reject(new Error('Pyodide yuklanmadi (internetni tekshiring).'));
    document.head.appendChild(script);
  });
  return pyodideLoadingPromise;
}

async function runCodeBlock(id) {
  const block = codeBlocksStore[id];
  if (!block) return;
  const resultEl = document.getElementById('result-' + id);
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<div class="code-running">⏳ Ishga tushirilmoqda...</div>';

  const lang = block.lang;

  if (lang === 'python' || lang === 'py') {
    try {
      const pyodide = await ensurePyodide();
      let output = '';
      pyodide.setStdout({ batched: (s) => { output += s + '\n'; } });
      pyodide.setStderr({ batched: (s) => { output += s + '\n'; } });
      try {
        await pyodide.runPythonAsync(block.code);
      } catch (runErr) {
        output += '\n❌ ' + runErr.message;
      }
      resultEl.innerHTML = `<div class="code-result-label">Natija:</div><pre class="code-output">${escapeHtml(output || '(chiqish yo\'q)')}</pre>`;
    } catch (loadErr) {
      resultEl.innerHTML = `<div class="code-result-label err">Python muhitini yuklab bo'lmadi: ${escapeHtml(loadErr.message)}</div>`;
    }
    return;
  }

  // HTML / CSS / JS — sandbox qilingan iframe ichida ishga tushiramiz
  let srcdoc;
  if (lang === 'html') {
    srcdoc = block.code;
  } else if (lang === 'css') {
    srcdoc = `<style>${block.code}</style><body style="font-family:sans-serif;color:#ddd;background:#0a0d16;padding:16px;">CSS namunasi qo'llanildi. To'liq ko'rish uchun HTML bilan birga bering.</body>`;
  } else {
    srcdoc = `<html><body style="margin:0;font-family:'JetBrains Mono',monospace;background:#0a0d16;color:#9effa0;padding:14px;white-space:pre-wrap;font-size:13px;" id="out"></body>
<script>
const out = document.getElementById('out');
function log(...a){ out.innerHTML += a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ') + '\\n'; }
console.log = log; console.error = log; console.warn = log; console.info = log;
try { ${block.code} } catch(e) { log('❌ Xatolik: ' + e.message); }
</script></html>`;
  }
  const iframe = document.createElement('iframe');
  iframe.className = 'code-iframe';
  iframe.setAttribute('sandbox', 'allow-scripts');
  resultEl.innerHTML = '<div class="code-result-label">Natija:</div>';
  resultEl.appendChild(iframe);
  iframe.srcdoc = srcdoc;
}

// === AI CHATBOT (FRONTEND) — Noor AI 1.5 / Noor AI 1.0 (Coder) ===
// Endi model tanlash yo'q: server o'zi ishlaydigan bepul modelni tanlaydi.
// Foydalanuvchi rasm tashlasa (drop/tanlasa), Noor AI uni ham "ko'radi" va tushunadi.
let chatHistory = [];
let pendingImage = null; // {dataUrl, name}
let currentChatMode = 'general'; // 'general' (1.5) | 'coder' (1.0) | 'coder2' (2.0) | 'noor25'..'noor60' (Pro) | 'noorimg'

const CHAT_MODE_LABELS = {
  general: 'Noor AI 1.5',
  coder: 'Noor AI 1.0 (Coder)',
  coder2: 'Noor AI 2.0 (Coder)',
  noorimg: 'Noor AI IMG 1.0',
  noorimg15: 'Noor AI IMG 1.5',
  noorvideo10: 'Noor AI Video 1.0',
  noorvideo15: 'Noor AI Video 1.5',
  nooraudio: 'Noor Audio'
};
// Noor AI 2.5 dan 6.0 gacha (0.5 qadam bilan) — serverdagi PRO_TIERS bilan bir xil.
const PRO_TIER_VERSIONS = ['2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0'];
const PRO_TIER_MODES = PRO_TIER_VERSIONS.map(v => 'noor' + v.replace('.', ''));
PRO_TIER_VERSIONS.forEach((v, i) => { CHAT_MODE_LABELS[PRO_TIER_MODES[i]] = 'Noor AI ' + v; });

// Rasm (vision) faqat Noor AI 2.5 dan yuqori Pro versiyalarda ishlaydi.
// Eski uchtasi (1.0 Coder / 1.5 / 2.0 Coder) bepul matn-only modellardan foydalanadi.
const VISION_CAPABLE_MODES = PRO_TIER_MODES;
function modeSupportsVision(mode) { return VISION_CAPABLE_MODES.includes(mode); }

// === Noor AI IMG — "Rasm yaratish" (+ menyusi orqali) ===
function exitGenPanelsToGeneral() {
  // MUHIM: setChatMode('general') chaqirilmaydi — u butun suhbatni (yaratilgan
  // rasm/audiolar bilan birga) tozalab yuboradi. Bu yerda faqat panellarni yopib,
  // rejimni "general"ga qaytaramiz, suhbat tarixiga tegmaymiz.
  document.getElementById('create-img-panel')?.classList.add('hidden');
  document.getElementById('create-audio-panel')?.classList.add('hidden');
  document.getElementById('create-video-panel')?.classList.add('hidden');
  currentChatMode = 'general';
  const selectEl = document.getElementById('chat-model-select');
  if (selectEl) selectEl.value = 'general';
  syncModelPickerUI('general');
  updateAttachAvailability('general');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  const note = document.getElementById('chat-note');
  if (note) note.textContent = t('chat.noteGeneral', "Noor AI 1.5 — bepul, suhbat va kodlash uchun eng yaxshi modelni o'zi avtomatik tanlaydi (matn bilan, rasmni o'qiy olmaydi — rasm uchun Noor AI 2.5/3.0'ni tanlang).");
  const inputEl = document.getElementById('chat-user-input');
  if (inputEl) inputEl.placeholder = '';
}

function enterNoorImgMode(preferredAi) {
  persistActiveSession();
  currentChatMode = 'noorimg';
  document.getElementById('attach-menu')?.classList.add('hidden');
  document.getElementById('create-audio-panel')?.classList.add('hidden');
  document.getElementById('create-video-panel')?.classList.add('hidden');
  document.getElementById('create-img-panel')?.classList.remove('hidden');
  const aiSel = document.getElementById('create-img-ai-select');
  if (aiSel && (preferredAi === 'noorimg' || preferredAi === 'noorimg15')) aiSel.value = preferredAi;
  updateAttachAvailability(currentChatMode);
  syncModelPickerUI(preferredAi === 'noorimg15' ? 'noorimg15' : 'noorimg');
  const note = document.getElementById('chat-note');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (note) note.textContent = t('chat.noteNoorImg', "Noor AI IMG — tepadan AI va o'lchamni tanlang, pastga nima chizish kerakligini yozing va yuboring.");
  const inputEl = document.getElementById('chat-user-input');
  if (inputEl) {
    inputEl.placeholder = t('createImg.placeholder', 'Nima chizish kerakligini yozing...');
    inputEl.focus();
  }
}

function enterNoorAudioMode() {
  persistActiveSession();
  currentChatMode = 'nooraudio';
  document.getElementById('attach-menu')?.classList.add('hidden');
  document.getElementById('create-img-panel')?.classList.add('hidden');
  document.getElementById('create-video-panel')?.classList.add('hidden');
  document.getElementById('create-audio-panel')?.classList.remove('hidden');
  updateAttachAvailability(currentChatMode);
  syncModelPickerUI('nooraudio');
  const note = document.getElementById('chat-note');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (note) note.textContent = t('chat.noteNoorAudio', "Noor Audio — tepadan ovozni tanlang, pastga gapirtirmoqchi bo'lgan matningizni yozing va yuboring.");
  const inputEl = document.getElementById('chat-user-input');
  if (inputEl) {
    inputEl.placeholder = t('noorAudio.placeholder', 'Nima deb gapirtirish kerakligini yozing...');
    inputEl.focus();
  }
}

function enterNoorVideoMode(preferredAi) {
  persistActiveSession();
  currentChatMode = 'noorvideo';
  document.getElementById('attach-menu')?.classList.add('hidden');
  document.getElementById('create-img-panel')?.classList.add('hidden');
  document.getElementById('create-audio-panel')?.classList.add('hidden');
  document.getElementById('create-video-panel')?.classList.remove('hidden');
  const aiSel = document.getElementById('create-video-ai-select');
  if (aiSel && (preferredAi === 'noorvideo10' || preferredAi === 'noorvideo15')) aiSel.value = preferredAi;
  updateAttachAvailability(currentChatMode);
  syncModelPickerUI(preferredAi === 'noorvideo15' ? 'noorvideo15' : 'noorvideo10');
  const note = document.getElementById('chat-note');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (note) note.textContent = t('chat.noteNoorVideo', "Noor AI Video — tepadan AI'ni tanlang, pastga nima video kerakligini yozing va yuboring (yaratish biroz vaqt olishi mumkin).");
  const inputEl = document.getElementById('chat-user-input');
  if (inputEl) {
    inputEl.placeholder = t('noorVideo.placeholder', 'Qanday video kerakligini yozing...');
    inputEl.focus();
  }
}

document.getElementById('attach-item-create')?.addEventListener('click', () => {
  document.getElementById('attach-menu')?.classList.add('hidden');
  enterNoorImgMode();
});
document.getElementById('create-img-close-btn')?.addEventListener('click', exitGenPanelsToGeneral);
document.getElementById('create-audio-close-btn')?.addEventListener('click', exitGenPanelsToGeneral);
document.getElementById('create-video-close-btn')?.addEventListener('click', exitGenPanelsToGeneral);

// === Panda avatar boshqaruvi (Noor Audio ijro etilayotganda pastdan uchib keladi va "gapiradi") ===
let noorAudioPlayer = null;
let pandaHideTimer = null;

function showNoorPanda() {
  clearTimeout(pandaHideTimer);
  const panda = document.getElementById('noor-panda');
  if (!panda) return;
  panda.classList.remove('hidden', 'fly-out');
  panda.classList.add('fly-in');
}

function hideNoorPanda() {
  const panda = document.getElementById('noor-panda');
  if (!panda) return;
  panda.classList.remove('talking', 'fly-in');
  panda.classList.add('fly-out');
  clearTimeout(pandaHideTimer);
  pandaHideTimer = setTimeout(() => {
    panda.classList.add('hidden');
    panda.classList.remove('fly-out');
  }, 500);
}

function setNoorPandaTalking(isTalking) {
  document.getElementById('noor-panda')?.classList.toggle('talking', isTalking);
}

function playNoorAudio(audioUrl, onEnd) {
  if (noorAudioPlayer) {
    noorAudioPlayer.pause();
    noorAudioPlayer = null;
  }
  const audio = new Audio(BASE_URL + audioUrl);
  noorAudioPlayer = audio;
  showNoorPanda();
  setNoorPandaTalking(true);
  audio.addEventListener('ended', () => {
    setNoorPandaTalking(false);
    hideNoorPanda();
    if (onEnd) onEnd();
  });
  audio.addEventListener('error', () => {
    setNoorPandaTalking(false);
    hideNoorPanda();
  });
  audio.play().catch(() => {
    setNoorPandaTalking(false);
    hideNoorPanda();
  });
  return audio;
}

// === MIKROFON (Speech Recognition — Ovozni Matnga aylantirish) ===
let recognition = null;
let isRecordingVoice = false;
let isVoiceSession = false; // foydalanuvchi mikrofonda gapirgan bo'lsa AI ham avtomatik gapiradi

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = 'uz-UZ'; // Standart O'zbek tili
  return rec;
}

function toggleVoiceRecording() {
  const micBtn = document.getElementById('chat-mic-btn');
  const inputEl = document.getElementById('chat-user-input');
  
  if (isRecordingVoice) {
    if (recognition) recognition.stop();
    return;
  }

  recognition = initSpeechRecognition();
  if (!recognition) {
    noorToast("Brauzeringiz ovoz yozishni (Web Speech API) qo'llab-quvvatlamaydi. Chrome/Edge ishlatib ko'ring.");
    return;
  }

  recognition.onstart = () => {
    isRecordingVoice = true;
    micBtn?.classList.add('recording');
    inputEl.placeholder = "Gapiring, eshitayapman...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript) {
      inputEl.value = transcript;
      isVoiceSession = true; // AI javobi ham javoban avtomatik gapirib beradi
      sendChatMsg();
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    noorToast("Ovozni aniqlashda xato: " + event.error);
    stopRecordingUI();
  };

  recognition.onend = () => {
    stopRecordingUI();
  };

  try {
    recognition.start();
  } catch (e) {
    stopRecordingUI();
  }
}

function stopRecordingUI() {
  isRecordingVoice = false;
  const micBtn = document.getElementById('chat-mic-btn');
  const inputEl = document.getElementById('chat-user-input');
  micBtn?.classList.remove('recording');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  inputEl.placeholder = t('chat.inputPh', 'AI ga savol bering yoki rasm tashlang...');
}

// Har qanday AI chat javobini "tinglash" — matnni Noor Audio orqali ovozga aylantiradi.
async function speakText(text, btnEl, modelOverride) {
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (!text) return;
  // HTML teglari va markdown simvollarini tozalaymiz (toza talaffuz uchun)
  const cleanSpeechText = text.replace(/```[\s\S]*?```/g, ' [kod bloki] ').replace(/[#*`_~]/g, '').slice(0, 1500);
  if (btnEl) { btnEl.disabled = true; btnEl.classList.add('speaking'); }
  try {
    const audioModel = modelOverride || (currentChatMode.startsWith('nooraudio') ? currentChatMode : 'nooraudio1');
    const r = await fetch(BASE_URL + '/api/chat/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanSpeechText, voice: 'standard', model: audioModel })
    });
    const d = await r.json();
    if (r.ok) {
      playNoorAudio(d.audioUrl, () => { if (btnEl) { btnEl.disabled = false; btnEl.classList.remove('speaking'); } });
    } else {
      noorToast(d.error || t('noorAudio.error', "Ovoz yaratib bo'lmadi."));
      if (btnEl) { btnEl.disabled = false; btnEl.classList.remove('speaking'); }
    }
  } catch (e) {
    noorToast(t('noorAudio.error', "Ovoz yaratib bo'lmadi."));
    if (btnEl) { btnEl.disabled = false; btnEl.classList.remove('speaking'); }
  }
}

async function sendNoorAudioGenRequest(text) {
  const inputEl = document.getElementById('chat-user-input');
  const container = document.getElementById('chat-msg-container');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (!text) { noorToast(t('noorAudio.placeholder', 'Nima deb gapirtirish kerakligini yozing...')); return; }

  appendChatBubble(text, 'user');
  inputEl.value = '';

  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.id = 'chat-typing-indicator';
  typingIndicator.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  container.appendChild(typingIndicator);
  container.scrollTop = container.scrollHeight;
  inputEl.disabled = true;

  const voiceSel = document.getElementById('audio-voice-select');
  const voice = voiceSel ? voiceSel.value : 'standard';

  try {
    const r = await fetch(BASE_URL + '/api/chat/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, model: currentChatMode })
    });
    const d = await r.json();
    document.getElementById('chat-typing-indicator')?.remove();
    if (r.ok) {
      appendGeneratedAudioBubble(d.audioUrl, text);
      persistActiveSession(text);
    } else {
      appendChatBubble('Xatolik: ' + (d.error || "Ovoz yaratib bo'lmadi."), 'system');
    }
  } catch (e) {
    document.getElementById('chat-typing-indicator')?.remove();
    appendChatBubble('Server bilan ulanishda xatolik yuz berdi.', 'system');
  } finally {
    inputEl.disabled = false;
    inputEl.focus();
  }
}

function appendGeneratedAudioBubble(audioUrl, text) {
  const container = document.getElementById('chat-msg-container');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg ai noor-audio-bubble';
  bubble.innerHTML = `
    <div class="noor-audio-player">
      <button type="button" class="noor-audio-play-btn" title="${t('noorAudio.play', "Ijro etish")}">&#9654;</button>
      <span class="noor-audio-label">${escapeHtml(text.slice(0, 60))}</span>
    </div>
    <div class="noor-img-actions">
      <a class="noor-img-btn" href="${audioUrl}" download>⬇ ${t('createImg.download', 'Yuklab olish')}</a>
    </div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  bubble.querySelector('.noor-audio-play-btn').addEventListener('click', () => playNoorAudio(audioUrl));
}

async function sendNoorVideoGenRequest(prompt) {
  const inputEl = document.getElementById('chat-user-input');
  const container = document.getElementById('chat-msg-container');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (!prompt) { noorToast(t('noorVideo.placeholder', 'Qanday video kerakligini yozing...')); return; }

  appendChatBubble(prompt, 'user');
  inputEl.value = '';

  // Collect Studio settings
  const aiSel = document.getElementById('create-video-ai-select');
  const ai = aiSel ? aiSel.value : 'noorvideo10';
  const durActive = document.querySelector('#video-duration-pills .video-pill.active');
  const ratioActive = document.querySelector('#video-ratio-pills .video-pill.active');
  const duration = durActive ? durActive.dataset.value : '5';
  const aspectRatio = ratioActive ? ratioActive.dataset.value : '16:9';
  const fps = (document.getElementById('video-fps-select') || {}).value || '30';
  const style = (document.getElementById('video-style-select') || {}).value || 'cinematic';
  const cameraMovement = (document.getElementById('video-camera-select') || {}).value || 'pan';
  const negativePrompt = (document.getElementById('video-negative-prompt') || {}).value || '';

  inputEl.disabled = true;

  // Create a progress bubble in chat
  const progressBubble = document.createElement('div');
  progressBubble.className = 'chat-msg ai';
  progressBubble.id = 'video-progress-bubble';
  progressBubble.innerHTML = `
    <div class="video-progress-card">
      <div class="video-progress-text">
        <span>🎬</span>
        <span id="video-status-text">Preparing scene parameters...</span>
      </div>
      <div class="video-progress-bar-bg">
        <div class="video-progress-bar-fill" id="video-progress-fill" style="width:10%"></div>
      </div>
    </div>`;
  container.appendChild(progressBubble);
  container.scrollTop = container.scrollHeight;

  const STAGES = {
    preparing: '🎯 Preparing video parameters & scene structure...',
    planning:  '🧠 AI is planning camera movement & visual motion script...',
    rendering: '🖼️ Generating visual frames & rendering composition...',
    encoding:  '🎞️ Encoding high quality video stream...',
    ready:     '✅ Video ready!'
  };

  let jobId = null;
  let pollInterval = null;

  function updateProgress(job) {
    const fillEl = document.getElementById('video-progress-fill');
    const textEl = document.getElementById('video-status-text');
    if (fillEl) fillEl.style.width = Math.max(job.progress || 0, 5) + '%';
    if (textEl) textEl.textContent = STAGES[job.stage] || job.statusText || 'Processing...';
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function onVideoReady(job) {
    stopPolling();
    const bubble = document.getElementById('video-progress-bubble');
    if (bubble) bubble.remove();
    appendGeneratedVideoBubble(job.videoUrl, job.shareUrl, prompt, duration, aspectRatio);
    persistActiveSession(prompt);
    loadVideoHistory();
    inputEl.disabled = false;
    inputEl.focus();
  }

  function onVideoError(errMsg) {
    stopPolling();
    const bubble = document.getElementById('video-progress-bubble');
    if (bubble) bubble.remove();
    appendChatBubble(`❌ Video yaratishda xatolik: ${errMsg || "Noma'lum xato"}. Qayta urining.`, 'system');
    inputEl.disabled = false;
    inputEl.focus();
  }

  try {
    const r = await fetch(BASE_URL + '/api/chat/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ai, duration, aspectRatio, fps, style, cameraMovement, negativePrompt })
    });
    const d = await r.json();

    if (!r.ok) { onVideoError(d.error || "Video yaratib bo'lmadi."); return; }

    // If server returned completed immediately
    if (d.status === 'completed') { onVideoReady(d.job || d); return; }

    jobId = d.id;

    // Start status polling
    pollInterval = setInterval(async () => {
      try {
        const sr = await fetch(BASE_URL + '/api/chat/video-status/' + jobId);
        const sj = await sr.json();
        updateProgress(sj);
        if (sj.status === 'completed') { onVideoReady(sj); }
        else if (sj.status === 'failed') { onVideoError(sj.error || sj.statusText); }
      } catch (pe) {
        console.warn('[Noor Video] Status poll error:', pe);
      }
    }, 1200);

    // Safety timeout — 5 minutes
    setTimeout(() => {
      if (pollInterval) {
        stopPolling();
        onVideoError("Video yaratish juda ko'p vaqt oldi. Qayta urinib ko'ring.");
      }
    }, 5 * 60 * 1000);

  } catch (e) {
    document.getElementById('video-progress-bubble')?.remove();
    appendChatBubble('Server bilan ulanishda xatolik yuz berdi.', 'system');
    inputEl.disabled = false;
    inputEl.focus();
  }
}

function appendGeneratedVideoBubble(videoUrl, shareUrl, prompt, duration, aspectRatio) {
  const container = document.getElementById('chat-msg-container');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg ai';
  const fullShareUrl = window.location.origin + (shareUrl || '');
  const metaText = [duration ? `${duration}s` : '', aspectRatio || ''].filter(Boolean).join(' · ');
  const mediaTag = /\.gif(?:$|\?)/i.test(videoUrl || '')
    ? `<img src="${videoUrl}" class="noor-video-player-el" alt="Noor AI animated video">`
    : `<video src="${videoUrl}" class="noor-video-player-el" controls autoplay loop playsinline></video>`;
  bubble.innerHTML = `
    <div class="noor-video-card">
      ${mediaTag}
      <div class="noor-video-card-meta">
        <div class="noor-video-prompt-text">🎬 ${escapeHtml((prompt || '').slice(0, 80))}${metaText ? ` <span style="opacity:.55;font-size:.7rem;">(${metaText})</span>` : ''}</div>
        <a class="noor-video-download-btn" href="${videoUrl}" download>⬇ ${t('createImg.download', 'Yuklab olish')}</a>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="noor-img-btn noor-img-share-btn" style="font-size:.72rem;">🔗 ${t('createImg.share', 'Ulashish')}</button>
      </div>
      <div class="noor-img-share-box hidden">
        <input type="text" readonly value="${fullShareUrl}">
        <button type="button" class="noor-img-copy-btn">${t('createImg.copy', 'Nusxalash')}</button>
      </div>
    </div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  const shareBtn = bubble.querySelector('.noor-img-share-btn');
  const shareBox = bubble.querySelector('.noor-img-share-box');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    shareBox.classList.toggle('hidden');
    container.scrollTop = container.scrollHeight;
  });
  const copyBtn = bubble.querySelector('.noor-img-copy-btn');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const inp = shareBox.querySelector('input');
    if (!inp) return;
    inp.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inp.value)
        .then(() => noorToast(t('createImg.copied', 'Havola nusxalandi!')))
        .catch(() => { document.execCommand('copy'); noorToast(t('createImg.copied', 'Havola nusxalandi!')); });
    } else {
      document.execCommand('copy');
      noorToast(t('createImg.copied', 'Havola nusxalandi!'));
    }
  });
}

// === VIDEO DURATION & ASPECT RATIO PILL SELECTORS ===
(function initVideoPills() {
  ['video-duration-pills', 'video-ratio-pills'].forEach(groupId => {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.addEventListener('click', e => {
      const pill = e.target.closest('.video-pill');
      if (!pill) return;
      group.querySelectorAll('.video-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
})();

// === VIDEO HISTORY PANEL ===
document.getElementById('btn-video-history-toggle')?.addEventListener('click', () => {
  const panel = document.getElementById('video-history-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) loadVideoHistory();
});

async function loadVideoHistory() {
  const listEl = document.getElementById('video-history-list');
  if (!listEl) return;
  try {
    const r = await fetch(BASE_URL + '/api/chat/video-history');
    if (!r.ok) return;
    const d = await r.json();
    const history = d.history || [];
    if (!history.length) {
      listEl.innerHTML = '<div class="video-history-empty" style="font-size:.72rem;color:var(--td);padding:8px 0;">Hali hech qanday video yaratilmagan.</div>';
      return;
    }
    listEl.innerHTML = history.map(item => {
      const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
      const shortPrompt = (item.prompt || '').slice(0, 50);
      return `<div class="video-history-item" style="color:var(--t);">
        <div style="flex:1;overflow:hidden;">
          <div style="font-size:.73rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(shortPrompt)}</div>
          <div style="font-size:.68rem;color:var(--td);">${date} · ${item.duration || '5'}s · ${item.aspectRatio || '16:9'}</div>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
          <a href="${item.videoUrl}" download style="background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.3);color:var(--c);padding:4px 10px;border-radius:8px;font-size:.68rem;text-decoration:none;white-space:nowrap;">⬇ Yuklab</a>
          <button type="button" class="video-history-delete" data-video-id="${escapeHtml(item.id)}" title="Tarixdan o'chirish" style="background:rgba(231,76,60,.12);border:1px solid rgba(231,76,60,.3);color:#ff8a80;padding:4px 8px;border-radius:8px;font-size:.68rem;cursor:pointer;white-space:nowrap;">O'chirish</button>
        </div>
      </div>`;
    }).join('');
    listEl.querySelectorAll('.video-history-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteVideoHistory(btn.dataset.videoId));
    });
  } catch (e) {
    listEl.innerHTML = '<div style="font-size:.72rem;color:var(--td);">Tarix yuklanmadi.</div>';
  }
}

async function deleteVideoHistory(id) {
  const ok = await noorConfirm('Ushbu videoni tarixdan o\'chirishga ishonchingiz komilmi?', { danger: true, confirmText: "O'chirish" });
  if (!ok) return;
  try {
    const r = await fetch(BASE_URL + '/api/chat/video-history/' + encodeURIComponent(id), { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Video o\'chirilmadi.');
    noorToast('Video tarixdan o\'chirildi.');
    loadVideoHistory();
  } catch (e) {
    noorToast(e.message || 'Video o\'chirilmadi.');
  }
}

async function sendNoorImgGenRequest(prompt) {
  const inputEl = document.getElementById('chat-user-input');
  const container = document.getElementById('chat-msg-container');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  if (!prompt) { noorToast(t('createImg.placeholder', 'Nima chizish kerakligini yozing...')); return; }

  appendChatBubble(prompt, 'user');
  inputEl.value = '';

  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.id = 'chat-typing-indicator';
  typingIndicator.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  container.appendChild(typingIndicator);
  container.scrollTop = container.scrollHeight;
  inputEl.disabled = true;

  const sizeSel = document.getElementById('create-img-size-select');
  const size = sizeSel ? sizeSel.value : 'square';
  const aiSel = document.getElementById('create-img-ai-select');
  const ai = aiSel ? aiSel.value : 'noorimg';

  try {
    const r = await fetch(BASE_URL + '/api/chat/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size, ai })
    });
    const d = await r.json();
    document.getElementById('chat-typing-indicator')?.remove();
    if (r.ok) {
      appendGeneratedImageBubble(d.imageUrl, d.shareUrl, prompt);
      persistActiveSession(prompt);
    } else {
      appendChatBubble('Xatolik: ' + (d.error || "Rasm yaratib bo'lmadi."), 'system');
    }
  } catch (e) {
    document.getElementById('chat-typing-indicator')?.remove();
    appendChatBubble('Server bilan ulanishda xatolik yuz berdi.', 'system');
  } finally {
    inputEl.disabled = false;
    inputEl.focus();
  }
}

function appendGeneratedImageBubble(imageUrl, shareUrl, prompt) {
  const container = document.getElementById('chat-msg-container');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg ai noor-img-bubble';
  const fullShareUrl = window.location.origin + shareUrl;
  bubble.innerHTML = `
    <img src="${imageUrl}" class="chat-generated-media" alt="${escapeHtml(prompt)}">
    <div class="noor-img-actions">
      <a class="noor-img-btn" href="${imageUrl}" download>⬇ ${t('createImg.download', 'Yuklab olish')}</a>
      <button type="button" class="noor-img-btn noor-img-share-btn">🔗 ${t('createImg.share', 'Ulashish')}</button>
    </div>
    <div class="noor-img-share-box hidden">
      <input type="text" readonly value="${fullShareUrl}">
      <button type="button" class="noor-img-copy-btn">${t('createImg.copy', 'Nusxalash')}</button>
    </div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  const shareBtn = bubble.querySelector('.noor-img-share-btn');
  const shareBox = bubble.querySelector('.noor-img-share-box');
  shareBtn.addEventListener('click', () => {
    shareBox.classList.toggle('hidden');
    container.scrollTop = container.scrollHeight;
  });
  bubble.querySelector('.noor-img-copy-btn').addEventListener('click', () => {
    const inp = bubble.querySelector('.noor-img-share-box input');
    inp.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inp.value)
        .then(() => noorToast(t('createImg.copied', 'Havola nusxalandi!')))
        .catch(() => { document.execCommand('copy'); noorToast(t('createImg.copied', 'Havola nusxalandi!')); });
    } else {
      document.execCommand('copy');
      noorToast(t('createImg.copied', 'Havola nusxalandi!'));
    }
  });
}

// Rasm biriktirish tugmalarini joriy rejimga qarab yoqadi/o'chiradi.
function updateAttachAvailability(mode) {
  const canVision = modeSupportsVision(mode);
  const visionIds = ['attach-item-image', 'attach-item-camera', 'attach-item-screenshot'];
  visionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !canVision;
    el.classList.toggle('disabled', !canVision);
  });
  const note = document.getElementById('attach-menu-vision-note');
  if (note) note.classList.toggle('hidden', canVision);
  if (!canVision) clearPendingChatImage();
}

function mediaKindOf(mode) {
  if (mode && mode.startsWith('noor-image-')) return 'image';
  if (mode && mode.startsWith('noor-video-')) return 'video';
  if (mode && mode.startsWith('noor-audio-')) return 'audio';
  return null;
}

function modeDisplayLabel(mode) {
  if (CHAT_MODE_LABELS[mode]) return CHAT_MODE_LABELS[mode];
  const menu = document.getElementById('model-picker-menu');
  const item = menu && menu.querySelector(`.model-picker-item[data-value="${mode}"]`);
  if (item) return item.dataset.label || item.textContent.trim();
  return mode;
}

function setChatMode(mode) {
  if (mode === currentChatMode) return;
  persistActiveSession();
  currentChatMode = mode;
  document.getElementById('create-img-panel')?.classList.add('hidden');
  document.getElementById('chat-model-select').value = mode;
  syncModelPickerUI(mode);
  const note = document.getElementById('chat-note');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  const kind = mediaKindOf(mode);
  if (mode === 'usebrowser') {
    note.textContent = "🌐 Noor Browser Agent (Computer Use) — laptopingizdagi brauzer topshiriqlarini va veb-harakatlarni avtomatlashtirib beradi.";
  } else if (mode === 'coder') {
    note.textContent = t('chat.noteCoder', "Noor AI 1.0 (Coder) — faqat kodlash uchun ixtisoslashgan (matn bilan, rasmni o'qiy olmaydi).");
  } else if (mode === 'coder2') {
    note.textContent = t('chat.noteCoder2', "Noor AI 2.0 (Coder) — bepul, kodlashga ixtisoslashgan (matn bilan, rasmni o'qiy olmaydi — rasm uchun Noor AI 2.5/3.0'ni tanlang).");
  } else if (PRO_TIER_MODES.includes(mode)) {
    const versionLabel = (CHAT_MODE_LABELS[mode] || 'Noor AI').replace('Noor AI ', '');
    note.textContent = t('chat.noteProTier', "Noor AI {v} — suhbat, kodlash va rasm/skrinshotni tushunish (vision) bo'yicha kuchli Pro model. Rasm tashlang yoki yuklang — u ko'radi va tushunadi.").replace('{v}', versionLabel);
  } else if (kind === 'image') {
    note.textContent = t('chat.noteImage', "Pastga nima chizish kerakligini yozing, sizga rasm yaratib beradi.");
  } else if (kind === 'video') {
    note.textContent = t('chat.noteVideo', "Pastga video mavzusini yozing, qisqa video yaratib beradi (biroz vaqt olishi mumkin).");
  } else if (kind === 'audio') {
    note.textContent = t('chat.noteAudio', "Pastga musiqa/audio mavzusini yozing, audio yaratib beradi.");
  } else {
    note.textContent = t('chat.noteGeneral', "Noor AI 1.5 — bepul, suhbat va kodlash uchun eng yaxshi modelni o'zi avtomatik tanlaydi (matn bilan, rasmni o'qiy olmaydi — rasm uchun Noor AI 2.5/3.0'ni tanlang).");
  }
  updateAttachAvailability(mode);
  chatHistory = [];
  const container = document.getElementById('chat-msg-container');
  container.innerHTML = '';
  closeCodePanel();
  appendChatBubble(`${modeDisplayLabel(mode)} rejimiga o'tdingiz. Nima bilan yordam bera olaman?`, 'system');
  persistActiveSession();
}

function renderCodePanel(blocks) {
  const panel = document.getElementById('chat-code-panel');
  const body = document.getElementById('code-panel-body');
  body.innerHTML = '';
  blocks.forEach(b => {
    const id = 'cb' + (++codeBlockCounter);
    codeBlocksStore[id] = b;
    const runnable = RUNNABLE_LANGS.includes(b.lang);
    const block = document.createElement('div');
    block.className = 'code-block-wrap';
    block.innerHTML = `<div class="code-block-header"><span class="code-lang">${escapeHtml(b.lang || 'code')}</span>
      <span class="code-block-actions">
        <button type="button" class="code-copy-btn" onclick="copyCodeBlock('${id}', this)">Nusxa</button>
        ${runnable ? `<button type="button" class="code-run-btn" onclick="runCodeBlock('${id}')">Ishga tushirish</button>` : ''}
      </span></div>
      <pre class="code-block"><code>${escapeHtml(b.code)}</code></pre>
      <div class="code-result hidden" id="result-${id}"></div>`;
    body.appendChild(block);
  });
  panel.classList.remove('hidden');
}

function displayAiReply(text, skipListenBtn = false) {
  if (currentChatMode === 'coder2') {
    const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let match, plain = '', lastIndex = 0;
    const blocks = [];
    while ((match = fenceRegex.exec(text)) !== null) {
      plain += text.slice(lastIndex, match.index);
      blocks.push({ lang: (match[1] || '').toLowerCase(), code: match[2].replace(/\n$/, '') });
      lastIndex = fenceRegex.lastIndex;
    }
    plain += text.slice(lastIndex);
    appendTypewriterBubble(plain.trim() || "Kodni o'ng paneldan ko'ring →", 'ai-plain', skipListenBtn, () => {
      if (blocks.length) renderCodePanel(blocks);
    });
  } else {
    appendTypewriterBubble(text, 'ai', skipListenBtn);
  }
}

function appendTypewriterBubble(fullText, sender, skipListenBtn = false, onComplete = null) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender === 'ai-plain' ? 'ai' : sender} typing-active`;
  container.appendChild(bubble);

  let currentIndex = 0;
  const totalLength = fullText.length;
  // Matn hajmiga qarab o'ta tez yozish (tez va chaqqon)
  const chunkSize = totalLength > 1500 ? 24 : (totalLength > 500 ? 14 : 6);
  const intervalTime = 6;

  const timer = setInterval(() => {
    currentIndex += chunkSize;
    if (currentIndex >= totalLength) {
      currentIndex = totalLength;
      clearInterval(timer);
      
      const currentText = fullText.slice(0, currentIndex);
      bubble.innerHTML = (sender === 'ai') ? renderAiMessageHTML(currentText) : escapeHtml(currentText).replace(/\n/g, '<br>');
      bubble.classList.remove('typing-active');

      if ((sender === 'ai' || sender === 'ai-plain') && !skipListenBtn) {
        const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
        const speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'chat-msg-speak-btn';
        speakBtn.innerHTML = `🔊 ${t('noorAudio.listen', 'Tinglash')}`;
        speakBtn.addEventListener('click', () => speakText(fullText, speakBtn));
        bubble.appendChild(speakBtn);
      }
      container.scrollTop = container.scrollHeight;
      if (onComplete) onComplete();
    } else {
      const currentText = fullText.slice(0, currentIndex);
      bubble.innerHTML = (sender === 'ai') ? renderAiMessageHTML(currentText) : escapeHtml(currentText).replace(/\n/g, '<br>');
      container.scrollTop = container.scrollHeight;
    }
  }, intervalTime);

  return bubble;
}

function appendChatBubble(text, sender, skipListenBtn = false) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender === 'ai-plain' ? 'ai' : sender}`;
  bubble.innerHTML = (sender === 'ai') ? renderAiMessageHTML(text) : escapeHtml(text).replace(/\n/g, '<br>');
  if ((sender === 'ai' || sender === 'ai-plain') && !skipListenBtn) {
    const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'chat-msg-speak-btn';
    speakBtn.innerHTML = `🔊 ${t('noorAudio.listen', 'Tinglash')}`;
    speakBtn.addEventListener('click', () => speakText(text, speakBtn));
    bubble.appendChild(speakBtn);
  }
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function appendChatImage(dataUrl) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg user';
  bubble.innerHTML = `<img src="${dataUrl}" class="chat-attached-img" alt="Yuklangan rasm">`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendChatMedia(url, kind) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg ai';
  if (kind === 'video') {
    bubble.innerHTML = `<video src="${url}" class="chat-generated-media" controls autoplay loop muted playsinline></video>`;
  } else if (kind === 'audio') {
    bubble.innerHTML = `<audio src="${url}" class="chat-generated-audio" controls autoplay></audio>`;
  } else {
    bubble.innerHTML = `<img src="${url}" class="chat-generated-media" alt="Yaratilgan rasm">`;
  }
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleChatImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const dataUrl = await fileToDataUrl(file);
    pendingImage = { dataUrl, name: file.name };
    const preview = document.getElementById('chat-attach-preview');
    preview.innerHTML = `<img src="${dataUrl}" alt="preview"><button type="button" id="chat-attach-remove" title="Olib tashlash">&times;</button>`;
    preview.classList.remove('hidden');
    document.getElementById('chat-attach-remove').addEventListener('click', clearPendingChatImage);
  } catch (e) {
    console.error('Rasmni o\'qib bo\'lmadi:', e);
  }
}

function clearPendingChatImage() {
  pendingImage = null;
  const preview = document.getElementById('chat-attach-preview');
  preview.innerHTML = '';
  preview.classList.add('hidden');
}

async function sendMediaGenRequest(prompt) {
  const inputEl = document.getElementById('chat-user-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const container = document.getElementById('chat-msg-container');
  if (!prompt) return;

  appendChatBubble(prompt, 'user');
  inputEl.value = '';

  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.id = 'chat-typing-indicator';
  typingIndicator.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  container.appendChild(typingIndicator);
  container.scrollTop = container.scrollHeight;
  inputEl.disabled = true;
  sendBtn.disabled = true;

  const kind = mediaKindOf(currentChatMode); // 'image' | 'video' | 'audio'
  const endpoint = kind === 'video' ? '/api/generate/video' : (kind === 'audio' ? '/api/generate/audio' : '/api/generate/image');

  try {
    const r = await fetch(BASE_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelId: currentChatMode })
    });
    const d = await r.json();
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
    const mediaUrl = d.image || d.video || d.audio;
    if (r.ok && mediaUrl) {
      appendChatMedia(mediaUrl, kind || 'image');
      persistActiveSession(prompt);
    } else {
      appendChatBubble('Xatolik: ' + (d.error || 'Yaratib bo\'lmadi.'), 'system');
    }
  } catch (e) {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
    appendChatBubble('Server bilan ulanishda xatolik yuz berdi.', 'system');
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
    container.scrollTop = container.scrollHeight;
  }
}

async function sendChatMsg() {
  const inputEl = document.getElementById('chat-user-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const container = document.getElementById('chat-msg-container');

  const text = inputEl.value.trim();
  if (!text && !pendingImage) return;

  if (currentChatMode === 'noorimg') {
    await sendNoorImgGenRequest(text);
    return;
  }

  if (currentChatMode.startsWith('nooraudio')) {
    await sendNoorAudioGenRequest(text);
    return;
  }

  if (currentChatMode === 'noorvideo') {
    await sendNoorVideoGenRequest(text);
    return;
  }

  if (mediaKindOf(currentChatMode)) {
    await sendMediaGenRequest(text);
    return;
  }

  // Noor AI 2.5-6.0 — hozircha faqat Pro foydalanuvchilar va Admin uchun.
  if (PRO_TIER_MODES.includes(currentChatMode) && !isProUser()) {
    const modeLabel = CHAT_MODE_LABELS[currentChatMode] || 'Noor AI Pro';
    if (text) appendChatBubble(text, 'user');
    inputEl.value = '';
    appendChatBubble(`${modeLabel} — bu Noor AI Pro imkoniyati. Undan foydalanish uchun Noor AI ning Pro versiyasini sotib olishingiz kerak. Hozircha Noor AI 1.0, 1.5 yoki 2.0 (Coder) bepul va ochiq.`, 'ai');
    return;
  }

  // Append user message (rasm bo'lsa alohida ko'rsatamiz)
  if (pendingImage) appendChatImage(pendingImage.dataUrl);
  if (text) appendChatBubble(text, 'user');

  // API ga yuboriladigan xabar: rasm bo'lsa, matn + rasm birgalikda (vision)
  let userContent;
  if (pendingImage) {
    userContent = [
      { type: 'text', text: text || 'Ushbu rasmda nima ko\'rinyapti, tushuntirib ber.' },
      { type: 'image_url', image_url: { url: pendingImage.dataUrl } }
    ];
  } else {
    userContent = text;
  }
  chatHistory.push({ role: 'user', content: userContent });

  inputEl.value = '';
  clearPendingChatImage();

  // Add Typing Indicator (3 ta nuqtacha)
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.id = 'chat-typing-indicator';
  typingIndicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  container.appendChild(typingIndicator);
  container.scrollTop = container.scrollHeight;

  // Disable input & send button
  inputEl.disabled = true;
  sendBtn.disabled = true;

  try {
    const r = await fetch(BASE_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, mode: currentChatMode, username: currentUser, password: isAdmin ? adminPass : '' })
    });
    const d = await r.json();

    // Remove Typing Indicator
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();

    if (r.ok) {
      const aiReply = d.choices[0].message.content;
      const autoSpeak = isVoiceSession;
      displayAiReply(aiReply, autoSpeak); // Microfon ishlatilsa "Tinglash" tugmasi bo'lmaydi
      chatHistory.push({ role: 'assistant', content: aiReply });
      persistActiveSession(text || 'Rasm bilan suhbat');
      if (autoSpeak) {
        speakText(aiReply);
        isVoiceSession = false;
      }
    } else {
      appendChatBubble('Xatolik: ' + (d.error || 'Ulanib bo\'lmadi.'), 'system');
    }
  } catch (e) {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
    appendChatBubble('Server bilan ulanishda xatolik yuz berdi.', 'system');
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
    container.scrollTop = container.scrollHeight;
  }
}

// Add enter key listener for chat input
document.getElementById('chat-user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendChatMsg();
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadMediaModelOptions() {
  const group = document.getElementById('model-picker-media-group');
  const select = document.getElementById('chat-model-select');
  if (!group) return;
  try {
    const r = await fetch(BASE_URL + '/api/generate/models');
    const d = await r.json();
    const sections = [
      { list: d.image || [], tagClass: 'model-picker-tag-img', tagText: 'RASM' },
      { list: d.video || [], tagClass: 'model-picker-tag-vid', tagText: 'VIDEO' },
      { list: d.audio || [], tagClass: 'model-picker-tag-audio', tagText: 'AUDIO' }
    ];
    let html = '';
    sections.forEach((sec) => {
      sec.list.forEach((m) => {
        html += `<button type="button" class="model-picker-item" data-value="${escapeHtml(m.id)}" data-label="${escapeHtml(m.label)}"><span class="mp-label">${escapeHtml(m.label)}</span><span class="mp-right"><span class="model-picker-tag ${sec.tagClass}">${sec.tagText}</span></span></button>`;
        if (select && !select.querySelector(`option[value="${m.id}"]`)) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.label;
          select.appendChild(opt);
        }
      });
    });
    group.innerHTML = html;
  } catch (e) {
    console.warn('Media model ro\'yxatini olib bo\'lmadi:', e);
  }
}

// "+" biriktirish menyusi: rasm yuklash, kameraga tushirish, skrinshot — ishlaydi.
// Fayl yuklash va rasm yaratish hozircha o'chirilgan (keyingi Noor 2.5/rasm integratsiyasi uchun).
// === MODEL PICKER (chat-model-select o'rniga sayt uslubidagi maxsus dropdown) ===
// Haqiqiy <select id="chat-model-select"> DOM'da yashirin holda qoladi — eski kod (.value
// o'qish/yozish) buzilmasligi uchun. Ko'rinadigan qism esa quyidagi tugma + menyu.
// Bo'limlar (Noor-Image/Video/Audio) dinamik — serverdan Bytez'ning HAQIQIY, hozir ishlaydigan
// katalogi asosida yuklanadi (loadMediaModelOptions), shuning uchun bu yerda click uchun
// event delegation ishlatiladi — keyin qo'shiladigan tugmalar ham avtomatik ishlaydi.
function syncModelPickerUI(mode) {
  const menu = document.getElementById('model-picker-menu');
  const label = document.getElementById('model-picker-label');
  if (!menu || !label) return;
  const items = menu.querySelectorAll('.model-picker-item');
  let matched = null;
  items.forEach((it) => {
    const active = it.dataset.value === mode;
    it.classList.toggle('active', active);
    if (active) matched = it;
    // PRO tag: Pro foydalanuvchi/Admin bo'lsa "PRO" ko'rinadi, boshqalarga "🔒"
    const tag = it.querySelector('.model-picker-tag-pro');
    if (tag) tag.textContent = isProUser() ? 'PRO' : '🔒';
  });
  if (matched) label.textContent = matched.dataset.label || matched.textContent.trim();
}
(function initModelPicker() {
  const btn = document.getElementById('model-picker-btn');
  const menu = document.getElementById('model-picker-menu');
  if (!btn || !menu) return;
  const closeMenu = () => { menu.classList.add('hidden'); btn.classList.remove('open'); };
  const openMenu = () => { menu.classList.remove('hidden'); btn.classList.add('open'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('hidden') ? openMenu() : closeMenu();
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.model-picker-item');
    if (!item) return;
    e.stopPropagation();
    if (item.disabled || item.classList.contains('is-disabled')) return; // ishlamaydigan variantlar bosilmaydi
    if (item.dataset.value === 'noorimg' || item.dataset.value === 'noorimg15') {
      enterNoorImgMode(item.dataset.value);
      closeMenu();
      return;
    }
    if (item.dataset.value === 'noorvideo10' || item.dataset.value === 'noorvideo15') {
      enterNoorVideoMode(item.dataset.value);
      closeMenu();
      return;
    }
    if (item.dataset.value === 'nooraudio') {
      enterNoorAudioMode();
      closeMenu();
      return;
    }
    setChatMode(item.dataset.value);
    closeMenu();
  });
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      closeMenu();
    }
  });
  syncModelPickerUI(currentChatMode);
  updateAttachAvailability(currentChatMode);
  loadMediaModelOptions().then(() => syncModelPickerUI(currentChatMode));
})();

const attachPlusBtn = document.getElementById('chat-attach-btn');
const attachMenu = document.getElementById('attach-menu');
const chatAttachInput = document.getElementById('chat-attach-input');
const chatCameraInput = document.getElementById('chat-camera-input');

if (attachPlusBtn && attachMenu) {
  attachPlusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    attachMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!attachMenu.classList.contains('hidden') && !attachMenu.contains(e.target) && e.target !== attachPlusBtn) {
      attachMenu.classList.add('hidden');
    }
  });
}
document.getElementById('attach-item-image')?.addEventListener('click', () => { attachMenu.classList.add('hidden'); chatAttachInput.click(); });
document.getElementById('attach-item-camera')?.addEventListener('click', () => { attachMenu.classList.add('hidden'); chatCameraInput.click(); });
document.getElementById('attach-item-screenshot')?.addEventListener('click', async () => {
  attachMenu.classList.add('hidden');
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    const capture = new ImageCapture(track);
    const bitmap = await capture.grabFrame();
    track.stop();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    pendingImage = { dataUrl, name: 'screenshot.png' };
    const preview = document.getElementById('chat-attach-preview');
    preview.innerHTML = `<img src="${dataUrl}" alt="preview"><button type="button" id="chat-attach-remove" title="Olib tashlash">&times;</button>`;
    preview.classList.remove('hidden');
    document.getElementById('chat-attach-remove').addEventListener('click', clearPendingChatImage);
  } catch (e) {
    console.error('Skrinshot olishda xatolik:', e);
  }
});
if (chatAttachInput) {
  chatAttachInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleChatImageFile(e.target.files[0]);
    e.target.value = '';
  });
}
if (chatCameraInput) {
  chatCameraInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleChatImageFile(e.target.files[0]);
    e.target.value = '';
  });
}
const chatMsgContainer = document.getElementById('chat-msg-container');
if (chatMsgContainer) {
  ['dragover'].forEach(evt => chatMsgContainer.addEventListener(evt, (e) => { e.preventDefault(); chatMsgContainer.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt => chatMsgContainer.addEventListener(evt, (e) => { e.preventDefault(); chatMsgContainer.classList.remove('drag-over'); }));
  chatMsgContainer.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleChatImageFile(file);
  });
}

// === WINDOWS DESKTOP APP (PWA & Service Worker) BOSHGARUVI ===
let deferredPwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btns = document.querySelectorAll('.download-win-btn, .download-win-main-btn');
  btns.forEach(btn => btn.classList.add('ready-to-install'));
});

async function installWindowsApp() {
  // Professional download modal ochamiz (ChatGPT/Claude uslubida)
  showDownloadModal();

  try {
    // Download progress kuzatish
    const response = await fetch('/download/installer');
    if (!response.ok) throw new Error('Installer yuklanmadi.');

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) {
        const percent = Math.round((received / total) * 100);
        updateDownloadProgress(percent, received, total);
      }
    }

    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'NoorAI-Setup.exe';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    finishDownload('NoorAI-Setup.exe muvaffaqiyatli yuklandi!');

  } catch (e) {
    finishDownload(e.message || 'Installer yuklanmadi.', true);
  }

  if (deferredPwaPrompt) {
    try {
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice;
      deferredPwaPrompt = null;
    } catch(e) {}
  }
}

function showDownloadModal() {
  let modal = document.getElementById('download-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'download-modal';
    modal.className = 'overlay active';
    modal.innerHTML = `
      <div class="glass ad-modal download-modal">
        <button class="close-modal" onclick="closeDownloadModal()">&times;</button>
        <div class="download-icon">⬇️</div>
        <h2 style="font-family:var(--dp);margin:0 0 8px;">Noor AI yuklanmoqda...</h2>
        <p style="color:var(--td);margin:0 0 24px;font-size:.9rem;" id="download-status">Tayyorlanmoqda...</p>
        <div class="download-progress">
          <div class="download-progress-bar" id="download-bar"></div>
        </div>
        <div class="download-percent" id="download-percent">0%</div>
        <div class="download-info" id="download-info" style="color:var(--td);font-size:.8rem;margin-top:12px;"></div>
        <button class="btn ghost sm" style="margin-top:16px;" onclick="closeDownloadModal()">Yashirish</button>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.classList.add('active');
    document.getElementById('download-status').textContent = 'Tayyorlanmoqda...';
    document.getElementById('download-bar').style.width = '0%';
    document.getElementById('download-percent').textContent = '0%';
    document.getElementById('download-info').textContent = '';
  }
}

function updateDownloadProgress(percent, received, total) {
  const bar = document.getElementById('download-bar');
  const pct = document.getElementById('download-percent');
  const status = document.getElementById('download-status');
  const info = document.getElementById('download-info');
  if (bar) bar.style.width = percent + '%';
  if (pct) pct.textContent = percent + '%';
  if (status) status.textContent = 'Yuklanmoqda...';
  if (info && total) {
    const mbReceived = (received / 1024 / 1024).toFixed(2);
    const mbTotal = (total / 1024 / 1024).toFixed(2);
    info.textContent = mbReceived + ' MB / ' + mbTotal + ' MB';
  }
}

function finishDownload(message, isError) {
  const bar = document.getElementById('download-bar');
  const status = document.getElementById('download-status');
  const icon = document.querySelector('.download-icon');
  if (bar) bar.style.width = '100%';
  if (status) {
    status.textContent = message;
    status.style.color = isError ? '#d44c4c' : '#10a37f';
  }
  if (icon) icon.textContent = isError ? '⚠️' : '✅';
  noorToast(message);
}

function closeDownloadModal() {
  const modal = document.getElementById('download-modal');
  if (modal) modal.classList.remove('active');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('ServiceWorker registered:', reg.scope))
      .catch((err) => console.warn('ServiceWorker error:', err));
  });
}

// === DEDICATED API KEY MODAL HELPERS ===
function openApiKeyModal() {
  const modal = document.getElementById('api-key-overlay');
  if (modal) modal.classList.add('active');
  createOrShowApiKeyDedicated();
}

function createOrShowApiKeyDedicated() {
  const inp = document.getElementById('dedicated-api-key');
  if (!inp || !currentUser) return;
  fetch(BASE_URL + '/api/keys/mine?username=' + encodeURIComponent(currentUser))
    .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
    .then(({ data }) => {
      if (data.apiKey) inp.value = data.apiKey;
    })
    .catch(() => {});
}

async function createDedicatedApiKey() {
  const inp = document.getElementById('dedicated-api-key');
  if (!inp || !currentUser) return;
  try {
    const r = await fetch(BASE_URL + '/api/keys/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'API key yaratilmadi.');
    inp.value = d.apiKey;
    noorToast('API kalit yaratildi!');
  } catch (e) {
    noorToast(e.message || 'API key yaratilmadi.');
  }
}

function copyApiKeyDedicated() {
  const inp = document.getElementById('dedicated-api-key');
  if (!inp || !inp.value) {
    noorToast("Avval API kalit yarating!");
    return;
  }
  navigator.clipboard.writeText(inp.value);
  noorToast("API Kalit nusxalandi! 📋");
}

function testApiKeyDedicated() {
  const key = document.getElementById('dedicated-api-key')?.value;
  const resEl = document.getElementById('dedicated-api-test-result');
  if (!key) {
    if (resEl) resEl.textContent = 'Avval API kalit yarating.';
    return;
  }
  if (resEl) resEl.textContent = 'Sinov yuborilmoqda...';
  fetch(BASE_URL + '/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: 'noor-ai-1.5', messages: [{ role: 'user', content: 'Faqat OK deb javob ber.' }] })
  }).then(async response => {
    const data = await response.json();
    if (!resEl) return;
    resEl.textContent = response.ok ? '✅ API ishlayapti: 200 OK' : '❌ API xatosi: ' + (data.error || 'noma\'lum xato');
  }).catch(() => { if (resEl) resEl.textContent = '❌ Serverga ulanib bo\'lmadi.'; });
}

function switchCodeTab(lang) {
  ['python', 'js', 'curl'].forEach(l => {
    const tab = document.getElementById(`tab-code-${l}`);
    const snippet = document.getElementById(`code-snippet-${l}`);
    if (tab) tab.classList.toggle('active', l === lang);
    if (snippet) snippet.classList.toggle('hidden', l !== lang);
  });
}


// ===== SETTINGS & PLUGINS =====
function openSettingsModal() {
  document.getElementById('settings-overlay').classList.add('active');
  loadSettings();
}
function openPluginsModal() {
  document.getElementById('plugins-overlay').classList.add('active');
}
function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.settings-tab[data-tab="'+tab+'"]').classList.add('active');
  document.querySelector('.settings-section[data-section="'+tab+'"]').classList.add('active');
}
function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem('theme','dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme','light');
    localStorage.setItem('theme','light');
  } else {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark':'light');
    localStorage.setItem('theme','auto');
  }
}
function saveSettings() {
  const s = {
    language: document.getElementById('setting-language')?.value,
    name: document.getElementById('setting-name')?.value,
    model: document.getElementById('setting-default-model')?.value,
    temperature: document.getElementById('setting-temperature')?.value,
    maxTokens: document.getElementById('setting-max-tokens')?.value,
    topP: document.getElementById('setting-top-p')?.value,
    systemPrompt: document.getElementById('setting-system-prompt')?.value,
    customInstr: document.getElementById('setting-custom-instr')?.value,
    tone: document.getElementById('setting-tone')?.value,
  };
  localStorage.setItem('noor-settings', JSON.stringify(s));
  document.getElementById('settings-overlay').classList.remove('active');
  alert('Sozlamalar saqlandi!');
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('noor-settings') || '{}');
    if (s.language) document.getElementById('setting-language').value = s.language;
    if (s.name) document.getElementById('setting-name').value = s.name;
    if (s.model) document.getElementById('setting-default-model').value = s.model;
    if (s.systemPrompt) document.getElementById('setting-system-prompt').value = s.systemPrompt;
    if (s.customInstr) document.getElementById('setting-custom-instr').value = s.customInstr;
  } catch(e) {}
}
function addMCPServer() {
  const name = prompt('MCP server nomi:');
  if (!name) return;
  const cmd = prompt('Buyruq (masalan: npx):');
  const args = prompt('Argumentlar (masalan: -y @modelcontextprotocol/server-fs):');
  const servers = JSON.parse(localStorage.getItem('mcp-servers') || '[]');
  servers.push({name, cmd, args, enabled: true});
  localStorage.setItem('mcp-servers', JSON.stringify(servers));
  renderMCPServers();
}
function renderMCPServers() {
  const list = document.getElementById('mcp-servers-list');
  if (!list) return;
  const servers = JSON.parse(localStorage.getItem('mcp-servers') || '[]');
  if (servers.length === 0) {
    list.innerHTML = '<p style="color:var(--td);font-size:.85rem;">Hozircha MCP server yo\'q</p>';
    return;
  }
  list.innerHTML = servers.map((s,i) =>
    '<div class="mcp-server-item">' +
      '<span>'+(s.name||'Server')+'</span>' +
      '<button class="btn ghost sm" onclick="removeMCPServer('+i+')">O\'chirish</button>' +
    '</div>'
  ).join('');
}
function removeMCPServer(idx) {
  const servers = JSON.parse(localStorage.getItem('mcp-servers') || '[]');
  servers.splice(idx,1);
  localStorage.setItem('mcp-servers', JSON.stringify(servers));
  renderMCPServers();
}
function togglePlugin(name) {
  const cb = document.querySelector('.plugin-toggle[data-plugin="'+name+'"]');
  if (cb) cb.checked = !cb.checked;
}
function clearMemory() { localStorage.removeItem('chat-memory'); alert('Xotira tozalandi!'); }
function exportData() {
  const data = localStorage;
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'noor-backup.json';
  a.click();
}
function importData() { alert('Import funksiyasi (keyinroq)'); }
function clearAllChats() { if(confirm('Barcha suhbatlarni o\'chirilsinmi?')){ localStorage.clear(); location.reload(); } }
function upgradeToPro() { alert('Pro tarif: 49,000 so\'m/oy. Tez orada!'); }

// Sliders update
document.addEventListener('input', function(e){
  if (e.target.id === 'setting-temperature') document.getElementById('setting-temperature-val').textContent = e.target.value;
  if (e.target.id === 'setting-max-tokens') document.getElementById('setting-max-tokens-val').textContent = e.target.value;
  if (e.target.id === 'setting-top-p') document.getElementById('setting-top-p-val').textContent = e.target.value;
  if (e.target.id === 'setting-voice-speed') document.getElementById('setting-voice-speed-val').textContent = e.target.value + 'x';
  if (e.target.id === 'setting-font-size') document.getElementById('setting-font-size-val').textContent = e.target.value + 'px';
});

renderMCPServers();
