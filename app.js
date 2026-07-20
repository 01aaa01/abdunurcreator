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

// === PARALLAX BACKGROUND ===
const aiNames=['ChatGPT','Midjourney','Kling','Sora','Veo 3','Copilot','DALL-E','Runway','Pika','Higgsfield','Gemini','Claude'];
const bg=document.getElementById('ai-bg');
aiNames.forEach(n=>{const el=document.createElement('div');el.className='floating-ai';el.textContent=n;el.style.left=Math.random()*90+'vw';el.style.top=Math.random()*90+'vh';el.style.fontSize=(Math.random()*2.5+1)+'rem';bg.appendChild(el);});
document.addEventListener('mousemove',e=>{const x=e.clientX/window.innerWidth-.5,y=e.clientY/window.innerHeight-.5;document.querySelectorAll('.floating-ai').forEach((el,i)=>{const s=(i%5+1)*18;el.style.transform=`translate(${x*s}px,${y*s}px)`;});});

// === STATE ===
let currentUser='';
let isAdmin=false;
let adminPass='0101';
let selectedMsgUser='';
let msgColor='green';

// === SESSION PERSISTENCE (login bir marta, keyin saqlanadi) ===
const SESSION_KEY='abdunurcreator_session';
function saveSession(username,admin){
  try{localStorage.setItem(SESSION_KEY,JSON.stringify({username,admin}));}catch(e){}
}
function clearSession(){
  try{localStorage.removeItem(SESSION_KEY);}catch(e){}
}
function restoreSession(){
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw)return false;
    const s=JSON.parse(raw);
    if(!s||!s.username)return false;
    currentUser=s.username;isAdmin=!!s.admin;
    document.getElementById('welcome-name').textContent='@'+currentUser;
    document.getElementById('admin-nav-btn').style.display=isAdmin?'inline-flex':'none';
    showStage('main-content');
    fetchAds();
    return true;
  }catch(e){return false;}
}

// === UI HELPERS ===
function showStage(id){
  document.querySelectorAll('.stage').forEach(s=>s.classList.add('hidden'));
  document.getElementById('main-content').classList.remove('show');
  const el=document.getElementById(id);
  if(el)el.classList.remove('hidden');
  if(id==='main-content'){el.classList.add('show');}
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

function deleteSession(id) {
  if (!confirm("Ushbu suhbatni o'chirishga ishonchingiz komilmi?")) return;
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

function openChatStage() {
  loadSessionsFromStorage();
  showStage('stage-chat');
  if (chatSessions.length === 0 || !activeSessionId) {
    startNewChatSession();
  } else {
    loadChatSession(activeSessionId);
  }
}
function closeChatStage() {
  showStage('main-content');
}
function closeCodePanel() {
  document.getElementById('chat-code-panel').classList.add('hidden');
  document.getElementById('code-panel-body').innerHTML = '';
}

// === ADMIN PANEL ===
function openAdminPanel(){
  if(!isAdmin){return;}
  showStage('stage-admin-dash');
  loadPendingUsers();
  switchTab('tab-users');
}
function closeAdminPanel(){showStage('main-content');}

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
  if(!confirm(`@${username} ni ro'yxatdan butunlay o'chirishga ishonchingiz komilmi?\n(U qayta /start bossa, yangi foydalanuvchi sifatida qayta paydo bo'ladi.)`))return;
  try{
    const r=await fetch(BASE_URL+'/api/admin/delete-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPass,username})});
    const d=await r.json();
    if(r.ok){
      if(selectedMsgUser===username){document.getElementById('msg-composer').classList.add('hidden');selectedMsgUser='';}
      loadPendingUsers();
    }else{
      alert(d.error||'O\'chirishda xatolik yuz berdi.');
    }
  }catch(e){alert('Server bilan aloqa yo\'q.');}
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
let currentChatMode = 'general'; // 'general' (1.5) | 'coder' (1.0, matn-only) | 'coder2' (2.0, vision+code)

const CHAT_MODE_LABELS = { general: 'Noor AI 1.5', coder: 'Noor AI 1.0 (Coder)', coder2: 'Noor AI 2.0 (Coder)' };

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
  document.getElementById('chat-model-select').value = mode;
  syncModelPickerUI(mode);
  const note = document.getElementById('chat-note');
  const t = (window.NOOR_I18N && window.NOOR_I18N.t) ? window.NOOR_I18N.t : (k, fallback) => fallback;
  const kind = mediaKindOf(mode);
  if (mode === 'coder') {
    note.textContent = t('chat.noteCoder', "Noor AI 1.0 (Coder) — faqat kodlash uchun ixtisoslashgan (matn bilan, rasmni o'qiy olmaydi).");
  } else if (mode === 'coder2') {
    note.textContent = t('chat.noteCoder2', "Noor AI 2.0 (Coder) — kod yozadi VA rasm/skrinshotlarni ham tushunadi.");
  } else if (kind === 'image') {
    note.textContent = t('chat.noteImage', "Pastga nima chizish kerakligini yozing, sizga rasm yaratib beradi.");
  } else if (kind === 'video') {
    note.textContent = t('chat.noteVideo', "Pastga video mavzusini yozing, qisqa video yaratib beradi (biroz vaqt olishi mumkin).");
  } else if (kind === 'audio') {
    note.textContent = t('chat.noteAudio', "Pastga musiqa/audio mavzusini yozing, audio yaratib beradi.");
  } else {
    note.textContent = t('chat.noteGeneral', "Noor AI 1.5 — suhbat, kodlash va rasmni tushunish uchun eng yaxshi bepul modelni o'zi avtomatik tanlaydi. Rasm tashlang yoki yuklang — u rasmni ham tushunadi.");
  }
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

function displayAiReply(text) {
  if (currentChatMode === 'coder' || currentChatMode === 'coder2') {
    const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let match, plain = '', lastIndex = 0;
    const blocks = [];
    while ((match = fenceRegex.exec(text)) !== null) {
      plain += text.slice(lastIndex, match.index);
      blocks.push({ lang: (match[1] || '').toLowerCase(), code: match[2].replace(/\n$/, '') });
      lastIndex = fenceRegex.lastIndex;
    }
    plain += text.slice(lastIndex);
    appendChatBubble(plain.trim() || "Kodni o'ng paneldan ko'ring →", 'ai-plain');
    if (blocks.length) renderCodePanel(blocks);
  } else {
    appendChatBubble(text, 'ai');
  }
}

function appendChatBubble(text, sender) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender === 'ai-plain' ? 'ai' : sender}`;
  bubble.innerHTML = (sender === 'ai') ? renderAiMessageHTML(text) : escapeHtml(text).replace(/\n/g, '<br>');
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

  if (mediaKindOf(currentChatMode)) {
    await sendMediaGenRequest(text);
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

  // Add Typing Indicator
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
      body: JSON.stringify({ messages: chatHistory, mode: currentChatMode })
    });
    const d = await r.json();

    // Remove Typing Indicator
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();

    if (r.ok) {
      const aiReply = d.choices[0].message.content;
      displayAiReply(aiReply);
      chatHistory.push({ role: 'assistant', content: aiReply });
      persistActiveSession(text || 'Rasm bilan suhbat');
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
        html += `<button type="button" class="model-picker-item" data-value="${escapeHtml(m.id)}" data-label="${escapeHtml(m.label)}">${escapeHtml(m.label)}<span class="model-picker-tag ${sec.tagClass}">${sec.tagText}</span></button>`;
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
    setChatMode(item.dataset.value);
    closeMenu();
  });
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      closeMenu();
    }
  });
  syncModelPickerUI(currentChatMode);
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

