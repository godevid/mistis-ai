/* Mistis AI — main app */
(function () {
  const $ = (id) => document.getElementById(id);
  const PREFS_KEY = 'mistis.prefs.v1'; // non-sensitive only (selected scene)

  const state = {
    ghostId: 'pocong',
    sceneId: 'graveyard',
    config: null, // { baseUrl, apiKey, model, temperature } — memory only
    histories: {}, // ghostId -> [{role, content}] — memory only, never persisted
    abort: null,
    busy: false,
  };

  const ghost = () => window.GHOSTS.find((g) => g.id === state.ghostId);
  const scene = () => window.SCENES.find((s) => s.id === state.sceneId);
  const hist = () => (state.histories[state.ghostId] ||= []);

  /* ---------- helpers ---------- */
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function md(text) {
    let t = esc(text);
    const blocks = [];
    t = t.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, c) => {
      blocks.push('<pre><code>' + c.replace(/\n$/, '') + '</code></pre>');
      return `\u0000${blocks.length - 1}\u0000`;
    });
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em class="act">$2</em>');
    t = t.replace(/\n/g, '<br>');
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
  }
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ scene: state.sceneId })); } catch {}
  }

  /* ---------- scene ---------- */
  function renderScene() {
    $('scene').innerHTML = window.renderScene(state.sceneId);
    document.querySelectorAll('#sceneBar button').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.id === state.sceneId)));
    window.Sound.setScene(scene().ambience);
    savePrefs();
  }
  function buildSceneBar() {
    const bar = $('sceneBar');
    bar.innerHTML = '';
    window.SCENES.forEach((s) => {
      const b = document.createElement('button');
      b.dataset.id = s.id;
      b.setAttribute('role', 'tab');
      b.title = s.desc;
      b.innerHTML = `<span>${s.icon}</span> ${s.name}`;
      b.addEventListener('click', () => { state.sceneId = s.id; renderScene(); });
      bar.appendChild(b);
    });
  }

  /* ---------- ghosts ---------- */
  function buildGhostList() {
    const list = $('ghostList');
    list.innerHTML = '';
    window.GHOSTS.forEach((g) => {
      const b = document.createElement('button');
      b.className = 'ghost-card';
      b.dataset.id = g.id;
      b.style.setProperty('--gc', g.color);
      b.innerHTML = `<div class="avatar-sm">${g.svg}</div><div><strong>${g.name}</strong><small>${g.title}</small></div>`;
      b.addEventListener('click', () => selectGhost(g.id));
      list.appendChild(b);
    });
  }
  function selectGhost(id, opts = {}) {
    if (state.busy) stopStream();
    state.ghostId = id;
    const g = ghost();
    document.querySelectorAll('.ghost-card').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
    $('headAvatar').innerHTML = g.svg;
    $('headAvatar').style.setProperty('--gc', g.color);
    $('headName').textContent = g.name;
    $('headTitle').textContent = `${g.title} — “${g.tagline}”`;
    $('headSkills').innerHTML = g.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('');
    $('quick').innerHTML = '';
    g.quick.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => { $('input').value = q; send(); });
      $('quick').appendChild(b);
    });
    if (!hist().length) hist().push({ role: 'assistant', content: opts.greeting || g.greeting, local: true });
    renderMessages();
    if (!opts.silent) $('input').focus();
  }

  /* ---------- messages ---------- */
  function msgEl(m) {
    const d = document.createElement('div');
    d.className = 'msg ' + (m.role === 'user' ? 'me' : 'bot') + (m.error ? ' err' : '');
    if (m.role !== 'user') {
      const a = document.createElement('div');
      a.className = 'bubble-av';
      a.innerHTML = ghost().svg;
      d.appendChild(a);
    }
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = md(m.content || '');
    d.appendChild(b);
    return d;
  }
  function renderMessages() {
    const box = $('messages');
    box.innerHTML = '';
    hist().forEach((m) => box.appendChild(msgEl(m)));
    if (!state.config) {
      const n = document.createElement('div');
      n.className = 'notice';
      n.innerHTML = 'Belum ada LLM terhubung. <button type="button" id="noticeBtn">Hubungkan sekarang</button>';
      box.appendChild(n);
      n.querySelector('button').addEventListener('click', openSettings);
    }
    box.scrollTop = box.scrollHeight;
  }

  function buildMessages() {
    const g = ghost();
    const sc = scene();
    const sys = `${g.system}\n\nLATAR TEMPAT SAAT INI: ${sc.name} — ${sc.desc} Sebut/rujuk suasana ini secara alami sesekali.`;
    const turns = hist().filter((m) => !m.error).slice(-24).map(({ role, content }) => ({ role, content }));
    return [{ role: 'system', content: sys }, ...turns];
  }

  function setBusy(b) {
    state.busy = b;
    $('btnSend').textContent = b ? 'Stop' : 'Kirim';
    $('headAvatar').classList.toggle('talking', b);
    $('input').disabled = false;
  }
  function stopStream() {
    if (state.abort) state.abort.abort();
  }

  async function send() {
    if (state.busy) return stopStream();
    const text = $('input').value.trim();
    if (!text) return;
    if (!state.config) { openSettings('Hubungkan LLM dulu agar hantunya bisa membalas.'); return; }

    $('input').value = '';
    autoGrow();
    const userMsg = { role: 'user', content: text };
    const botMsg = { role: 'assistant', content: '' };
    hist().push(userMsg, botMsg);
    const box = $('messages');
    box.querySelectorAll('.notice').forEach((n) => n.remove());
    box.appendChild(msgEl(userMsg));
    const botEl = msgEl(botMsg);
    box.appendChild(botEl);
    box.scrollTop = box.scrollHeight;
    const bubble = botEl.querySelector('.bubble');
    bubble.classList.add('typing');
    bubble.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';

    state.abort = new AbortController();
    setBusy(true);
    const msgs = buildMessages().slice(0, -1); // drop empty bot placeholder
    try {
      await window.LLM.stream(state.config, msgs, (d) => {
        botMsg.content += d;
        bubble.classList.remove('typing');
        bubble.innerHTML = md(botMsg.content);
        $('messages').scrollTop = $('messages').scrollHeight;
      }, state.abort.signal);
      if (!botMsg.content) botMsg.content = '*hening… hanya angin yang menjawab*';
    } catch (e) {
      if (e.name === 'AbortError') {
        if (!botMsg.content) botMsg.content = '*terpotong…*';
      } else {
        const hint = e instanceof TypeError
          ? 'Gagal terhubung. Periksa Base URL, koneksi, atau CORS endpoint (server harus mengizinkan permintaan dari browser).'
          : e.message;
        botMsg.content = '*sinyal gaib terputus…*\n\n⚠️ ' + hint;
        botMsg.error = true;
      }
    } finally {
      state.abort = null;
      setBusy(false);
      bubble.classList.remove('typing');
      bubble.innerHTML = md(botMsg.content);
      botEl.classList.toggle('err', !!botMsg.error);
      $('messages').scrollTop = $('messages').scrollHeight;
    }
  }

  function autoGrow() {
    const t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 140) + 'px';
  }

  /* ---------- settings / vault ---------- */
  function msg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'msg ' + (kind || '');
  }
  function openSettings(note) {
    const c = state.config || {};
    $('cfgBase').value = c.baseUrl || '';
    $('cfgKey').value = c.apiKey || '';
    $('cfgModel').value = c.model || '';
    $('cfgTemp').value = c.temperature ?? 0.9;
    $('tempVal').textContent = $('cfgTemp').value;
    $('cfgPass').value = '';
    const m = window.Vault.mode() || 'passphrase';
    document.querySelectorAll('input[name=mode]').forEach((r) => (r.checked = r.value === m));
    syncPassVisibility();
    msg($('settingsMsg'), typeof note === 'string' ? note : '', 'info');
    if (!$('settings').open) $('settings').showModal();
  }
  function syncPassVisibility() {
    const m = document.querySelector('input[name=mode]:checked').value;
    $('cfgPass').hidden = m !== 'passphrase';
  }

  async function saveSettings(e) {
    e.preventDefault();
    const cfg = {
      baseUrl: window.LLM.normalizeBase($('cfgBase').value),
      apiKey: $('cfgKey').value.trim(),
      model: $('cfgModel').value.trim(),
      temperature: Number($('cfgTemp').value),
    };
    if (!/^https?:\/\//i.test(cfg.baseUrl)) return msg($('settingsMsg'), 'Base URL harus diawali http:// atau https://', 'bad');
    if (!cfg.model) return msg($('settingsMsg'), 'Isi nama model.', 'bad');
    const mode = document.querySelector('input[name=mode]:checked').value;
    try {
      if (mode === 'none') {
        await window.Vault.wipe();
      } else {
        await window.Vault.save(cfg, mode, $('cfgPass').value);
      }
    } catch (err) {
      return msg($('settingsMsg'), err.message, 'bad');
    }
    state.config = cfg;
    $('cfgPass').value = '';
    $('settings').close();
    renderMessages();
  }

  async function fetchModels() {
    const cfg = { baseUrl: window.LLM.normalizeBase($('cfgBase').value), apiKey: $('cfgKey').value.trim() };
    if (!cfg.baseUrl) return msg($('settingsMsg'), 'Isi Base URL dulu.', 'bad');
    msg($('settingsMsg'), 'Mengambil daftar model…', 'info');
    try {
      const ids = await window.LLM.listModels(cfg);
      $('modelList').innerHTML = ids.map((i) => `<option value="${esc(i)}">`).join('');
      msg($('settingsMsg'), `${ids.length} model ditemukan. Pilih dari kolom Model.`, 'ok');
    } catch (e) {
      msg($('settingsMsg'), e instanceof TypeError ? 'Gagal terhubung (cek URL / CORS).' : e.message, 'bad');
    }
  }

  async function forgetAll() {
    if (!confirm('Hapus semua konfigurasi terenkripsi & kunci dari browser ini?')) return;
    await window.Vault.wipe();
    state.config = null;
    $('settings').close();
    renderMessages();
  }

  async function tryUnlock() {
    if (!window.Vault.exists()) return;
    if (window.Vault.mode() === 'device') {
      try { state.config = await window.Vault.load(); renderMessages(); } catch { /* ignore */ }
      return;
    }
    $('unlockPass').value = '';
    msg($('unlockMsg'), '');
    $('unlock').showModal();
    $('unlockPass').focus();
  }
  async function submitUnlock(e) {
    e.preventDefault();
    try {
      state.config = await window.Vault.load($('unlockPass').value);
      $('unlockPass').value = '';
      $('unlock').close();
      renderMessages();
    } catch (err) {
      msg($('unlockMsg'), err.message, 'bad');
    }
  }

  /* ---------- atmosphere ---------- */
  function lightning() {
    const f = $('flash');
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 120);
    setTimeout(() => { f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 90); }, 220);
    setTimeout(lightning, 25000 + Math.random() * 45000);
  }

  /* ---------- boot ---------- */
  function revealApp() {
    $('app').hidden = false;
    document.body.classList.add('ready');
    tryUnlock();
  }

  function approachGreeting(g, rarity) {
    return `*[${rarity.label}] Sinyal gaib terkunci. ${g.name} menghampirimu…*\n\n${g.greeting}`;
  }

  function startScan() {
    window.Scanner.open({
      onAccept(g, rarity) {
        state.sceneId = g.favScene;
        renderScene();
        // fresh encounter: reset this ghost's conversation with an approach greeting
        state.histories[g.id] = [];
        selectGhost(g.id, { greeting: approachGreeting(g, rarity), silent: true });
        revealApp();
      },
      onClose() {
        selectGhost(state.ghostId, { silent: true });
        revealApp();
      },
    });
  }

  function init() {
    const prefs = loadPrefs();
    if (prefs.scene && window.SCENES.some((s) => s.id === prefs.scene)) state.sceneId = prefs.scene;
    buildSceneBar();
    buildGhostList();
    renderScene();
    selectGhost(state.ghostId, { silent: true });

    $('composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    $('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    $('input').addEventListener('input', autoGrow);
    $('btnClear').addEventListener('click', () => {
      if (state.busy) stopStream();
      state.histories[state.ghostId] = [];
      selectGhost(state.ghostId, { silent: true });
    });
    $('btnSettings').addEventListener('click', () => openSettings());
    $('btnCancel').addEventListener('click', () => $('settings').close());
    $('settingsForm').addEventListener('submit', saveSettings);
    $('btnModels').addEventListener('click', fetchModels);
    $('btnForget').addEventListener('click', forgetAll);
    $('cfgTemp').addEventListener('input', () => ($('tempVal').textContent = $('cfgTemp').value));
    document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', syncPassVisibility));
    $('unlockForm').addEventListener('submit', submitUnlock);
    $('unlockSkip').addEventListener('click', () => $('unlock').close());
    $('btnScan').addEventListener('click', startScan);
    $('btnSound').addEventListener('click', async () => {
      const btn = $('btnSound');
      if (window.Sound.on) {
        window.Sound.disable();
        btn.firstChild.textContent = '🔇'; btn.setAttribute('aria-pressed', 'false');
      } else if (await window.Sound.enable(scene().ambience)) {
        btn.firstChild.textContent = '🔊'; btn.setAttribute('aria-pressed', 'true');
      }
    });

    setTimeout(lightning, 15000 + Math.random() * 20000);

    // First open: ghost scanner gacha intro.
    startScan();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
