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
    document.getElementById('admin-nav-btn').style.display=isAdmin?'block':'none';
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

// === LOGIN ===
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
    if(r.ok){
      currentUser=username;isAdmin=d.isAdmin;
      document.getElementById('welcome-name').textContent='@'+username;
      if(isAdmin){document.getElementById('admin-nav-btn').style.display='block';}
      else{document.getElementById('admin-nav-btn').style.display='none';}
      saveSession(username,isAdmin);
      showStage('main-content');
      fetchAds();
    }else{err.textContent=d.error||'Xatolik.';}
  }catch(e){err.textContent='Server bilan aloqa yo\'q. Node.js server yoniqmi?';}
}
document.getElementById('login-btn').addEventListener('click',doLogin);
document.getElementById('login-code').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

function logout(){
  currentUser='';isAdmin=false;
  clearSession();
  document.getElementById('tg-username').value='';
  document.getElementById('login-code').value='';
  document.getElementById('login-err').textContent='';
  showStage('stage-login');
}

// Sahifa ochilganda avval saqlangan sessiya bormi tekshiramiz
document.addEventListener('DOMContentLoaded',()=>{
  restoreSession();
});

// === ADMIN PANEL ===
function openAdminPanel(){
  if(!isAdmin){return;}
  showStage('stage-admin-dash');
  loadPendingUsers();
  loadConfig();
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

// === CONFIG MANAGER (ADMIN) ===
async function loadConfig() {
  try {
    const r = await fetch(BASE_URL + '/api/admin/config?password=' + adminPass);
    const d = await r.json();
    if (r.ok && d.config) {
      document.getElementById('config-or-key').value = d.config.openRouterKey || '';
    }
  } catch (e) {
    console.error('Config yuklash xatosi:', e);
  }
}

async function saveConfig() {
  const openRouterKey = document.getElementById('config-or-key').value.trim();
  const err = document.getElementById('config-err');
  const ok = document.getElementById('config-ok');
  err.textContent = ''; ok.textContent = '';

  try {
    const r = await fetch(BASE_URL + '/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPass, openRouterKey })
    });
    const d = await r.json();
    if (r.ok) {
      ok.textContent = d.message;
    } else {
      err.textContent = d.error;
    }
  } catch (e) {
    err.textContent = 'Server xatoligi.';
  }
}

// === AI CHATBOT (FRONTEND) ===
let chatHistory = [];

async function sendChatMsg() {
  const inputEl = document.getElementById('chat-user-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const container = document.getElementById('chat-msg-container');
  const modelSelect = document.getElementById('chat-model-select');
  
  const text = inputEl.value.trim();
  if (!text) return;

  // Append user message
  appendChatBubble(text, 'user');
  inputEl.value = '';
  chatHistory.push({ role: 'user', content: text });

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
      body: JSON.stringify({
        model: modelSelect.value,
        messages: chatHistory
      })
    });
    const d = await r.json();
    
    // Remove Typing Indicator
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();

    if (r.ok) {
      const aiReply = d.choices[0].message.content;
      appendChatBubble(aiReply, 'ai');
      chatHistory.push({ role: 'assistant', content: aiReply });
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

function appendChatBubble(text, sender) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender}`;
  // Use simple translation for markdown-like returns or breaklines
  bubble.innerHTML = text.replace(/\n/g, '<br>');
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// Add enter key listener for chat input
document.getElementById('chat-user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendChatMsg();
  }
});

