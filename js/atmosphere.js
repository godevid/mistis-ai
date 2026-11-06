/* Mistis AI — atmosphere: procedural fog/clouds, film grain, dust, apparition placement & scripted effects. */
(function () {
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- tileable fBm noise -> data URL ---------- */
  function fbmCanvas(w, h, seed, o) {
    const cell = o.cell || 96, oct = o.oct || 5, gain = o.gain || 0.5;
    const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell) + 1;
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const layers = [];
    for (let k = 0; k < oct; k++) {
      const lw = gw * (1 << k), lh = gh * (1 << k);
      const g = new Float32Array(lw * lh);
      for (let i = 0; i < g.length; i++) g[i] = r();
      layers.push({ g, lw, lh });
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const sm = (t) => t * t * (3 - 2 * t);
    const [R, G, B] = o.color || [190, 200, 215];
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let v = 0, amp = 1, tot = 0;
        for (let k = 0; k < oct; k++) {
          const { g, lw, lh } = layers[k];
          const fx = (px / w) * lw, fy = (py / h) * (lh - 1);
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = sm(fx - x0), ty = sm(fy - y0);
          const xa = x0 % lw, xb = (x0 + 1) % lw; // wrap horizontally => seamless tile
          const ya = Math.min(y0, lh - 1), yb = Math.min(y0 + 1, lh - 1);
          const a = g[ya * lw + xa], b = g[ya * lw + xb], c2 = g[yb * lw + xa], d = g[yb * lw + xb];
          v += (a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty) * amp;
          tot += amp; amp *= gain;
        }
        v /= tot;
        const th = o.thresh ?? 0.4;
        let al = Math.max(0, (v - th) / (1 - th));
        al = Math.pow(al, o.pow || 1.3) * (o.alpha || 1);
        // vertical falloff for ground fog
        if (o.fade) al *= Math.pow(py / h, o.fade); // dense near the ground, soft top edge
        const i = (py * w + px) * 4;
        img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B;
        img.data[i + 3] = Math.min(255, al * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  const Atmos = {
    _inited: false,
    _timers: [],
    _tele: null,

    init() {
      if (this._inited) return;
      this._inited = true;
      try {
        const f1 = $('fog1'), f2 = $('fog2'), cl = $('clouds');
        if (f1) f1.style.backgroundImage = `url(${fbmCanvas(1024, 192, 7, { cell: 110, thresh: 0.38, alpha: 0.9, color: [170, 185, 205], fade: 0.6 })})`;
        if (f2) f2.style.backgroundImage = `url(${fbmCanvas(1024, 192, 91, { cell: 70, thresh: 0.42, alpha: 0.75, color: [150, 165, 190], fade: 0.9 })})`;
        if (cl) cl.style.backgroundImage = `url(${fbmCanvas(1024, 256, 33, { cell: 128, oct: 6, gain: 0.55, thresh: 0.47, alpha: 0.9, color: [120, 135, 165], pow: 1.6 })})`;
      } catch { /* decorative only */ }
      this._grain();
      this._dust();
    },

    _grain() {
      const c = $('grain');
      if (!c) return;
      const w = 480, h = 270;
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      const img = x.createImageData(w, h);
      const draw = () => {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
      };
      draw();
      if (!reduced) setInterval(draw, 90);
    },

    _dust() {
      const box = $('dust');
      if (!box) return;
      box.innerHTML = '';
      for (let i = 0; i < 28; i++) {
        const s = document.createElement('i');
        s.style.left = rnd(0, 100) + '%';
        s.style.top = rnd(10, 100) + '%';
        s.style.width = s.style.height = rnd(1, 3) + 'px';
        s.style.animationDuration = rnd(14, 38) + 's';
        s.style.animationDelay = -rnd(0, 30) + 's';
        s.style.opacity = rnd(0.15, 0.55);
        box.appendChild(s);
      }
    },

    /* ----- apparition ----- */
    showGhost(g) {
      const box = $('apparition');
      box.className = 'apparition ghost-' + g.id;
      $('apInner').innerHTML = g.svg;
      this.setProximity(0.2, true);
      requestAnimationFrame(() => box.classList.add('present'));
      this._teleportLoop();
    },

    /** p: 0 (far, faint) .. 1 (close, vivid) */
    setProximity(p, instant) {
      const box = $('apparition');
      p = Math.max(0, Math.min(1, p));
      box.style.setProperty('--s', (0.74 + p * 0.34).toFixed(3));
      box.style.setProperty('--o', (0.5 + p * 0.45).toFixed(3));
      box.style.setProperty('--b', ((1 - p) * 3.2).toFixed(2) + 'px');
      box.style.setProperty('--dx', (Math.sin(p * 6) * 2).toFixed(1) + 'vw');
      if (instant) { box.style.transition = 'none'; void box.offsetWidth; box.style.transition = ''; }
    },

    flash(ms = 120) {
      const f = $('flash');
      f.classList.add('on');
      setTimeout(() => f.classList.remove('on'), ms);
    },

    /** lights/vision stutter */
    flicker(ms = 1600) {
      const b = document.body;
      b.classList.add('flickering');
      const end = Date.now() + ms;
      const step = () => {
        if (Date.now() > end) { b.classList.remove('flickering', 'dim'); return; }
        b.classList.toggle('dim');
        this._timers.push(setTimeout(step, rnd(40, 180)));
      };
      step();
    },

    /** ghost reacts (first token of a reply): brief stutter + lunge */
    react() {
      const box = $('apparition');
      box.classList.remove('react'); void box.offsetWidth; box.classList.add('react');
      if (Math.random() < 0.55) this.flash(70);
    },

    glitch(ms = 420) {
      document.body.classList.add('glitch');
      setTimeout(() => document.body.classList.remove('glitch'), ms);
    },

    _teleportLoop() {
      clearTimeout(this._tele);
      const box = $('apparition');
      const tick = () => {
        if (!box.classList.contains('present')) return;
        // momentarily vanish, reappear slightly shifted/closer (jump-cut feel)
        box.classList.add('blink');
        this.glitch(160);
        setTimeout(() => {
          box.style.setProperty('--jx', rnd(-3, 3).toFixed(1) + 'vw');
          box.classList.remove('blink');
        }, rnd(180, 700));
        this._tele = setTimeout(tick, rnd(9000, 24000));
      };
      this._tele = setTimeout(tick, rnd(6000, 14000));
    },

    vanish() {
      clearTimeout(this._tele);
      const box = $('apparition');
      this.flicker(1500);
      box.classList.add('vanishing');
      this.glitch(600);
    },

    blackout(on) {
      $('blackout').classList.toggle('on', !!on);
    },

    clear() {
      clearTimeout(this._tele);
      this._timers.forEach(clearTimeout);
      this._timers = [];
      const box = $('apparition');
      box.className = 'apparition';
      $('apInner').innerHTML = '';
      document.body.classList.remove('flickering', 'dim', 'glitch');
    },
  };

  window.Atmos = Atmos;
})();
