/* Mistis AI — procedural night scenes (inline SVG, no external assets) */
(function () {
  const W = 1600, H = 900;

  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }
  const r2 = (n) => Math.round(n * 10) / 10;

  function sky(top, mid, bottom, moon) {
    const rnd = rng(7);
    let stars = '';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H * 0.5, s = rnd() * 1.6 + 0.4;
      stars += `<circle class="star" style="animation-delay:${r2(rnd() * 5)}s" cx="${r2(x)}" cy="${r2(y)}" r="${r2(s)}" fill="#fff"/>`;
    }
    const m = moon || { x: 1250, y: 150, r: 60, c: '#f3efd8' };
    return `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${bottom}"/>
      </linearGradient>
      <radialGradient id="moonGlow"><stop offset="0" stop-color="${m.c}" stop-opacity=".55"/><stop offset="1" stop-color="${m.c}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars}
    <circle cx="${m.x}" cy="${m.y}" r="${m.r * 4}" fill="url(#moonGlow)"/>
    <circle cx="${m.x}" cy="${m.y}" r="${m.r}" fill="${m.c}"/>
    <circle cx="${m.x - 18}" cy="${m.y - 10}" r="${m.r * 0.18}" fill="#000" opacity=".12"/>
    <circle cx="${m.x + 20}" cy="${m.y + 16}" r="${m.r * 0.12}" fill="#000" opacity=".12"/>
    <g class="clouds" opacity=".35" fill="#0a0d16">
      <ellipse cx="300" cy="140" rx="260" ry="26"/><ellipse cx="700" cy="220" rx="320" ry="22"/>
      <ellipse cx="1100" cy="90" rx="280" ry="20"/><ellipse cx="1450" cy="250" rx="240" ry="18"/>
    </g>`;
  }

  function tree(x, base, h, w, color, rnd, dead = true) {
    const top = base - h;
    let s = `<path d="M${x - w} ${base} Q${x - w * 0.4} ${base - h * 0.5} ${x - w * 0.3} ${top} L${x + w * 0.3} ${top} Q${x + w * 0.4} ${base - h * 0.5} ${x + w} ${base} Z" fill="${color}"/>`;
    const branches = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < branches; i++) {
      const by = top + rnd() * h * 0.7;
      const dir = rnd() > 0.5 ? 1 : -1;
      const len = 40 + rnd() * h * 0.35;
      const ex = x + dir * len, ey = by - 20 - rnd() * 60;
      s += `<path d="M${x} ${r2(by)} Q${r2(x + dir * len * 0.5)} ${r2(by - 10)} ${r2(ex)} ${r2(ey)}" stroke="${color}" stroke-width="${r2(w * 0.35)}" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M${r2(ex)} ${r2(ey)} l${dir * 24} ${-16 - rnd() * 18}" stroke="${color}" stroke-width="${r2(w * 0.18)}" fill="none" stroke-linecap="round"/>`;
    }
    if (!dead) {
      for (let i = 0; i < 6; i++) {
        s += `<ellipse cx="${r2(x + (rnd() - 0.5) * h * 0.5)}" cy="${r2(top + rnd() * 60)}" rx="${r2(50 + rnd() * 60)}" ry="${r2(24 + rnd() * 24)}" fill="${color}"/>`;
      }
    }
    return s;
  }

  function eyes(rnd, n, region) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = region.x0 + rnd() * (region.x1 - region.x0);
      const y = region.y0 + rnd() * (region.y1 - region.y0);
      const gap = 8 + rnd() * 6;
      const c = rnd() > 0.5 ? '#ff2a2a' : '#ffd36b';
      s += `<g class="eyes" style="animation-delay:${r2(rnd() * 9)}s"><ellipse cx="${r2(x)}" cy="${r2(y)}" rx="3.5" ry="2" fill="${c}"/><ellipse cx="${r2(x + gap)}" cy="${r2(y)}" rx="3.5" ry="2" fill="${c}"/></g>`;
    }
    return s;
  }

  function fireflies(rnd, n, region, color = '#c7ff7a') {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = region.x0 + rnd() * (region.x1 - region.x0);
      const y = region.y0 + rnd() * (region.y1 - region.y0);
      s += `<circle class="firefly" style="animation-delay:${r2(rnd() * 8)}s;animation-duration:${r2(5 + rnd() * 6)}s" cx="${r2(x)}" cy="${r2(y)}" r="${r2(1.5 + rnd() * 1.5)}" fill="${color}"/>`;
    }
    return s;
  }

  /* ---------------- Dark forest ---------------- */
  function forest() {
    const rnd = rng(11);
    let far = '', mid = '', near = '';
    for (let i = 0; i < 18; i++) far += tree(rnd() * W, 700, 260 + rnd() * 160, 10 + rnd() * 8, '#0b1018', rnd, rnd() > 0.5);
    for (let i = 0; i < 12; i++) mid += tree(rnd() * W, 780, 380 + rnd() * 220, 18 + rnd() * 12, '#070b10', rnd, rnd() > 0.6);
    for (let i = 0; i < 6; i++) near += tree(40 + i * 290 + rnd() * 120, 940, 760 + rnd() * 200, 36 + rnd() * 22, '#030507', rnd, true);
    return `
      ${sky('#02040a', '#070d18', '#0e1a22', { x: 1180, y: 160, r: 54, c: '#e9ecd6' })}
      <g>${far}</g>
      <rect y="690" width="${W}" height="220" fill="#06090d"/>
      <g>${mid}</g>
      ${eyes(rnd, 9, { x0: 60, x1: 1500, y0: 560, y1: 760 })}
      ${fireflies(rnd, 26, { x0: 0, x1: W, y0: 420, y1: 800 })}
      <path d="M0 800 Q400 760 800 800 T1600 790 L1600 900 L0 900 Z" fill="#030507"/>
      <g>${near}</g>`;
  }

  /* ---------------- Abandoned building ---------------- */
  function building() {
    const rnd = rng(23);
    let wins = '';
    const x0 = 430, y0 = 250, cols = 6, rows = 4, cw = 120, rh = 110;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + 30 + c * cw, y = y0 + 30 + r * rh;
        const v = rnd();
        if (v < 0.12) {
          wins += `<rect x="${x}" y="${y}" width="64" height="76" fill="#d9a441" class="lit" style="animation-delay:${r2(rnd() * 6)}s"/><path d="M${x} ${y} l64 76 M${x + 64} ${y} l-64 76" stroke="#1a1208" stroke-width="3"/>`;
        } else if (v < 0.5) {
          wins += `<rect x="${x}" y="${y}" width="64" height="76" fill="#020304"/><path d="M${x} ${y} l20 30 l-10 14 l30 4 l-6 28 M${x + 64} ${y} l-24 20 l12 16" stroke="#1d242b" stroke-width="3" fill="none"/>`;
        } else {
          wins += `<rect x="${x}" y="${y}" width="64" height="76" fill="#030507"/><rect x="${x + 4}" y="${y + 4}" width="56" height="68" fill="none" stroke="#141a20" stroke-width="2"/>`;
        }
      }
    }
    let vines = '';
    for (let i = 0; i < 14; i++) {
      const x = x0 + rnd() * 760, y = y0 + rnd() * 60;
      vines += `<path d="M${r2(x)} ${r2(y)} q${r2((rnd() - 0.5) * 40)} 80 ${r2((rnd() - 0.5) * 20)} ${r2(120 + rnd() * 200)}" stroke="#0f2a1a" stroke-width="${r2(2 + rnd() * 3)}" fill="none"/>`;
    }
    let weeds = '';
    for (let i = 0; i < 60; i++) {
      const x = rnd() * W;
      weeds += `<path d="M${r2(x)} 830 q${r2((rnd() - 0.5) * 20)} -${r2(20 + rnd() * 40)} ${r2((rnd() - 0.5) * 30)} -${r2(30 + rnd() * 50)}" stroke="#08130c" stroke-width="3" fill="none"/>`;
    }
    return `
      ${sky('#03050a', '#0a1018', '#14181e', { x: 260, y: 140, r: 48, c: '#dfe3ea' })}
      <path d="M0 760 L0 560 L120 520 L160 560 L260 500 L300 560 L360 540 L360 760 Z" fill="#06090d"/>
      <g>
        <path d="M${x0 - 20} 830 L${x0 - 20} ${y0} L${x0 + 140} ${y0 - 40} L${x0 + 200} ${y0 - 10} L${x0 + 360} ${y0 - 60} L${x0 + 520} ${y0 - 20} L${x0 + 640} ${y0 - 50} L${x0 + 740} ${y0} L${x0 + 760} ${y0 + 30} L${x0 + 760} 830 Z" fill="#0a0e13"/>
        <path d="M${x0 + 300} ${y0 - 58} l30 40 l-14 20 l40 10 l-10 30" stroke="#050709" stroke-width="5" fill="none"/>
        ${wins}
        <rect x="${x0 + 320}" y="690" width="90" height="140" fill="#010203"/>
        <path d="M${x0 + 320} 690 l45 -16 l45 16" fill="#050709"/>
        <path d="M${x0 + 100} 330 l-20 100 l30 6 l-10 90" stroke="#1b232b" stroke-width="3" fill="none" opacity=".6"/>
        ${vines}
        <path d="M${x0 - 20} 830 H${x0 + 760}" stroke="#000" stroke-width="6"/>
      </g>
      <g transform="translate(1180 520)"><g class="lamp">
        <line x1="0" y1="-40" x2="0" y2="0" stroke="#111" stroke-width="3"/>
        <ellipse cx="0" cy="10" rx="14" ry="10" fill="#e8c06a"/>
        <circle cx="0" cy="10" r="70" fill="#e8c06a" opacity=".08"/>
      </g></g>
      <path d="M1100 830 V520 H1180 M1180 520 V500" stroke="#050607" stroke-width="8" fill="none"/>
      ${eyes(rnd, 4, { x0: 480, x1: 1100, y0: 360, y1: 650 })}
      <path d="M0 830 H${W} V900 H0 Z" fill="#030405"/>
      <g>${weeds}</g>
      <g stroke="#0b0f13" stroke-width="3" fill="none" opacity=".9">
        ${Array.from({ length: 18 }, (_, i) => `<path d="M${i * 90} 850 V780 M${i * 90} 800 H${i * 90 + 90}"/>`).join('')}
      </g>
      ${fireflies(rnd, 8, { x0: 0, x1: W, y0: 600, y1: 820 }, '#9fe3c5')}`;
  }

  /* ---------------- Indonesian graveyard (kuburan) ---------------- */
  function nisan(x, y, s, rnd) {
    const t = r2((rnd() - 0.5) * 14);
    const kind = rnd();
    let g = `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${t}) scale(${s})">`;
    // gundukan tanah
    g += `<ellipse cx="0" cy="12" rx="62" ry="14" fill="#0a0c0a"/><path d="M-50 12 Q0 -20 50 12 Z" fill="#0d110c"/>`;
    if (kind < 0.45) { // nisan batu lengkung
      g += `<path d="M-14 0 V-70 Q0 -92 14 -70 V0 Z" fill="#2a2f33"/><path d="M-6 -62 h12 M-6 -50 h12" stroke="#14181a" stroke-width="3"/>`;
    } else if (kind < 0.8) { // nisan kayu
      g += `<rect x="-6" y="-80" width="12" height="82" fill="#2b1f15"/><rect x="-18" y="-66" width="36" height="9" fill="#2b1f15"/>`;
    } else { // salib
      g += `<rect x="-5" y="-86" width="10" height="90" fill="#1e2226"/><rect x="-22" y="-64" width="44" height="9" fill="#1e2226"/>`;
    }
    // bunga tabur
    g += `<circle cx="-18" cy="6" r="3" fill="#eee"/><circle cx="-8" cy="2" r="2.5" fill="#f2c94c"/><circle cx="12" cy="4" r="3" fill="#eee"/><circle cx="22" cy="8" r="2.5" fill="#eee"/>`;
    return g + '</g>';
  }

  function kamboja(x, base, h, rnd) {
    let s = `<path d="M${x - 10} ${base} Q${x - 24} ${base - h * 0.5} ${x - 4} ${base - h} L${x + 8} ${base - h} Q${x + 24} ${base - h * 0.5} ${x + 10} ${base} Z" fill="#0b0d0a"/>`;
    for (let i = 0; i < 7; i++) {
      const dir = i % 2 ? 1 : -1;
      const by = base - h * (0.5 + rnd() * 0.5);
      const ex = x + dir * (50 + rnd() * 90), ey = by - 30 - rnd() * 60;
      s += `<path d="M${x} ${r2(by)} Q${r2(x + dir * 30)} ${r2(by - 20)} ${r2(ex)} ${r2(ey)}" stroke="#0b0d0a" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      for (let j = 0; j < 4; j++) {
        s += `<circle class="bloom" style="animation-delay:${r2(rnd() * 5)}s" cx="${r2(ex + (rnd() - 0.5) * 36)}" cy="${r2(ey + (rnd() - 0.5) * 26)}" r="${r2(4 + rnd() * 3)}" fill="#f6efe0" opacity=".85"/>`;
      }
    }
    return s;
  }

  function graveyard() {
    const rnd = rng(37);
    let stones = '';
    const rows = [
      { y: 640, s: 0.55, n: 9 },
      { y: 720, s: 0.8, n: 7 },
      { y: 810, s: 1.1, n: 5 },
    ];
    rows.forEach((row) => {
      for (let i = 0; i < row.n; i++) {
        stones += nisan((i + 0.3 + rnd() * 0.5) * (W / row.n), row.y + rnd() * 18, row.s, rnd);
      }
    });
    // pocong samar jauh di kejauhan
    const ghostShape = `<g class="faraway" transform="translate(760 560)" opacity=".18">
      <path d="M-14 0 Q-16 -40 0 -44 Q16 -40 14 0 L18 52 Q0 60 -18 52 Z" fill="#e9e5d4"/><circle cx="0" cy="-30" r="1.6" fill="#000"/>
    </g>`;
    return `
      ${sky('#04030a', '#0d0a18', '#1b1422', { x: 1280, y: 170, r: 66, c: '#f1e5c8' })}
      <path d="M0 560 Q300 520 620 560 T1220 540 T1600 560 V900 H0 Z" fill="#0a0c0a"/>
      <path d="M0 600 Q400 570 900 610 T1600 600 V900 H0 Z" fill="#0c0f0b"/>
      ${kamboja(180, 640, 220, rnd)}
      ${kamboja(1380, 650, 250, rnd)}
      <g class="beringin">
        <path d="M770 640 Q750 480 790 360 Q820 300 880 300 Q940 310 960 380 Q990 500 960 640 Z" fill="#050607"/>
        <ellipse cx="860" cy="290" rx="220" ry="90" fill="#050607"/>
        ${Array.from({ length: 22 }, (_, i) => `<path class="root" style="animation-delay:${r2(rnd() * 4)}s" d="M${700 + i * 20} 320 q${r2((rnd() - 0.5) * 20)} 120 ${r2((rnd() - 0.5) * 12)} ${r2(160 + rnd() * 200)}" stroke="#050607" stroke-width="3" fill="none"/>`).join('')}
      </g>
      ${ghostShape}
      <g>${stones}</g>
      <g class="candles">
        ${[300, 620, 1010, 1240].map((x, i) => `<g transform="translate(${x} ${790 + (i % 2) * 40})"><rect x="-3" y="-14" width="6" height="14" fill="#e8dcc0"/><ellipse class="flame" cx="0" cy="-20" rx="3" ry="6" fill="#ffb347"/><circle cx="0" cy="-20" r="26" fill="#ffb347" opacity=".08"/></g>`).join('')}
      </g>
      ${eyes(rnd, 3, { x0: 100, x1: 1500, y0: 520, y1: 600 })}
      ${fireflies(rnd, 14, { x0: 0, x1: W, y0: 500, y1: 820 }, '#9ee8d0')}
      <path d="M0 860 Q400 830 800 860 T1600 850 V900 H0 Z" fill="#020302"/>`;
  }

  /* ---------------- Beringin tua di perempatan desa ---------------- */
  function beringin() {
    const rnd = rng(53);
    let roots = '';
    for (let i = 0; i < 46; i++) {
      const x = 380 + rnd() * 840;
      const len = 120 + rnd() * 420;
      roots += `<path class="root" style="animation-delay:${r2(rnd() * 5)}s" d="M${r2(x)} 240 q${r2((rnd() - 0.5) * 30)} ${r2(len * 0.5)} ${r2((rnd() - 0.5) * 16)} ${r2(len)}" stroke="#08090a" stroke-width="${r2(2 + rnd() * 4)}" fill="none"/>`;
    }
    return `
      ${sky('#03040a', '#0b1020', '#1a1a26', { x: 240, y: 130, r: 52, c: '#f3efd8' })}
      <path d="M0 640 Q500 610 1000 640 T1600 630 V900 H0 Z" fill="#0b0d0b"/>
      <g>
        <path d="M690 700 Q700 560 730 440 Q640 400 600 520 Q560 640 480 700 Z" fill="#050606"/>
        <path d="M910 700 Q900 560 870 440 Q960 400 1000 520 Q1040 640 1120 700 Z" fill="#050606"/>
        <path d="M730 700 Q740 440 770 300 H830 Q860 440 870 700 Z" fill="#070808"/>
        <ellipse cx="800" cy="220" rx="480" ry="150" fill="#050606"/>
        <ellipse cx="560" cy="290" rx="240" ry="100" fill="#050606"/>
        <ellipse cx="1040" cy="290" rx="240" ry="100" fill="#050606"/>
        ${roots}
      </g>
      <!-- sesajen -->
      <g transform="translate(980 790)">
        <ellipse cx="0" cy="8" rx="46" ry="10" fill="#000" opacity=".5"/>
        <path d="M-34 0 L34 0 L28 -16 L-28 -16 Z" fill="#3a2a18"/>
        <circle cx="-14" cy="-20" r="6" fill="#e8c06a"/><circle cx="6" cy="-20" r="5" fill="#d93b3b"/><circle cx="18" cy="-19" r="5" fill="#f5f2e6"/>
        <rect x="-3" y="-44" width="5" height="24" fill="#e8dcc0"/>
        <ellipse class="flame" cx="0" cy="-50" rx="3" ry="7" fill="#ffb347"/><circle cx="0" cy="-50" r="40" fill="#ffb347" opacity=".09"/>
        <path class="smoke" d="M20 -22 q-12 -24 6 -44 q16 -20 -4 -50" stroke="#aaa" stroke-width="3" fill="none" opacity=".35"/>
      </g>
      <!-- gardu ronda -->
      <g transform="translate(250 740)">
        <path d="M-90 0 H90 V-110 H-90 Z" fill="#0b0e10"/><path d="M-110 -110 L0 -170 L110 -110 Z" fill="#06080a"/>
        <rect x="-60" y="-80" width="44" height="50" fill="#e8c06a" class="lit"/><circle cx="-38" cy="-55" r="90" fill="#e8c06a" opacity=".06"/>
        <path d="M-90 0 V30 M90 0 V30" stroke="#0b0e10" stroke-width="10"/>
      </g>
      <path d="M0 800 Q500 770 1100 810 T1600 800 V900 H0 Z" fill="#090806"/>
      <path d="M-100 900 Q600 770 1000 780 T1700 840 L1700 900 Z" fill="#14100c" opacity=".7"/>
      ${eyes(rnd, 4, { x0: 400, x1: 1200, y0: 300, y1: 600 })}
      ${fireflies(rnd, 16, { x0: 0, x1: W, y0: 380, y1: 820 }, '#ffe08a')}`;
  }

  /* ---------------- Rawa / sungai Kalimantan ---------------- */
  function rawa() {
    const rnd = rng(71);
    let mangrove = '';
    for (let i = 0; i < 16; i++) {
      const x = rnd() * W, h = 120 + rnd() * 160;
      mangrove += `<g fill="none" stroke="#050808" stroke-width="5"><path d="M${r2(x)} 600 q-20 ${-h * 0.5} ${r2(-(rnd() - 0.5) * 30)} ${-h}"/><path d="M${r2(x)} 600 q20 ${-h * 0.4} ${r2((rnd() - 0.5) * 40)} ${-h * 0.8}"/><path d="M${r2(x)} 600 q-6 ${-h * 0.6} ${r2((rnd() - 0.5) * 20)} ${-h * 1.1}"/></g>
        <ellipse cx="${r2(x)}" cy="${r2(600 - h)}" rx="${r2(60 + rnd() * 40)}" ry="${r2(24 + rnd() * 20)}" fill="#050808"/>`;
    }
    let ripples = '';
    for (let i = 0; i < 20; i++) {
      ripples += `<ellipse class="ripple" style="animation-delay:${r2(rnd() * 6)}s" cx="${r2(rnd() * W)}" cy="${r2(650 + rnd() * 220)}" rx="${r2(30 + rnd() * 80)}" ry="${r2(3 + rnd() * 5)}" fill="none" stroke="#6b7c8c" stroke-width="1.2"/>`;
    }
    return `
      ${sky('#02050a', '#07121b', '#102230', { x: 1150, y: 150, r: 58, c: '#f0ecd0' })}
      <rect y="600" width="${W}" height="300" fill="#050b11"/>
      <rect x="${1150 - 30}" y="600" width="60" height="300" fill="#f0ecd0" opacity=".12" class="reflect"/>
      <g>${mangrove}</g>
      <!-- rumah panggung -->
      <g transform="translate(360 600)">
        <path d="M-120 0 V-40 H120 V0 Z" fill="#0a0d0f"/>
        <path d="M-100 -40 H100 V-150 H-100 Z" fill="#0c1013"/>
        <path d="M-130 -150 L0 -230 L130 -150 Z" fill="#06080a"/>
        <rect x="-70" y="-120" width="40" height="46" fill="#e8c06a" class="lit"/><rect x="26" y="-120" width="40" height="46" fill="#e8c06a" class="lit" style="animation-delay:1.3s"/>
        <circle cx="-50" cy="-96" r="120" fill="#e8c06a" opacity=".05"/>
        <path d="M-100 0 V70 M-50 0 V70 M0 0 V70 M50 0 V70 M100 0 V70" stroke="#0a0d0f" stroke-width="9"/>
        <path d="M-120 -40 H-210 V0 H-120" fill="#0a0d0f"/>
      </g>
      <path d="M0 680 H${W} V900 H0 Z" fill="#050c13" opacity=".6"/>
      <!-- jukung -->
      <g transform="translate(1000 760)"><g class="boat">
        <path d="M-120 0 Q0 30 120 0 L90 -20 L-90 -20 Z" fill="#03060a"/>
        <path d="M-10 -20 V-80 M-10 -80 L40 -30" stroke="#03060a" stroke-width="4" fill="none"/>
      </g></g>
      ${ripples}
      <!-- cahaya kuyang kecil -->
      <circle class="firefly" cx="780" cy="500" r="5" fill="#ff9a3c" style="animation-duration:7s"/>
      <circle class="firefly" cx="1300" cy="440" r="4" fill="#ff9a3c" style="animation-duration:9s;animation-delay:2s"/>
      ${fireflies(rnd, 18, { x0: 0, x1: W, y0: 380, y1: 700 }, '#b6ffa0')}
      ${eyes(rnd, 3, { x0: 100, x1: 1500, y0: 640, y1: 720 })}`;
  }

  /* ---------------- Sekolah terbengkalai ---------------- */
  function school() {
    const rnd = rng(91);
    let wins = '';
    for (let i = 0; i < 9; i++) {
      const x = 250 + i * 128, v = rnd();
      if (i === 5) {
        wins += `<rect x="${x}" y="540" width="84" height="84" fill="#d9c07a" class="lit"/><path d="M${x + 42} 540 V624 M${x} 582 H${x + 84}" stroke="#1a1208" stroke-width="3"/>
          <g class="faraway" opacity=".5"><circle cx="${x + 42}" cy="586" r="9" fill="#000"/><rect x="${x + 33}" y="595" width="18" height="29" fill="#000"/></g>`;
      } else if (v < 0.5) {
        wins += `<rect x="${x}" y="540" width="84" height="84" fill="#020304"/><path d="M${x} 540 l26 36 l-12 20 l40 8 M${x + 84} 540 l-30 24" stroke="#1d242b" stroke-width="3" fill="none"/>`;
      } else {
        wins += `<rect x="${x}" y="540" width="84" height="84" fill="#030507"/><path d="M${x + 42} 540 V624 M${x} 582 H${x + 84}" stroke="#151b21" stroke-width="3"/>`;
      }
    }
    let weeds = '';
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W;
      weeds += `<path d="M${r2(x)} 840 q${r2((rnd() - 0.5) * 20)} -${r2(20 + rnd() * 40)} ${r2((rnd() - 0.5) * 30)} -${r2(30 + rnd() * 60)}" stroke="#07120a" stroke-width="3" fill="none"/>`;
    }
    return `
      ${sky('#03040a', '#0a0f1a', '#161b24', { x: 1350, y: 140, r: 50, c: '#e6e9ee' })}
      <g>${tree(120, 800, 380, 24, '#050709', rnd, true)}${tree(1540, 800, 340, 22, '#050709', rnd, true)}</g>
      <rect x="180" y="500" width="1240" height="340" fill="#0b0f13"/>
      <path d="M160 500 L800 420 L1440 500 Z" fill="#06080a"/>
      <path d="M520 460 l30 40 l-18 14 M980 440 l-16 36 l24 10 M1180 470 l10 30" stroke="#0b0f13" stroke-width="12" stroke-linecap="round"/>
      <rect x="200" y="520" width="1200" height="14" fill="#06080a"/>
      ${wins}
      <rect x="760" y="690" width="100" height="150" fill="#010203"/>
      <path d="M760 690 l50 -14 l50 14" fill="#050709"/>
      <text x="810" y="520" font-size="26" fill="#2a3138" text-anchor="middle" opacity=".7" font-family="serif">SDN 03</text>
      <!-- tiang bendera + bendera compang-camping -->
      <g transform="translate(1390 840)">
        <rect x="-4" y="-420" width="8" height="420" fill="#0a0c10"/>
        <g class="flag"><path d="M4 -410 H118 L104 -392 L120 -378 L96 -360 L110 -346 L4 -346 Z" fill="#7d0f1a"/>
        <path d="M4 -378 H104 L96 -360 L110 -346 L4 -346 Z" fill="#cfcfd3" opacity=".85"/></g>
      </g>
      <!-- ayunan -->
      <g transform="translate(330 840)" stroke="#0a0c10" stroke-width="7" fill="none">
        <path d="M-70 0 L-34 -150 L34 -150 L70 0 M-34 -150 H34"/>
        <g class="swing"><path d="M-12 -150 V-52 M12 -150 V-52" stroke-width="3"/><rect x="-18" y="-52" width="36" height="8" fill="#0a0c10"/></g>
      </g>
      ${eyes(rnd, 3, { x0: 260, x1: 1300, y0: 560, y1: 660 })}
      <path d="M0 840 H${W} V900 H0 Z" fill="#030405"/>
      <g>${weeds}</g>
      ${fireflies(rnd, 10, { x0: 0, x1: W, y0: 600, y1: 830 }, '#b6f0d6')}`;
  }

  /* ---------------- Jembatan tua ---------------- */
  function bridge() {
    const rnd = rng(113);
    let posts = '';
    for (let i = 0; i <= 24; i++) posts += `<rect x="${i * 70 - 6}" y="520" width="8" height="46" fill="#05070a"/>`;
    let pillars = '';
    for (let i = 0; i < 5; i++) pillars += `<rect x="${140 + i * 340}" y="590" width="44" height="320" fill="#06080b"/>`;
    return `
      ${sky('#02040a', '#0a1220', '#18222e', { x: 330, y: 150, r: 56, c: '#e9ecd6' })}
      <path d="M0 520 L220 400 L420 490 L700 360 L960 470 L1200 380 L1600 500 V620 H0 Z" fill="#070b11"/>
      <rect y="600" width="${W}" height="300" fill="#050b12"/>
      <rect x="${330 - 28}" y="600" width="56" height="300" fill="#e9ecd6" opacity=".1" class="reflect"/>
      ${pillars}
      <g>
        <rect x="0" y="560" width="${W}" height="30" fill="#080a0e"/>
        <rect x="0" y="566" width="${W}" height="5" fill="#141922"/>
        ${posts}
        <rect x="0" y="518" width="${W}" height="8" fill="#05070a"/>
        <path d="M0 520 H${W}" stroke="#0a0d12" stroke-width="3"/>
      </g>
      <g transform="translate(1180 560)">
        <rect x="-3" y="-190" width="6" height="190" fill="#05070a"/>
        <path d="M0 -190 q24 0 24 14" stroke="#05070a" stroke-width="5" fill="none"/>
        <ellipse class="lit" cx="24" cy="-168" rx="12" ry="7" fill="#e8c06a"/>
        <circle cx="24" cy="-160" r="100" fill="#e8c06a" opacity=".07"/>
      </g>
      <!-- sosok putih di ujung jembatan -->
      <g class="faraway" transform="translate(360 554)">
        <path d="M-12 0 Q-14 -44 0 -48 Q14 -44 12 0 Z" fill="#eee" opacity=".7"/>
        <path d="M-10 -44 Q-18 -10 -14 12 M10 -44 Q18 -10 14 12" stroke="#000" stroke-width="4" fill="none"/>
      </g>
      ${Array.from({ length: 16 }, (_, i) => `<ellipse class="ripple" style="animation-delay:${r2(rnd() * 6)}s" cx="${r2(rnd() * W)}" cy="${r2(660 + rnd() * 200)}" rx="${r2(30 + rnd() * 90)}" ry="${r2(3 + rnd() * 5)}" fill="none" stroke="#6b7c8c" stroke-width="1.2"/>`).join('')}
      ${eyes(rnd, 2, { x0: 100, x1: 1500, y0: 700, y1: 800 })}
      ${fireflies(rnd, 10, { x0: 0, x1: W, y0: 380, y1: 560 }, '#d6f0a0')}`;
  }

  /* ---------------- Rumah joglo tua & sumur ---------------- */
  function joglo() {
    const rnd = rng(131);
    let pillars = '';
    for (let i = 0; i < 6; i++) pillars += `<rect x="${420 + i * 140}" y="520" width="22" height="260" fill="#0a0806"/>`;
    return `
      ${sky('#03040a', '#0c0f1c', '#1a1a24', { x: 1330, y: 150, r: 58, c: '#f1e5c8' })}
      <path d="M0 700 Q400 660 800 700 T1600 690 V900 H0 Z" fill="#0a0c08"/>
      <g>
        <!-- atap joglo bertingkat -->
        <path d="M300 520 L1300 520 L1160 400 L440 400 Z" fill="#0d0a08"/>
        <path d="M440 400 L1160 400 L1020 300 L580 300 Z" fill="#090706"/>
        <path d="M580 300 L1020 300 L880 220 L720 220 Z" fill="#060504"/>
        <path d="M800 200 V170 M770 190 H830" stroke="#060504" stroke-width="6"/>
        <path d="M600 520 l-8 40 M900 520 l8 36 M1100 520 l-6 44" stroke="#050403" stroke-width="5"/>
        <rect x="360" y="520" width="880" height="260" fill="#0c0907"/>
        ${pillars}
        <rect x="480" y="560" width="640" height="220" fill="#030201"/>
        <rect x="700" y="590" width="50" height="60" fill="#e8b65a" class="lit"/><circle cx="725" cy="620" r="120" fill="#e8b65a" opacity=".07"/>
        <path d="M700 590 v-14 M750 590 v-14" stroke="#070504" stroke-width="3"/>
        <rect x="340" y="780" width="920" height="26" fill="#080605"/>
      </g>
      <!-- sumur tua -->
      <g transform="translate(1340 800)">
        <ellipse cx="0" cy="10" rx="70" ry="12" fill="#000" opacity=".5"/>
        <path d="M-52 0 V-40 Q0 -62 52 -40 V0 Z" fill="#14161a"/>
        <ellipse cx="0" cy="-40" rx="52" ry="14" fill="#020203"/>
        <path d="M-52 -40 V-150 M52 -40 V-150 M-52 -150 H52" stroke="#0a0806" stroke-width="8" fill="none"/>
        <g class="swing"><path d="M0 -150 V-90" stroke="#1a1612" stroke-width="3"/><path d="M-14 -90 h28 l-4 24 h-20 Z" fill="#2a2018"/></g>
        <ellipse class="glow" cx="0" cy="-40" rx="26" ry="6" fill="#7cf2c0" opacity=".14"/>
      </g>
      <!-- pohon pisang -->
      <g stroke="#05100a" stroke-width="5" fill="none">
        ${[120, 220].map((x) => `<path d="M${x} 800 V640"/><path d="M${x} 640 q-70 -20 -90 40 M${x} 640 q70 -20 90 40 M${x} 640 q-30 -70 -70 -50 M${x} 640 q30 -70 70 -50"/>`).join('')}
      </g>
      <!-- kentongan -->
      <g transform="translate(290 780)"><rect x="-10" y="-70" width="20" height="70" fill="#1a1208" rx="6"/><rect x="-4" y="-56" width="8" height="40" fill="#050301"/></g>
      ${eyes(rnd, 3, { x0: 460, x1: 1100, y0: 600, y1: 740 })}
      <path d="M0 800 Q500 770 1000 810 T1600 800 V900 H0 Z" fill="#070605"/>
      <path d="M-100 900 Q600 790 1000 800 T1700 850 L1700 900 Z" fill="#100d09" opacity=".7"/>
      ${fireflies(rnd, 14, { x0: 0, x1: W, y0: 500, y1: 840 }, '#ffe08a')}`;
  }

  /* ---------------- Bukit Gombel ---------------- */
  function bukit() {
    const rnd = rng(157);
    let lights = '';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = 640 + rnd() * 120;
      lights += `<circle class="star" style="animation-delay:${r2(rnd() * 4)}s" cx="${r2(x)}" cy="${r2(y)}" r="${r2(1 + rnd() * 1.4)}" fill="${rnd() > 0.7 ? '#ffd38a' : '#fff1c6'}"/>`;
    }
    return `
      ${sky('#02030a', '#0a0f1e', '#1b1c2a', { x: 1180, y: 190, r: 62, c: '#f3e8c8' })}
      <path d="M0 520 Q300 430 640 500 T1280 470 T1600 520 V900 H0 Z" fill="#070a10"/>
      <rect y="640" width="${W}" height="140" fill="#0b0e18" opacity=".6"/>
      ${lights}
      <path d="M0 640 Q300 590 700 640 T1600 620 V900 H0 Z" fill="#06090b"/>
      <!-- jalan berkelok ke atas bukit -->
      <path d="M520 900 Q760 800 640 740 Q500 690 820 640 Q1080 600 860 560 Q760 540 880 500" stroke="#1a1d24" stroke-width="64" fill="none" stroke-linecap="round" opacity=".9"/>
      <path d="M520 900 Q760 800 640 740 Q500 690 820 640 Q1080 600 860 560 Q760 540 880 500" stroke="#2a2f3a" stroke-width="3" stroke-dasharray="18 22" fill="none"/>
      <!-- pohon besar di puncak -->
      <g>
        ${tree(900, 520, 360, 26, '#030406', rnd, true)}
        <ellipse cx="900" cy="190" rx="180" ry="46" fill="#030406"/>
        ${Array.from({ length: 14 }, (_, i) => `<path class="root" style="animation-delay:${r2(rnd() * 5)}s" d="M${760 + i * 22} 210 q${r2((rnd() - 0.5) * 20)} 90 ${r2((rnd() - 0.5) * 12)} ${r2(120 + rnd() * 160)}" stroke="#030406" stroke-width="3" fill="none"/>`).join('')}
      </g>
      <!-- sosok nenek samar -->
      <g class="faraway" transform="translate(760 604)"><path d="M-9 0 Q-14 -24 -2 -30 Q10 -26 9 0 Z" fill="#cfcfd8"/><path d="M-6 -30 q-6 -8 -10 -4 M6 -30 q8 -6 12 -2" stroke="#e8e8f0" stroke-width="3" fill="none"/></g>
      <g>${tree(150, 900, 560, 38, '#020304', rnd, true)}${tree(1480, 900, 520, 34, '#020304', rnd, true)}</g>
      <path d="M0 860 Q400 820 800 850 T1600 840 V900 H0 Z" fill="#020304"/>
      ${eyes(rnd, 3, { x0: 100, x1: 1500, y0: 600, y1: 800 })}
      ${fireflies(rnd, 14, { x0: 0, x1: W, y0: 520, y1: 840 }, '#c7ff7a')}`;
  }

  window.SCENES = [
    { id: 'forest', name: 'Hutan Gelap', icon: '🌲', desc: 'Pohon tua, mata menyala di balik gelap, kunang-kunang.', build: forest, ambience: { freq: 420, gain: 0.05 } },
    { id: 'building', name: 'Bangunan Kosong', icon: '🏚️', desc: 'Gedung terbengkalai dengan jendela pecah dan lampu berkedip.', build: building, ambience: { freq: 260, gain: 0.06 } },
    { id: 'graveyard', name: 'Kuburan', icon: '⚰️', desc: 'Nisan miring, kembang kamboja, beringin tua, lilin kecil.', build: graveyard, ambience: { freq: 340, gain: 0.05 } },
    { id: 'beringin', name: 'Beringin Perempatan', icon: '🕯️', desc: 'Beringin raksasa, sesajen, dan gardu ronda sepi.', build: beringin, ambience: { freq: 300, gain: 0.05 } },
    { id: 'rawa', name: 'Rawa Borneo', icon: '🛶', desc: 'Rumah panggung di sungai gelap, jukung, mangrove.', build: rawa, ambience: { freq: 500, gain: 0.04 } },
    { id: 'school', name: 'Sekolah Angker', icon: '🏫', desc: 'Sekolah SD terbengkalai, bendera lusuh, ayunan berderit.', build: school, ambience: { freq: 280, gain: 0.05 } },
    { id: 'bridge', name: 'Jembatan Tua', icon: '🌉', desc: 'Jembatan sepi di atas sungai berkabut, lampu jalan berkedip.', build: bridge, ambience: { freq: 450, gain: 0.05 } },
    { id: 'joglo', name: 'Joglo & Sumur', icon: '🛖', desc: 'Rumah joglo tua, lampu teplok, sumur dan kentongan.', build: joglo, ambience: { freq: 240, gain: 0.05 } },
    { id: 'bukit', name: 'Bukit Gombel', icon: '⛰', desc: 'Jalan berkelok di bukit, pohon raksasa, lampu kota di bawah.', build: bukit, ambience: { freq: 520, gain: 0.05 } },
  ];

  window.renderScene = function (id) {
    const sc = window.SCENES.find((s) => s.id === id) || window.SCENES[0];
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${sc.build()}</svg>`;
  };
})();
