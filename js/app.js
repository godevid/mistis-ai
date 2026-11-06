/* Mistis AI — main app: scanner -> encounter (ghost + location chosen by gacha) -> timed departure -> scanner */
(function () {
  const $ = (id) => document.getElementById(id);
  const PREFS_KEY = 'mistis.prefs.v1'; // non-sensitive prefs only
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  /** How long a ghost stays (ms). Random in this range. Debug: ?stay=15-30 (seconds). */
  const STAY = (() => {
    try {
      const q = new URLSearchParams(location.search).get('stay');
      if (q) {
        const [a, b] = q.split('-').map(Number);
        if (a > 0) return [a * 1000, (b >= a ? b : a) * 1000];
      }
    } catch { /* ignore */ }
    return [150000, 330000];
  })();

  const OMENS = [
    '*Lampu seakan berkedip. Suhu turun drastis — napasmu mengepul.*',
    '*Angin berhenti seketika. Hening yang tidak wajar menekan telinga.*',
    '*Bulu kudukmu berdiri. Sosok itu terasa… lebih dekat dari sebelumnya.*',
    '*Terdengar bisikan tepat di belakang telingamu, lalu lenyap.*',
    '*Bayangan di sekelilingmu bergerak sendiri, memanjang ke arahmu.*',
  ];

  const state = {
    ghostId: null,
    sceneId: 'graveyard',
    config: null, // { baseUrl, apiKey, model, temperature } — memory only
    histories: {}, // ghostId -> messages; persisted only (encrypted) if the user opts in
    abort: null,
    busy: false,
    saveHistory: false,
    historyReady: false,
    persistTimer: null,
    soundOn: true,
    encounter: null,
    eid: 0,
  };

  const ghost = () => window.GHOSTS.find((g) => g.id === state.ghostId);
  const scene = () => window.SCENES.find((s) => s.id === state.sceneId);
  const hist = () => (state.histories[state.ghostId] ||= []);

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ saveHistory: state.saveHistory, sound: state.soundOn })); } catch { /* ignore */ }
  }

  /* ---------- scene ---------- */
  function renderScene() {
    $('scene').innerHTML = window.renderScene(state.sceneId);
  }

  /* ---------- messages ---------- */
  function msgEl(m) {
    if (m.role === 'narrator') {
      const n = document.createElement('div');
      n.className = 'narr' + (m.alarm ? ' alarm' : '');
      n.innerHTML = esc(m.content.replace(/^\*+|\*+$/g, '')).replace(/\n/g, '<br>');
      return n;
    }
    const d = document.createElement('div');
    d.className = 'msg ' + (m.role === 'user' ? 'me' : 'bot') + (m.error ? ' err' : '');
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = md(m.content || '');
    d.appendChild(b);
    return d;
  }
  function renderMessages() {
    if (!state.ghostId) return;
    const box = $('messages');
    box.innerHTML = '';
    hist().forEach((m) => box.appendChild(msgEl(m)));
    const locked = window.Vault.exists() && !window.Vault.hasKey();
    if (!state.config || locked) {
      const n = document.createElement('div');
      n.className = 'notice';
      if (locked) {
        n.innerHTML = 'Brankas terkunci' + (state.saveHistory ? ' — riwayat tersimpan belum dimuat' : '') + '. <button type="button" data-a="unlock">Buka brankas</button>';
      } else {
        n.innerHTML = 'Belum ada LLM terhubung. <button type="button" data-a="cfg">Hubungkan sekarang</button>';
      }
      box.appendChild(n);
      n.querySelector('button').addEventListener('click', (e) => (e.target.dataset.a === 'unlock' ? tryUnlock() : openSettings()));
    }
    box.scrollTop = box.scrollHeight;
  }
  function pushNarr(text, alarm) {
    const m = { role: 'narrator', content: text, local: true, alarm: !!alarm };
    hist().push(m);
    const box = $('messages');
    box.querySelectorAll('.notice').forEach((n) => n.remove());
    box.appendChild(msgEl(m));
    box.scrollTop = box.scrollHeight;
    schedulePersist();
  }

  function systemPrompt() {
    const g = ghost(), sc = scene();
    return `${g.system}\n\nLOKASI PERTEMUAN MALAM INI: ${sc.name} — ${sc.desc} Sebut/rujuk suasana lokasi ini secara alami sesekali. Waktumu bersama pengguna terbatas dan bisa berakhir mendadak.`;
  }
  function buildMessages() {
    const turns = hist()
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content && !m.error)
      .slice(-24)
      .map(({ role, content }) => ({ role, content }));
    return [{ role: 'system', content: systemPrompt() }, ...turns];
  }

  function setBusy(b) {
    state.busy = b;
    $('btnSend').textContent = b ? 'Stop' : 'Kirim';
  }
  function stopStream() {
    if (state.abort) state.abort.abort();
  }

  async function send() {
    if (state.busy) return stopStream();
    if (!state.encounter || state.encounter.departing) return;
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
    let first = true;
    const msgs = buildMessages();
    try {
      await window.LLM.stream(state.config, msgs, (d) => {
        if (first) { first = false; window.Atmos.react(); window.Sound.accent(state.ghostId); }
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
      schedulePersist();
    }
  }

  function autoGrow() {
    const t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 140) + 'px';
  }

  /* ---------- encounter lifecycle ---------- */
  function approachLine(g, sc, rarity, returning) {
    return returning
      ? `*${g.name} muncul lagi di ${sc.name}…*`
      : `*[${rarity.label}] Sinyal gaib terkunci di ${sc.name}. ${g.name} menghampirimu…*`;
  }

  function beginEncounter(g, sceneId, rarity) {
    clearEncounterTimers();
    state.ghostId = g.id;
    state.sceneId = sceneId;
    const sc = scene();
    const id = ++state.eid;

    renderScene();
    window.Atmos.showGhost(g);
    window.Sound.start(sceneId, g.id);
    window.Sound.arrive(g.id);
    $('status').innerHTML = `📍 ${esc(sc.name)} · <b>${esc(g.name)}</b>`;
    $('quick').innerHTML = '';
    g.quick.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => { $('input').value = q; send(); });
      $('quick').appendChild(b);
    });

    const h = (state.histories[g.id] ||= []);
    const returning = h.some((m) => m.role === 'user');
    if (!returning) h.length = 0;
    h.push({ role: 'narrator', content: approachLine(g, sc, rarity, returning), local: true, approach: true });

    $('app').hidden = false;
    $('input').disabled = false;
    $('btnSend').disabled = false;
    $('btnLeave').disabled = false;
    renderMessages();
    updatePrivacy();

    const duration = rand(STAY[0], STAY[1]);
    const enc = { id, start: Date.now(), duration, departing: false, timers: [], tick: null };
    state.encounter = enc;

    if (!returning) {
      enc.timers.push(setTimeout(() => {
        if (state.encounter !== enc || enc.departing) return;
        hist().push({ role: 'assistant', content: g.greeting, local: true, approach: true });
        renderMessages();
        window.Atmos.react();
        window.Sound.accent(g.id);
        schedulePersist();
      }, 3000));
    }

    enc.tick = setInterval(() => {
      if (state.encounter !== enc) return;
      window.Atmos.setProximity(0.2 + 0.8 * Math.min(1, (Date.now() - enc.start) / enc.duration));
    }, 1500);

    // omens, then departure
    const omenAt = Math.max(duration * 0.55, duration - 30000);
    enc.timers.push(setTimeout(() => omen(enc), omenAt));
    if (duration > 60000) enc.timers.push(setTimeout(() => omen(enc, true), duration - 9000));
    enc.timers.push(setTimeout(() => depart(), duration));
    // occasional lightning-like flash
    const lightning = () => {
      if (state.encounter !== enc || enc.departing) return;
      window.Atmos.flash(110);
      enc.timers.push(setTimeout(() => window.Atmos.flash(80), 210));
      enc.timers.push(setTimeout(lightning, rand(30000, 70000)));
    };
    enc.timers.push(setTimeout(lightning, rand(20000, 40000)));

    schedulePersist();
  }

  function clearEncounterTimers() {
    const e = state.encounter;
    if (!e) return;
    e.timers.forEach(clearTimeout);
    clearInterval(e.tick);
  }

  function omen(enc, light) {
    if (state.encounter !== enc || enc.departing) return;
    pushNarr(OMENS[Math.floor(Math.random() * OMENS.length)], true);
    window.Atmos.flicker(light ? 1200 : 2200);
    window.Atmos.glitch(light ? 200 : 320);
    window.Sound.omen();
  }

  async function typeInto(el, text) {
    el.classList.remove('typing');
    for (let i = 1; i <= text.length; i += 2) {
      el.innerHTML = md(text.slice(0, i));
      $('messages').scrollTop = $('messages').scrollHeight;
      await sleep(26);
    }
    el.innerHTML = md(text);
  }

  async function speakGoodbye(g, f) {
    const botMsg = { role: 'assistant', content: '', farewell: true };
    hist().push(botMsg);
    const box = $('messages');
    const el = msgEl(botMsg);
    box.appendChild(el);
    const bubble = el.querySelector('.bubble');
    bubble.classList.add('typing');
    bubble.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    box.scrollTop = box.scrollHeight;
    window.Atmos.react();
    let got = '';
    if (state.config) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 11000);
      try {
        const msgs = buildMessages();
        msgs.push({ role: 'user', content: `[KEJADIAN DI SEKITARMU — jangan sebut kata "kejadian"] ${f.llm} Ucapkan perpisahan singkat (maksimal 2 kalimat, tetap dalam karakter, jangan menjelaskan aturan), lalu kamu pergi.` });
        await window.LLM.stream(state.config, msgs, (d) => {
          got += d;
          bubble.classList.remove('typing');
          bubble.innerHTML = md(got);
          box.scrollTop = box.scrollHeight;
        }, ac.signal);
      } catch { /* fall back to scripted line */ }
      clearTimeout(to);
    }
    if (!got.trim()) {
      got = f.goodbye;
      await typeInto(bubble, got);
    }
    botMsg.content = got;
    bubble.classList.remove('typing');
    bubble.innerHTML = md(got);
    window.Sound.accent(g.id);
    schedulePersist();
  }

  /** The ghost flees / vanishes (scripted scenario) and we return to the scanner menu. */
  async function depart(opts = {}) {
    const enc = state.encounter;
    if (!enc || enc.departing) return;
    if (!opts.quick && (state.busy || document.querySelector('dialog[open]'))) {
      enc.timers.push(setTimeout(() => depart(opts), 4000)); // wait: don't cut a reply or a dialog
      return;
    }
    enc.departing = true;
    enc.timers.forEach(clearTimeout);
    clearInterval(enc.tick);
    if (state.busy) stopStream();
    $('input').disabled = true;
    $('btnSend').disabled = true;
    $('btnLeave').disabled = true;

    const g = ghost(), f = g.farewell, sc = scene();
    try {
      if (!opts.quick) {
        pushNarr(f.scenario, true);
        window.Sound.omen();
        window.Sound.cue(g.id);
        window.Atmos.flicker(2800);
        window.Atmos.glitch(500);
        await sleep(3400);
        await speakGoodbye(g, f);
        await sleep(1400);
        pushNarr(f.gone);
        window.Sound.leave(g.id);
        window.Atmos.vanish();
        await sleep(5200);
      } else {
        pushNarr('*Kamu memutus pertemuan. Sosok itu menoleh sekali lagi, lalu lenyap tanpa suara…*');
        window.Sound.leave(g.id);
        window.Atmos.vanish();
        await sleep(3400);
      }
      window.Atmos.blackout(true);
      window.Sound.stop(2);
      await sleep(1600);
    } finally {
      state.encounter = null;
      $('app').hidden = true;
      window.Atmos.clear();
      $('scene').innerHTML = '';
      window.Scanner.open({ message: `${g.name} menghilang dari ${sc.name}. Pindai lagi untuk memanggil makhluk lain.` });
      setTimeout(() => window.Atmos.blackout(false), 80);
      schedulePersist();
    }
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
    $('cfgHistory').checked = state.saveHistory;
    syncPassVisibility();
    msg($('settingsMsg'), typeof note === 'string' ? note : '', 'info');
    if (!$('settings').open) $('settings').showModal();
  }
  function syncPassVisibility() {
    const m = document.querySelector('input[name=mode]:checked').value;
    $('cfgPass').hidden = m !== 'passphrase';
    $('cfgHistory').disabled = m === 'none';
    if (m === 'none') $('cfgHistory').checked = false;
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
    const wantHistory = mode !== 'none' && $('cfgHistory').checked;
    // Saved history exists but could not be decrypted this session: changing keys would orphan it.
    const orphan = window.Vault.hasBlob('history') && !state.historyReady;
    if (orphan && !confirm('Riwayat terenkripsi yang tersimpan belum dibuka di sesi ini. Menyimpan pengaturan akan menghapusnya permanen. Lanjutkan?')) return;
    if (mode === 'none' && window.Vault.hasBlob('history') && !orphan &&
        !confirm('Mode "Sesi saja" juga menghapus riwayat obrolan tersimpan. Lanjutkan?')) return;
    try {
      if (mode === 'none') {
        await window.Vault.wipe();
      } else {
        await window.Vault.save(cfg, mode, $('cfgPass').value);
      }
      if (orphan) window.Vault.removeBlob('history');
      state.saveHistory = wantHistory;
      savePrefs();
      if (wantHistory) {
        state.historyReady = true;
        await persistNow(); // re-encrypt in-memory history with the (possibly new) key
      } else {
        window.Vault.removeBlob('history');
        state.historyReady = false;
      }
    } catch (err) {
      return msg($('settingsMsg'), err.message, 'bad');
    }
    state.config = cfg;
    $('cfgPass').value = '';
    $('settings').close();
    updatePrivacy();
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
    state.saveHistory = false;
    state.historyReady = false;
    savePrefs();
    updatePrivacy();
    $('settings').close();
    renderMessages();
  }

  async function tryUnlock() {
    if (!window.Vault.exists() || window.Vault.hasKey()) return; // nothing stored, or already unlocked
    if (window.Vault.mode() === 'device') {
      try { state.config = await window.Vault.load(); await loadHistory(); renderMessages(); } catch { /* ignore */ }
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
      await loadHistory();
      $('unlock').close();
      renderMessages();
    } catch (err) {
      msg($('unlockMsg'), err.message, 'bad');
    }
  }
  /** First thing on page load: unlock the vault (if any) before the scanner appears. */
  function unlockFlow() {
    return new Promise((resolve) => {
      if (!window.Vault.exists() || window.Vault.hasKey()) return resolve();
      if (window.Vault.mode() === 'device') {
        window.Vault.load().then((c) => { state.config = c; return loadHistory(); }).catch(() => {}).finally(resolve);
        return;
      }
      $('unlock').addEventListener('close', () => resolve(), { once: true });
      tryUnlock();
    });
  }

  /* ---------- encrypted local history ---------- */
  function updatePrivacy() {
    $('privacyNote').textContent = state.saveHistory
      ? '🔒 Kunci API & riwayat obrolan dienkripsi (AES-256) dan hanya tersimpan di browser ini. Tidak ada yang dikirim ke server Mistis AI.'
      : '🔒 Kunci API dienkripsi & hanya tersimpan di browser ini. Obrolan tidak disimpan ke mana pun.';
  }
  function serializeHistory() {
    const ghosts = {};
    for (const [id, list] of Object.entries(state.histories)) {
      const clean = list.filter((m) => m.content).slice(-200).map(({ role, content, error, local, approach, alarm }) => {
        const o = { role, content };
        if (error) o.error = true;
        if (local) o.local = true;
        if (approach) o.approach = true;
        if (alarm) o.alarm = true;
        return o;
      });
      if (clean.length) ghosts[id] = clean;
    }
    return { v: 2, savedAt: Date.now(), ghosts };
  }
  async function persistNow() {
    if (!state.saveHistory || !state.historyReady || !window.Vault.hasKey()) return;
    await window.Vault.saveBlob('history', serializeHistory());
  }
  function schedulePersist() {
    clearTimeout(state.persistTimer);
    state.persistTimer = setTimeout(() => { persistNow().catch(() => {}); }, 400);
  }
  async function loadHistory() {
    if (!state.saveHistory || !window.Vault.hasKey()) return;
    if (!window.Vault.hasBlob('history')) { state.historyReady = true; return; }
    try {
      const data = await window.Vault.loadBlob('history');
      for (const [id, msgs] of Object.entries((data && data.ghosts) || {})) {
        if (!window.GHOSTS.some((g) => g.id === id) || !Array.isArray(msgs)) continue;
        const cur = state.histories[id] || [];
        const fresh = cur.filter((m) => m.role === 'user' || m.approach);
        state.histories[id] = [...msgs, ...fresh];
      }
      state.historyReady = true;
    } catch {
      state.historyReady = false;
    }
  }

  /* ---------- boot ---------- */
  function startScan(message) {
    window.Scanner.open({
      message,
      onAccept(g, rarity, sceneId) { beginEncounter(g, sceneId, rarity); },
      onSettings() { openSettings(); },
    });
  }

  function syncSoundBtn() {
    const b = $('btnSound');
    b.firstElementChild.textContent = state.soundOn ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(state.soundOn));
  }

  async function init() {
    const prefs = loadPrefs();
    state.saveHistory = !!prefs.saveHistory && window.Vault.exists();
    state.soundOn = prefs.sound !== false;
    window.Sound.setEnabled(state.soundOn);
    syncSoundBtn();
    updatePrivacy();
    window.Atmos.init();

    $('composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    $('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    $('input').addEventListener('input', autoGrow);
    $('btnLeave').addEventListener('click', () => depart({ quick: true }));
    $('btnSettings').addEventListener('click', () => openSettings());
    $('btnCancel').addEventListener('click', () => $('settings').close());
    $('settingsForm').addEventListener('submit', saveSettings);
    $('btnModels').addEventListener('click', fetchModels);
    $('btnForget').addEventListener('click', forgetAll);
    $('btnWipeHistory').addEventListener('click', () => {
      if (!window.Vault.hasBlob('history') && !state.saveHistory) return msg($('settingsMsg'), 'Tidak ada riwayat tersimpan.', 'info');
      if (!confirm('Hapus riwayat obrolan tersimpan di browser ini? (Obrolan yang sedang tampil tidak terhapus)')) return;
      window.Vault.removeBlob('history');
      msg($('settingsMsg'), 'Riwayat tersimpan dihapus.', 'ok');
    });
    $('cfgTemp').addEventListener('input', () => ($('tempVal').textContent = $('cfgTemp').value));
    document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', syncPassVisibility));
    $('unlockForm').addEventListener('submit', submitUnlock);
    $('unlockSkip').addEventListener('click', () => $('unlock').close());
    $('btnSound').addEventListener('click', async () => {
      state.soundOn = !state.soundOn;
      if (state.soundOn) await window.Sound.unlock();
      window.Sound.setEnabled(state.soundOn);
      syncSoundBtn();
      savePrefs();
    });

    await unlockFlow();
    startScan();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
