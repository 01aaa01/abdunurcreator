// ===== NOOR AI CODER MAX =====
const API_BASE = location.protocol === 'file:' ? 'http://localhost:3000' : '';
let editor = null, currentFile = null, openFiles = {}, term = null, ws = null;
let agentVersion = '1.5';
let currentLine = '';
let coderModel = 'noor-ai-max-1.5';
let lastGeneratedCode = null;

const MODEL_CONFIG = {
  '1.0': { name: 'Noor AI Coder Max 1.0 (Fast)', desc: 'Tez, qisqa javoblar' },
  '1.5': { name: 'Noor AI Coder Max 1.5 (Balanced)', desc: 'Kundalik ishlatish uchun ideal' },
  '2.0': { name: 'Noor AI Coder Max 2.0 (Deep)', desc: 'Murakkab arxitektura' }
};

const DEMO_FILES = {
  type: 'folder', name: 'noor-ai-project',
  children: [
    { type: 'file', name: 'index.html', icon: '🌐', language: 'html', content: '<!DOCTYPE html>\n<html>\n<head><title>Noor AI Demo</title></head>\n<body>\n  <h1>Salom, dunyo!</h1>\n</body>\n</html>' },
    { type: 'file', name: 'app.js', icon: '📜', language: 'javascript', content: '// Noor AI Max\nfunction greet(name) {\n  return `Salom, ${name}!`;\n}\nconsole.log(greet("Noor AI"));' },
    { type: 'file', name: 'style.css', icon: '🎨', language: 'css', content: 'body { font-family: sans-serif; background: #faf9f5; }' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initMonaco(); initFileTree(); initChat(); initTerminal(); initUI();
  loadApiKey();
});

function initMonaco() {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create(document.getElementById('monacoEditor'), {
      value: '// ✦ Noor AI Coder Max\n// Chap chat orqali kod so\'rang!\n// Masalan: "Python hello world yoz"\n\nfunction hello(name) {\n  return `Salom, ${name}!`;\n}\n\nconsole.log(hello("Noor AI"));',
      language: 'javascript', theme: 'vs-dark', fontSize: 14,
      minimap: { enabled: true }, automaticLayout: true, tabSize: 2
    });
    editor.onDidChangeModelContent(() => {
      if (currentFile && openFiles[currentFile]) openFiles[currentFile].content = editor.getValue();
    });
    openFile('app.js');
  });
}

function initFileTree() {
  const tree = document.getElementById('fileTree');
  tree.innerHTML = renderTree(DEMO_FILES, 0);
  tree.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => {
      const name = item.dataset.name;
      if (item.classList.contains('folder')) {
        item.classList.toggle('open');
        const child = tree.querySelector(`.file-children[data-parent="${name}"]`);
        if (child) child.style.display = item.classList.contains('open') ? 'block' : 'none';
      } else { openFile(name); }
    });
  });
}

function renderTree(node) {
  if (node.type === 'folder') {
    const childHtml = (node.children || []).map(renderTree).join('');
    return `<div class="file-item folder" data-name="${node.name}">📁 ${node.name}</div>
            <div class="file-children" data-parent="${node.name}" style="display:none;">${childHtml}</div>`;
  }
  return `<div class="file-item" data-name="${node.name}">${node.icon || '📄'} ${node.name}</div>`;
}

function findFile(node, name) {
  if (node.type === 'file' && node.name === name) return node;
  if (node.children) for (const c of node.children) { const f = findFile(c, name); if (f) return f; }
  return null;
}

function openFile(name) {
  const file = findFile(DEMO_FILES, name);
  if (!file) return;
  currentFile = name; openFiles[name] = file;
  const tabs = document.getElementById('fileTabs');
  if (!tabs.querySelector(`[data-tab="${name}"]`)) {
    const tab = document.createElement('div');
    tab.className = 'file-tab active';
    tab.dataset.tab = name; tab.textContent = name;
    tabs.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
    tab.addEventListener('click', () => openFile(name));
    tabs.appendChild(tab);
  } else {
    tabs.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
    tabs.querySelector(`[data-tab="${name}"]`).classList.add('active');
  }
  if (editor) {
// ===== CHAT =====
function initChat() {
  const input = document.getElementById('chatInput');
  document.getElementById('chatSendBtn').addEventListener('click', () => sendChat());
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 100) + 'px'; });
  document.getElementById('clearChatBtn').addEventListener('click', () => {
    document.getElementById('chatMessages').innerHTML = '<div class="chat-msg ai"><div class="msg-avatar">⬢</div><div class="msg-bubble">Chat tozalandi!</div></div>';
  });
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  appendChat('user', escapeHtml(text));
  input.value = ''; input.style.height = 'auto';
  const loading = appendChat('ai', '<em>⏳ O\'ylayapman...</em>');
  try {
    const response = await callAI(text);
    loading.remove();
    handleAIResponse(response, text);
  } catch (e) {
    loading.remove();
    appendChat('ai', '<strong style="color:#f48771">⚠️ Xatolik:</strong> ' + escapeHtml(e.message));
  }
}

async function callAI(prompt) {
  const apiKey = localStorage.getItem('noor-api-key');
  const provider = localStorage.getItem('noor-api-provider') || 'groq';
  if (!apiKey) return demoAIResponse(prompt);

  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: coderModel === '1.0' ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Sen Noor AI Coder yordamchisisan. Kod yozishda yordam ber. Javobingni ```til\\nkod\\n``` formatida ber.' },
          { role: 'user', content: prompt }
        ],
        temperature: coderModel === '1.0' ? 0.3 : 0.5,
        max_tokens: coderModel === '1.0' ? 1024 : 2048
      })
    });
    if (!response.ok) throw new Error('Groq API xatosi: ' + response.status);
    const data = await response.json();
    return data.choices[0].message.content;
  }
  return demoAIResponse(prompt);
}

function demoAIResponse(prompt) {
  const t = prompt.toLowerCase();
  if (t.includes('hello world') || t.includes('salom dunyo')) {
    return 'Mana Python hello world:\\n\\n```python\\nprint("Salom, dunyo!")\\n```';
  }
  if (t.includes('html') || t.includes('web sahifa')) {
    return 'Mana HTML sahifa:\\n\\n```html\\n<!DOCTYPE html>\\n<html>\\n<head><title>Noor AI</title></head>\\n<body><h1>Salom!</h1></body>\\n</html>\\n```';
  }
  if (t.includes('python')) {
    return 'Mana Python:\\n\\n```python\\ndef greet(name):\\n    return f"Salom, {name}!"\\nprint(greet("Noor AI"))\\n```';
  }
  if (t.includes('javascript') || t.includes('js ')) {
    return 'Mana JavaScript:\\n\\n```javascript\\nfunction greet(name) {\\n  return `Salom, ${name}!`;\\n}\\nconsole.log(greet("Noor AI"));\\n```';
  }
  return '⚠️ <strong>API key yo\'q!</strong><br>👈 Pastdagi ⚙️ tugma orqali Groq (bepul) API key kiriting.';
}

function handleAIResponse(response) {
  const codeMatch = response.match(/```(\\w+)?\\n([\\s\\S]*?)```/);
  if (codeMatch) {
    const lang = codeMatch[1] || 'javascript';
    const code = codeMatch[2].trim();
    const explanation = response.replace(/```[\\s\\S]*?```/, '').trim();
    const html = (explanation ? explanation.replace(/\\n/g, '<br>') : '') +
// ===== TERMINAL =====
function initTerminal() {
  term = new Terminal({
    fontSize: 13, fontFamily: 'Cascadia Code, Consolas, monospace',
    theme: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff' },
    cursorBlink: true, convertEol: true
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(document.getElementById('terminalBody'));
  fitAddon.fit();
  window.addEventListener('resize', () => fitAddon.fit());
  term.writeln('\x1b[1;36m✦ Noor AI Coder Max Terminal\x1b[0m');
  term.writeln('\x1b[90mBuyruqlar: free buff, model <1.0|1.5|2.0>, ls, help, clear\x1b[0m');
  promptTerminal();
  startDemoTerminal();
}

function startDemoTerminal() {
  term.onKey(({ key }) => {
    if (key === '\r') {
      term.write('\r\n');
      const cmd = currentLine.trim(); currentLine = '';
      handleDemoCommand(cmd); promptTerminal();
    } else if (key === '\u007F') {
      if (currentLine.length > 0) { currentLine = currentLine.slice(0, -1); term.write('\b \b'); }
    } else { currentLine += key; term.write(key); }
  });
}

function promptTerminal() { term.write('\x1b[1;32m➜\x1b[0m \x1b[1;34mnoor-ai\x1b[0m $ '); }

function handleDemoCommand(cmd) {
  const c = cmd.toLowerCase();
  if (c === 'help' || c === '?') {
    term.writeln('\x1b[1;36mBuyruqlar:\x1b[0m');
    term.writeln('  \x1b[33mfree buff\x1b[0m            - demo AI rejim');
    term.writeln('  \x1b[33mmodel 1.0|1.5|2.0\x1b[0m     - Coder modelini o\'zgartirish');
    term.writeln('  \x1b[33mls\x1b[0m                   - fayllar');
    term.writeln('  \x1b[33mdate\x1b[0m                 - sana');
    term.writeln('  \x1b[33mnode -v\x1b[0m              - Node versiyasi');
    term.writeln('  \x1b[33mclear\x1b[0m                - tozalash');
  } else if (c === 'free buff' || c === 'freebuff') {
    term.writeln('\x1b[1;35m🎮 Free Buff Mode!\x1b[0m');
    term.writeln('Chat orqali savol bering.');
    appendChat('ai', '🎮 <strong>Free Buff Mode</strong> terminaldan faollashtirildi!');
  } else if (c.startsWith('model ')) {
    const v = cmd.split(' ')[1];
    if (['1.0', '1.5', '2.0'].includes(v)) {
      coderModel = 'noor-ai-max-' + v;
      document.getElementById('agentSwitcher').value = v;
      document.getElementById('agentBadge').textContent = 'Noor AI Coder Max ' + v;
function loadApiKey() {
  const key = localStorage.getItem('noor-api-key');
  if (key && document.getElementById('apiKeyInput')) {
    document.getElementById('apiKeyInput').value = key;
  } else if (document.getElementById('apiKeyInput') && document.getElementById('apiKeyInput').value) {
    // HTML'da default qiymat bor, saqlab olamiz
    localStorage.setItem('noor-api-key', document.getElementById('apiKeyInput').value);
    localStorage.setItem('noor-api-provider', document.getElementById('apiProvider')?.value || 'groq');
  }
}
      document.getElementById('statusAgent').textContent = 'Noor AI Coder Max ' + v;
      term.writeln('\x1b[1;32m✓ Model o\'zgartirildi: Noor AI Coder Max ' + v + '\x1b[0m');
      // Free Buff'ga ham sinxronlashtirish
      localStorage.setItem('free-buff-model', v);
    } else {
      term.writeln('\x1b[1;31mNoto\'g\'ri model. 1.0, 1.5 yoki 2.0 kiriting\x1b[0m');
    }
  } else if (c === 'ls' || c === 'dir') {
    term.writeln('\x1b[1;33mindex.html  app.js  style.css\x1b[0m');
  } else if (c === 'date') term.writeln(new Date().toString());
  else if (c === 'node -v') term.writeln('v18.17.0');
  else if (c === 'clear' || c === 'cls') term.clear();
  else if (c === '') return;
  else term.writeln(`\x1b[1;31mbash: ${cmd}: topilmadi\x1b[0m`);
}

function loadApiKey() {
  // API Settings tugmasi
  document.getElementById('apiSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('apiSettingsModal').style.display = 'block';
    loadApiKey();
  });

  // API Settings
  const key = localStorage.getItem('noor-api-key');
  if (key && document.getElementById('apiKeyInput')) {
    document.getElementById('apiKeyInput').value = key;
  }
}

function initUI() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if (editor) monaco.editor.setTheme(isDark ? 'vs' : 'vs-dark');
  });

  document.getElementById('agentSwitcher').addEventListener('change', e => {
    agentVersion = e.target.value;
    coderModel = 'noor-ai-max-' + e.target.value;
    document.getElementById('agentBadge').textContent = 'Noor AI Coder Max ' + e.target.value;
    document.getElementById('statusAgent').textContent = 'Noor AI Coder Max ' + e.target.value;
    localStorage.setItem('free-buff-model', e.target.value);
  });

  document.getElementById('newFileBtn').addEventListener('click', () => {
    const name = prompt('Yangi fayl nomi:');
    if (name) { DEMO_FILES.children.push({ type: 'file', name, icon: '📄', language: 'javascript', content: '// ' + name }); initFileTree(); }
  });

  document.getElementById('clearTermBtn').addEventListener('click', () => { if (term) term.clear(); });
  document.getElementById('toggleTermBtn').addEventListener('click', () => {
    document.getElementById('terminalPanel').classList.toggle('collapsed');
  });

  // API Settings
  document.getElementById('saveApiBtn')?.addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const provider = document.getElementById('apiProvider').value;
    if (key) {
      localStorage.setItem('noor-api-key', key);
      localStorage.setItem('noor-api-provider', provider);
      alert('✅ API key saqlandi! ' + provider);
    }
  });

  // PWA Install
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwaInstall')?.style.setProperty('display', 'inline-flex');
  });
  document.getElementById('pwaInstall')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });
}

      '<div class="code-preview" data-lang="' + lang + '">' +
        '<div class="code-preview-header"><span>📄 ' + lang.toUpperCase() + '</span>' +
        '<div class="code-preview-actions">' +
          '<button onclick="copyCode()">📋</button>' +
          '<button onclick="downloadCode(\'' + lang + '\')">⬇️</button>' +
          '<button onclick="openInEditor(\'' + lang + '\')">📝</button>' +
        '</div></div>' +
        '<pre><code>' + escapeHtml(code) + '</code></pre></div>';
    appendChat('ai', html);
    lastGeneratedCode = { lang, code };
  } else {
    appendChat('ai', escapeHtml(response));
  }
}

function copyCode() { if (lastGeneratedCode) { navigator.clipboard.writeText(lastGeneratedCode.code); alert('✅ Nusxalandi!'); } }

function downloadCode(lang) {
  if (!lastGeneratedCode) return;
  const exts = { javascript: 'js', python: 'py', html: 'html', css: 'css', typescript: 'ts' };
  const ext = exts[lang] || 'txt';
  const blob = new Blob([lastGeneratedCode.code], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'noor-ai-code.' + ext;
  a.click();
  URL.revokeObjectURL(a.href);
}

function openInEditor(lang) {
  if (!lastGeneratedCode || !editor) return;
  const ext = lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang;
  const fname = 'generated.' + ext;
  DEMO_FILES.children.push({ type: 'file', name: fname, icon: '📄', language: lang, content: lastGeneratedCode.code });
  initFileTree();
  openFile(fname);
  appendChat('ai', '✅ <strong>' + fname + '</strong> ochildi!');
}

function appendChat(role, html) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = `<div class="msg-avatar">${role === 'user' ? 'Siz' : '⬢'}</div><div class="msg-bubble">${html}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    monaco.editor.setModelLanguage(editor.getModel(), file.language || 'plaintext');
    editor.setValue(file.content);
  }
  document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
  const el = document.querySelector(`.file-item[data-name="${name}"]`);
  if (el) el.classList.add('active');
  document.getElementById('statusFile').textContent = `📄 ${name}`;
}


// ===== SETTINGS & PLUGINS HANDLERS =====
function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
  const tabBtn = document.querySelector('.settings-tab[data-tab="'+tab+'"]');
  const tabSection = document.querySelector('.settings-section[data-section="'+tab+'"]');
  if (tabBtn) tabBtn.classList.add('active');
  if (tabSection) tabSection.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  // Open Settings
  document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'block';
  });
  // Open Plugins
  document.getElementById('openPluginsBtn')?.addEventListener('click', () => {
    document.getElementById('pluginsModal').style.display = 'block';
  });
  // Save settings
  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    const s = {
      model: document.getElementById('setting-default-model')?.value,
      temperature: document.getElementById('setting-temperature')?.value,
      maxTokens: document.getElementById('setting-max-tokens')?.value,
      language: document.getElementById('setting-language')?.value,
    };
    localStorage.setItem('noor-coder-settings', JSON.stringify(s));
    document.getElementById('settingsModal').style.display = 'none';
    alert('✅ Settings saved!');
  });
  // Sliders
  document.addEventListener('input', (e) => {
    if (e.target.id === 'setting-temperature') document.getElementById('setting-temperature-val').textContent = e.target.value;
    if (e.target.id === 'setting-max-tokens') document.getElementById('setting-max-tokens-val').textContent = e.target.value;
    if (e.target.id === 'setting-font-size') document.getElementById('setting-font-size-val').textContent = e.target.value + 'px';
  });
  // Theme buttons in settings
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      if (editor) monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    });
  });
  // Plugin toggle
  document.querySelectorAll('.plugin-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.switch')) return;
      const cb = card.querySelector('.plugin-toggle');
      if (cb) cb.checked = !cb.checked;
    });
  });
  // API settings save
  document.getElementById('saveApiBtn')?.addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const provider = document.getElementById('apiProvider').value;
    if (key) {
      localStorage.setItem('noor-api-key', key);
      localStorage.setItem('noor-api-provider', provider);
      alert('✅ API key saved! Provider: ' + provider);
    } else {
      alert('Please enter an API key');
    }
  });
  document.getElementById('apiSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('apiSettingsModal').style.display = 'block';
    const key = localStorage.getItem('noor-api-key');
    if (key && document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = key;
  });
  // Close modals on overlay click
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov) ov.style.display = 'none';
    });
  });
});
