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

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Chat javobidagi ```kod``` bloklarini topib, "Ishga tushirish" tugmasi bilan
// ko'rsatadigan qilib render qiladi (faqat AI javoblari uchun).
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
      <div class="code-block-header"><span class="code-lang">${escapeHtml(lang || 'code')}</span>${runnable ? `<button type="button" class="code-run-btn" onclick="runCodeBlock('${id}')">▶ Ishga tushirish</button>` : ''}</div>
      <pre class="code-block"><code>${escapeHtml(code)}</code></pre>
      <div class="code-result hidden" id="result-${id}"></div>
    </div>`;
    lastIndex = fenceRegex.lastIndex;
  }
  out += escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
  return out;
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

// === AI CHATBOT (FRONTEND) — Noor AI 1.5 ===
// Endi model tanlash yo'q: server o'zi ishlaydigan bepul modelni tanlaydi.
// Foydalanuvchi rasm tashlasa (drop/tanlasa), Noor AI uni ham "ko'radi" va tushunadi.
let chatHistory = [];
let pendingImage = null; // {dataUrl, name}

function appendChatBubble(text, sender) {
  const container = document.getElementById('chat-msg-container');
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender}`;
  bubble.innerHTML = sender === 'ai' ? renderAiMessageHTML(text) : escapeHtml(text).replace(/\n/g, '<br>');
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

async function sendChatMsg() {
  const inputEl = document.getElementById('chat-user-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const container = document.getElementById('chat-msg-container');

  const text = inputEl.value.trim();
  if (!text && !pendingImage) return;

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
      body: JSON.stringify({ messages: chatHistory })
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

// Add enter key listener for chat input
document.getElementById('chat-user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendChatMsg();
  }
});

// Rasm biriktirish tugmasi va drag-drop
const chatAttachBtn = document.getElementById('chat-attach-btn');
const chatAttachInput = document.getElementById('chat-attach-input');
if (chatAttachBtn && chatAttachInput) {
  chatAttachBtn.addEventListener('click', () => chatAttachInput.click());
  chatAttachInput.addEventListener('change', (e) => {
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

// === RASM YARATISH (Puter.js orqali, bepul, cheksiz) ===
// Puter.js "User-Pays" modeli bilan ishlaydi: har bir tashrif buyuruvchi birinchi
// marta rasm yaratganda o'zining bepul Puter akkauntiga kirishi so'raladi (bir marta),
// shundan keyin cheksiz va bepul rasm generatsiya qila oladi — bizning serverimizga
// hech qanday API kalit kerak emas.
const IMG_MODELS = [
  { id: 'google/gemini-3-pro-image-preview', label: 'Nano Banana Pro (Gemini)' },
  { id: 'black-forest-labs/flux-2-pro', label: 'FLUX.2 Pro' },
  { id: 'openai/gpt-image-2', label: 'GPT Image 2' },
  { id: 'stabilityai/stable-diffusion-3-medium', label: 'Stable Diffusion 3' }
];

async function generateAiImage() {
  const promptEl = document.getElementById('imggen-prompt');
  const modelSelect = document.getElementById('imggen-model');
  const resultsEl = document.getElementById('imggen-results');
  const err = document.getElementById('imggen-err');
  const btn = document.getElementById('imggen-btn');

  const prompt = promptEl.value.trim();
  err.textContent = '';
  if (!prompt) { err.textContent = 'Iltimos, rasm tavsifini yozing.'; return; }

  if (typeof puter === 'undefined') {
    err.textContent = 'Rasm generatsiya xizmati yuklanmadi. Internetni tekshirib, sahifani yangilang.';
    return;
  }

  const card = document.createElement('div');
  card.className = 'imggen-card loading';
  card.innerHTML = `<div class="imggen-skel"></div><p class="imggen-prompt-txt">${prompt}</p>`;
  resultsEl.prepend(card);

  btn.disabled = true;
  btn.textContent = 'Yaratilmoqda...';

  try {
    const imgEl = await puter.ai.txt2img(prompt, { model: modelSelect.value });
    card.classList.remove('loading');
    card.innerHTML = '';
    imgEl.className = 'imggen-img';
    card.appendChild(imgEl);
    const p = document.createElement('p');
    p.className = 'imggen-prompt-txt';
    p.textContent = prompt;
    card.appendChild(p);
    const dl = document.createElement('a');
    dl.href = imgEl.src;
    dl.download = 'noor-ai-image.png';
    dl.className = 'btn sm ghost imggen-dl';
    dl.textContent = '⬇️ Yuklab olish';
    card.appendChild(dl);
  } catch (e) {
    card.remove();
    err.textContent = 'Xatolik yuz berdi: ' + (e?.message || 'Rasm yaratib bo\'lmadi. Boshqa modelni sinab ko\'ring.');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎨 Yaratish';
  }
}

document.getElementById('imggen-btn')?.addEventListener('click', generateAiImage);
document.getElementById('imggen-prompt')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateAiImage(); }
});

