// ===== NOOR AI CODER =====
const API_BASE = location.protocol === 'file:' ? 'http://localhost:3000' : '';
let editor = null, currentFile = null, openFiles = {}, term = null, ws = null;
let agentVersion = '1.5';
let currentLine = '';

const DEMO_FILES = {
  type: 'folder', name: 'noor-ai-demo',
  children: [
    { type: 'file', name: 'index.html', icon: '🌐', language: 'html', content: '<!DOCTYPE html>\n<html><head><title>Demo</title></head>\n<body><h1>Salom!</h1></body></html>' },
    { type: 'file', name: 'app.js', icon: '📜', language: 'javascript', content: 'function greet(name) { return `Salom, ${name}!`; }\nconsole.log(greet("Noor AI"));' },
    { type: 'file', name: 'style.css', icon: '🎨', language: 'css', content: 'body { font-family: sans-serif; background: #faf9f5; }' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initMonaco(); initFileTree(); initChat(); initTerminal(); initUI();
});

function initMonaco() {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create(document.getElementById('monacoEditor'), {
      value: '// ✦ Noor AI Coder\n// Chap chat orqali kod so\'rang!\n\nfunction hello(name) {\n  return `Salom, ${name}!`;\n}\n\nconsole.log(hello("Noor AI"));',
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

function renderTree(node, depth) {
  if (node.type === 'folder') {
    const childHtml = (node.children || []).map(c => renderTree(c, depth + 1)).join('');
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
    monaco.editor.setModelLanguage(editor.getModel(), file.language || 'plaintext');
    editor.setValue(file.content);
  }
  document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
  const el = document.querySelector(`.file-item[data-name="${name}"]`);
  if (el) el.classList.add('active');
  document.getElementById('statusFile').textContent = `📄 ${name}`;
}


function initChat() {
  const input = document.getElementById('chatInput');
  document.getElementById('chatSendBtn').addEventListener('click', () => sendChat());
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 100) + 'px'; });
  document.getElementById('clearChatBtn').addEventListener('click', () => {
    document.getElementById('chatMessages').innerHTML = '<div class="chat-msg ai"><div class="msg-avatar">⬢</div><div class="msg-bubble">Chat tozalandi!</div></div>';
  });
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  appendChat('user', escapeHtml(text));
  input.value = ''; input.style.height = 'auto';
  setTimeout(() => appendChat('ai', generateAIResponse(text)), 500);
}

function appendChat(role, html) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = `<div class="msg-avatar">${role === 'user' ? 'Siz' : '⬢'}</div><div class="msg-bubble">${html}</div>`;
  msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function generateAIResponse(text) {
  const t = text.toLowerCase();
  if (t.includes('free buff') || t.includes('freebuf')) {
    return '<strong>🎮 Free Buff Mode!</strong> Demo AI ishlayapti. Haqiqiy API uchun backend yarating.';
  }
  if (t.includes('funksiya') || t.includes('function') || t.includes('yoz')) {
    return '💻 Mana funksiya:<pre><code>function greet(name) {\n  return `Salom, ${name}!`;\n}\nconsole.log(greet("Noor AI"));</code></pre>';
  }
  if (t.includes('yordam') || t.includes('help')) {
    return '<strong>Yordam:</strong><ul><li>💻 "funksiya yoz" - kod</li><li>🎮 "free buff" - demo</li><li>📁 "+" tugma - yangi fayl</li></ul>';
  }
  return `Tushundim: <em>"${escapeHtml(text)}"</em><br>💡 Demo rejim. <code>free buff</code> yoki <code>funksiya yoz</code> sinang.`;
}

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
  term.writeln('\x1b[1;36m✦ Noor AI Coder Terminal\x1b[0m');
  term.writeln('\x1b[90mDemo terminal (WebSocket server ixtiyoriy)\x1b[0m');
  startDemoTerminal();
}

function startDemoTerminal() {
  promptTerminal();
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
    term.writeln('\x1b[1;36mBuyruqlar: help, free buff, ls, date, echo, clear, node -v\x1b[0m');
  } else if (c === 'free buff' || c === 'freebuff') {
    term.writeln('\x1b[1;35m🎮 Free Buff!\x1b[0m');
    appendChat('ai', '🎮 <strong>Free Buff Mode</strong> terminaldan faollashtirildi!');
  } else if (c === 'ls' || c === 'dir') {
    term.writeln('\x1b[1;33mindex.html  app.js  style.css\x1b[0m');
  } else if (c === 'date') term.writeln(new Date().toString());
  else if (c.startsWith('echo ')) term.writeln(cmd.slice(5));
  else if (c === 'node -v') term.writeln('v18.17.0 (demo)');
  else if (c === 'clear' || c === 'cls') term.clear();
  else if (c === '') return;
  else term.writeln(`\x1b[1;31mbash: ${cmd}: topilmadi\x1b[0m`);
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
    const labels = { '1.0': 'Noor AI 1.0', '1.5': 'Noor AI 1.5', '2.0': 'Noor AI 2.0' };
    document.getElementById('agentBadge').textContent = labels[agentVersion];
    document.getElementById('statusAgent').textContent = labels[agentVersion];
  });
  document.getElementById('runBtn').addEventListener('click', () => {
    if (editor) {
      const code = editor.getValue();
      appendChat('ai', `▶ <strong>Run:</strong><pre><code>${escapeHtml(code.substring(0, 300))}${code.length > 300 ? '...' : ''}</code></pre>`);
    }
  });
  document.getElementById('newFileBtn').addEventListener('click', () => {
    const name = prompt('Yangi fayl nomi:');
    if (name) { DEMO_FILES.children.push({ type: 'file', name, icon: '📄', language: 'javascript', content: '// ' + name }); initFileTree(); }
  });
  document.getElementById('clearTermBtn').addEventListener('click', () => { if (term) term.clear(); });
  document.getElementById('toggleTermBtn').addEventListener('click', () => {
    document.getElementById('terminalPanel').classList.toggle('collapsed');
  });
}
