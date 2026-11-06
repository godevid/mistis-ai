/* Mistis AI — "ghost radar" gacha scanner.
 * A purely cosmetic, client-side mock: it fakes a scan of nearby spirits, randomly picks one
 * (weighted by rarity) and makes it "approach" the user to start a chat. */
(function () {
  const $ = (id) => document.getElementById(id);

  // weight => rarity tier (higher weight = more common)
  const POOL = [
    { id: 'pocong', weight: 26 },
    { id: 'tuyul', weight: 24 },
    { id: 'babi', weight: 20 },
    { id: 'kuntilanak', weight: 18 },
    { id: 'wewe', weight: 14 },
    { id: 'sundel', weight: 12 },
    { id: 'genderuwo', weight: 12 },
    { id: 'kuyang', weight: 6 },
  ];
  function rarityOf(weight) {
    if (weight >= 24) return { key: 'common', label: 'UMUM', stars: '★' };
    if (weight >= 18) return { key: 'rare', label: 'LANGKA', stars: '★★' };
    if (weight >= 12) return { key: 'epic', label: 'EPIK', stars: '★★★' };
    return { key: 'legend', label: 'LEGENDARIS', stars: '★★★★' };
  }
  // Debug helpers: ?force=pocong&scene=graveyard pins the gacha result (useful for demos/tests).
  const qp = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
  function weightedPick() {
    const forced = POOL.find((p) => p.id === qp.get('force'));
    if (forced) return forced;
    const total = POOL.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;
    for (const p of POOL) {
      if ((r -= p.weight) <= 0) return p;
    }
    return POOL[0];
  }

  const LOG_LINES = [
    'Suhu turun 4°C di sekitarmu…',
    'Medan EMF berfluktuasi…',
    'Bau kembang melati samar terdeteksi…',
    'Suara anjing melolong di kejauhan…',
    'Bulu kuduk: meningkat 63%',
    'Sinyal tak dikenal mendekat dari arah barat…',
    'Lampu berkedip 3 kali. Bukan salah PLN.',
    'Kamu merasa ada yang memperhatikan…',
  ];

  let runId = 0;
  let current = null;
  let handlers = { onAccept: () => {}, onSettings: () => {} };

  const sleep = (ms, id) => new Promise((res) => setTimeout(() => res(id === runId), ms));

  function resetUI() {
    $('scanStatus').textContent = 'Siap memindai area sekitarmu.';
    $('scanBar').style.width = '0%';
    $('scanLog').innerHTML = '';
    $('blips').innerHTML = '';
    $('scanReveal').hidden = true;
    $('scanner').classList.remove('glitch', 'approach', 'scanning', 'revealed');
    $('radar').classList.remove('found');
    $('scanStart').hidden = false;
    $('scanAccept').hidden = true;
    $('scanAgain').hidden = true;
  }

  function addLog(text) {
    const li = document.createElement('li');
    li.textContent = '› ' + text;
    const ul = $('scanLog');
    ul.appendChild(li);
    while (ul.children.length > 4) ul.removeChild(ul.firstChild);
  }

  function polar(angle, dist) {
    const x = 50 + Math.cos(angle) * dist;
    const y = 50 + Math.sin(angle) * dist;
    return { x, y };
  }

  function addBlip(angle, dist, cls = '') {
    const el = document.createElement('div');
    el.className = 'blip ' + cls;
    const p = polar(angle, dist);
    el.style.left = p.x + '%';
    el.style.top = p.y + '%';
    $('blips').appendChild(el);
    return el;
  }

  async function run() {
    const id = ++runId;
    resetUI();
    $('scanStart').hidden = true;
    $('scanner').classList.add('scanning');
    await window.Sound.unlock(); // user gesture: start audio engine
    window.Sound.blip(660, 0.1, 0.05);

    // ---- Phase 1: scanning ----
    $('scanStatus').textContent = 'Memindai makhluk halus di sekitar…';
    const decoys = [];
    const steps = 22;
    const lines = [...LOG_LINES].sort(() => Math.random() - 0.5);
    for (let i = 1; i <= steps; i++) {
      if (!(await sleep(190, id))) return;
      $('scanBar').style.width = Math.round((i / steps) * 85) + '%';
      if (i % 5 === 0) addLog(lines[(i / 5 - 1) % lines.length]);
      if (i % 4 === 2 && decoys.length < 5) {
        const a = Math.random() * Math.PI * 2;
        const d = 14 + Math.random() * 30;
        decoys.push(addBlip(a, d, 'decoy'));
        window.Sound.blip(920, 0.06, 0.04);
        $('scanStatus').textContent = `Terdeteksi ${decoys.length} sinyal gaib…`;
      }
    }

    // ---- Phase 2: pick + approach ----
    const pick = weightedPick();
    const ghost = window.GHOSTS.find((g) => g.id === pick.id);
    const wantScene = qp.get('scene');
    const sceneId = window.SCENES.some((x) => x.id === wantScene) ? wantScene : ghost.scenes[Math.floor(Math.random() * ghost.scenes.length)];
    const sceneName = (window.SCENES.find((x) => x.id === sceneId) || {}).name || '';
    current = { ghost, rarity: rarityOf(pick.weight), sceneId };

    $('scanStatus').textContent = 'Satu sinyal bergerak ke arahmu…';
    decoys.forEach((b) => b.classList.add('fade'));
    const angle = Math.random() * Math.PI * 2;
    const target = addBlip(angle, 46, 'target');
    $('scanner').classList.add('approach');
    window.Sound.sting();

    const dists = [46, 38, 30, 22, 15, 9, 4, 0];
    for (let i = 0; i < dists.length; i++) {
      if (!(await sleep(520 - i * 30, id))) return;
      const p = polar(angle, dists[i]);
      target.style.left = p.x + '%';
      target.style.top = p.y + '%';
      const meters = Math.round(dists[i] * 0.9);
      $('scanStatus').textContent = `Sesuatu mendekat… ${meters} meter`;
      $('scanBar').style.width = 85 + Math.round(((i + 1) / dists.length) * 15) + '%';
      window.Sound.heartbeat();
      if (i >= 4) $('scanner').classList.add('glitch');
      if (i === 3) addLog('Lampu padam sesaat. Hawa dingin menusuk.');
      if (i === 6) addLog('Ada yang berbisik tepat di telingamu…');
    }
    if (!(await sleep(500, id))) return;

    // ---- Phase 3: reveal ----
    document.getElementById('flash').classList.add('on');
    setTimeout(() => document.getElementById('flash').classList.remove('on'), 400);
    window.Sound.sting();
    $('scanner').classList.remove('glitch');
    $('scanner').classList.add('revealed');
    $('radar').classList.add('found');
    $('scanStatus').textContent = '⚠ KONTAK!';

    const rev = $('scanReveal');
    rev.className = 'scan-reveal ' + current.rarity.key;
    $('revRarity').textContent = `${current.rarity.stars}  ${current.rarity.label}`;
    $('revAvatar').innerHTML = ghost.svg;
    $('revAvatar').classList.add('silhouette');
    $('revName').textContent = '???';
    $('revLoc').textContent = '';
    window.Sound.reveal(ghost.id);
    $('revText').textContent = 'Sosok itu berdiri tepat di depanmu…';
    rev.hidden = false;

    if (!(await sleep(1400, id))) return;
    $('revAvatar').classList.remove('silhouette');
    $('revName').textContent = ghost.name;
    $('revLoc').textContent = '📍 ' + sceneName;
    $('revText').textContent = `${ghost.title}. Ia muncul di ${sceneName} dan ingin bicara denganmu… tapi tidak akan lama.`;
    $('scanStatus').textContent = `${ghost.name} menghampirimu!`;
    $('scanBar').style.width = '100%';
    window.Sound.blip(196, 0.5, 0.07, 'triangle');
    $('scanAccept').hidden = false;
    $('scanAgain').hidden = false;
    $('scanAccept').textContent = `Terima & Bicara dengan ${ghost.name}`;
  }

  const Scanner = {
    open(h) {
      handlers = Object.assign(handlers, h || {});
      resetUI();
      if (h && h.message) $('scanStatus').textContent = h.message;
      $('scanner').classList.add('open');
    },
    close() {
      runId++; // cancel any running animation
      $('scanner').classList.remove('open');
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    $('scanStart').addEventListener('click', run);
    $('scanAgain').addEventListener('click', run);
    $('scanAccept').addEventListener('click', () => {
      const c = current;
      Scanner.close();
      if (c) handlers.onAccept(c.ghost, c.rarity, c.sceneId);
    });
    $('scanSettings').addEventListener('click', () => handlers.onSettings());
  });

  window.Scanner = Scanner;
})();
