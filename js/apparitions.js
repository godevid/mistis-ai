/* Mistis AI — realistic apparitions.
 * Procedurally rendered (no image assets): lit cloth, mottled skin, hair/fur strands, soft focus, moon rim light.
 * They are designed to be composited into the dark scene (fog, grain, flicker) rather than shown as flat icons. */
(function () {
  const VB = '0 0 300 440';

  function rng(seed) {
    let s = (seed * 9301 + 49297) % 233280;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  }
  const f1 = (n) => Math.round(n * 10) / 10;

  /* ---------- shared defs ---------- */
  const DEFS = `<defs>
    <filter id="apCloth" x="-15%" y="-10%" width="130%" height="125%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.034" numOctaves="4" seed="5" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="3.6" diffuseConstant="1.15" lighting-color="#efe9d6" result="l"><feDistantLight azimuth="235" elevation="46"/></feDiffuseLighting>
      <feComposite in="l" in2="SourceAlpha" operator="in" result="lit"/>
      <feBlend in="lit" in2="SourceGraphic" mode="multiply"/>
    </filter>
    <filter id="apFur" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.09 0.2" numOctaves="3" seed="12" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="3.2" diffuseConstant="1" lighting-color="#8a7f78" result="l"><feDistantLight azimuth="300" elevation="38"/></feDiffuseLighting>
      <feComposite in="l" in2="SourceAlpha" operator="in" result="lit"/>
      <feBlend in="lit" in2="SourceGraphic" mode="multiply"/>
    </filter>
    <filter id="apEdge" x="-12%" y="-12%" width="124%" height="124%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="9" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="8" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="apSkin" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="4" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 .1  0 0 0 0 .12  0 0 0 0 .1  0 0 0 -1.1 .95" result="spots"/>
      <feComposite in="spots" in2="SourceAlpha" operator="in" result="sp"/>
      <feBlend in="sp" in2="SourceGraphic" mode="multiply"/>
    </filter>
    <filter id="apB1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="apB2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="apB4" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="apB9" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
    <radialGradient id="apFace" cx=".45" cy=".38" r=".8"><stop offset="0" stop-color="#d6d9cd"/><stop offset=".55" stop-color="#97a093"/><stop offset="1" stop-color="#3e453f"/></radialGradient>
    <radialGradient id="apFaceWarm" cx=".45" cy=".38" r=".8"><stop offset="0" stop-color="#cdbfae"/><stop offset=".6" stop-color="#8f8173"/><stop offset="1" stop-color="#3a322c"/></radialGradient>
    <radialGradient id="apFaceOld" cx=".45" cy=".38" r=".8"><stop offset="0" stop-color="#bdb09c"/><stop offset=".6" stop-color="#7d7160"/><stop offset="1" stop-color="#2f2a23"/></radialGradient>
    <radialGradient id="apFaceGreen" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#a7b293"/><stop offset=".6" stop-color="#667258"/><stop offset="1" stop-color="#262d22"/></radialGradient>
    <linearGradient id="apRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#c4d6ff" stop-opacity=".3"/></linearGradient>
    <linearGradient id="apFadeG" x1="0" y1="0" x2="0" y2="1"><stop offset=".68" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="apFade"><rect width="300" height="440" fill="url(#apFadeG)"/></mask>
    <radialGradient id="apEmber" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".85"/><stop offset="1" stop-color="#ff5a14" stop-opacity="0"/></radialGradient>
    <radialGradient id="apCandle" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd48a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    <linearGradient id="apGut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a0409"/><stop offset=".35" stop-color="#8a1a26"/><stop offset=".55" stop-color="#c4424e"/><stop offset="1" stop-color="#3a060c"/></linearGradient>
  </defs>`;

  /* ---------- helpers ---------- */
  function strands(n, o) {
    const r = rng(o.seed || 1);
    let s = '';
    for (let i = 0; i < n; i++) {
      const t = r();
      const sx = o.x0 + (o.x1 - o.x0) * t + (r() - 0.5) * (o.jit || 6);
      const sy = o.y0 + (o.y1 - o.y0) * t;
      const ex = sx + (r() - 0.5) * o.spread + (o.drift || 0);
      const ey = sy + o.len * (0.65 + r() * 0.5);
      const cx = sx + (r() - 0.5) * o.spread * 0.9 + (o.drift || 0) * 0.5;
      const cy = (sy + ey) / 2;
      const light = r() > 0.88;
      s += `<path d="M${f1(sx)} ${f1(sy)} Q${f1(cx)} ${f1(cy)} ${f1(ex)} ${f1(ey)}" stroke="${light ? (o.hl || '#3a4150') : o.color}" stroke-width="${f1((o.w || 1.3) * (0.5 + r()))}" fill="none" opacity="${f1((o.op || 0.85) * (0.45 + r() * 0.55))}" stroke-linecap="round"/>`;
    }
    return s;
  }

  function bristles(cx, cy, rx, ry, a0, a1, n, len, o) {
    const r = rng(o.seed || 3);
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * r();
      const bx = cx + Math.cos(a) * rx * (0.92 + r() * 0.1);
      const by = cy + Math.sin(a) * ry * (0.92 + r() * 0.1);
      const l = len * (0.5 + r());
      const jx = (r() - 0.5) * 0.7;
      const ex = bx + Math.cos(a + jx) * l;
      const ey = by + Math.sin(a + jx) * l;
      s += `<path d="M${f1(bx)} ${f1(by)} L${f1(ex)} ${f1(ey)}" stroke="${o.color}" stroke-width="${f1((o.w || 1.5) * (0.5 + r()))}" opacity="${f1(0.5 + r() * 0.5)}" stroke-linecap="round"/>`;
    }
    return s;
  }

  function face(cx, cy, rx, ry, o = {}) {
    const ey = cy - ry * 0.12, ex = rx * 0.43;
    const grad = o.grad || 'apFace';
    return `<g class="ap-face">
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${grad})" filter="url(#apSkin)"/>
      <ellipse cx="${cx - rx * 0.62}" cy="${cy + ry * 0.2}" rx="${rx * 0.2}" ry="${ry * 0.34}" fill="#000" opacity=".28" filter="url(#apB2)"/>
      <ellipse cx="${cx + rx * 0.62}" cy="${cy + ry * 0.2}" rx="${rx * 0.2}" ry="${ry * 0.34}" fill="#000" opacity=".2" filter="url(#apB2)"/>
      <ellipse cx="${cx - ex}" cy="${ey}" rx="${rx * 0.3}" ry="${ry * 0.22}" fill="#020303" opacity="${o.socket ?? 0.95}" filter="url(#apB2)"/>
      <ellipse cx="${cx + ex}" cy="${ey}" rx="${rx * 0.3}" ry="${ry * 0.22}" fill="#020303" opacity="${o.socket ?? 0.95}" filter="url(#apB2)"/>
      <g class="ap-eyes">
        <ellipse cx="${cx - ex}" cy="${ey + 1}" rx="${rx * 0.13}" ry="${ry * 0.07}" fill="${o.eye || '#0b0b0b'}"/>
        <ellipse cx="${cx + ex}" cy="${ey + 1}" rx="${rx * 0.13}" ry="${ry * 0.07}" fill="${o.eye || '#0b0b0b'}"/>
        <circle cx="${cx - ex + rx * 0.04}" cy="${ey - 0.5}" r="${o.glint ?? 1.1}" fill="${o.glintColor || '#cfe6e0'}" opacity=".8"/>
        <circle cx="${cx + ex + rx * 0.04}" cy="${ey - 0.5}" r="${o.glint ?? 1.1}" fill="${o.glintColor || '#cfe6e0'}" opacity=".8"/>
      </g>
      <path d="M${cx} ${cy - ry * 0.02} Q${cx - rx * 0.1} ${cy + ry * 0.28} ${cx + rx * 0.02} ${cy + ry * 0.32}" stroke="#000" stroke-opacity=".38" stroke-width="${rx * 0.12}" fill="none" filter="url(#apB1)"/>
      <path d="M${cx - rx * 0.34} ${cy + ry * 0.58} Q${cx} ${cy + ry * (o.smile ?? 0.64)} ${cx + rx * 0.34} ${cy + ry * 0.58}" stroke="${o.mouth || '#1a0b0d'}" stroke-width="${f1(ry * 0.055)}" fill="none" stroke-linecap="round"/>
      ${o.blood ? `<path d="M${cx - ex} ${ey + ry * 0.12} q-2 ${ry * 0.5} 1 ${ry * 0.95} M${cx + ex} ${ey + ry * 0.12} q3 ${ry * 0.4} 0 ${ry * 0.8}" stroke="#6b0a14" stroke-width="1.6" fill="none" opacity=".8" filter="url(#apB1)"/>` : ''}
    </g>`;
  }

  const ground = (rx = 70) => `<ellipse class="ap-shadow" cx="150" cy="422" rx="${rx}" ry="9" fill="#000" opacity=".7" filter="url(#apB4)"/>`;

  function svg(inner, cls) {
    return `<svg viewBox="${VB}" class="ap ${cls}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DEFS}${inner}</svg>`;
  }

  /* ---------- Pocong ---------- */
  function pocong() {
    const body = 'M94 150 C90 84 116 66 150 66 C184 66 210 84 206 150 L230 388 C192 416 108 416 70 388 Z';
    return svg(`
      ${ground(78)}
      <g class="ap-hop">
        <g filter="url(#apEdge)">
          <path d="${body}" fill="#b4ae98" filter="url(#apCloth)"/>
          <path d="${body}" fill="url(#apRim)"/>
          <path d="M124 82 C126 44 138 22 150 4 C162 22 174 44 176 82 Z" fill="#aaa48e" filter="url(#apCloth)"/>
          <path d="M138 8 q-14 14 -16 30 M162 8 q14 14 16 30" stroke="#8c866f" stroke-width="3" fill="none" opacity=".7"/>
        </g>
        <path d="M120 84 Q150 98 180 84" stroke="#4f3f26" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M120 84 Q150 98 180 84" stroke="#9a8454" stroke-width="1.4" fill="none" stroke-dasharray="2 3" opacity=".8"/>
        <ellipse cx="150" cy="130" rx="38" ry="46" fill="#0a0c08" filter="url(#apB2)"/>
        ${face(150, 133, 26, 34, { grad: 'apFaceGreen', socket: 0.98, blood: true, mouth: '#120808' })}
        <path d="M108 190 Q150 206 192 190" stroke="#4f3f26" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M108 190 Q150 206 192 190" stroke="#9a8454" stroke-width="1.4" fill="none" stroke-dasharray="2 3" opacity=".8"/>
        <path d="M78 372 Q150 392 222 372" stroke="#4f3f26" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M78 372 Q150 392 222 372" stroke="#9a8454" stroke-width="1.4" fill="none" stroke-dasharray="2 3" opacity=".8"/>
        <ellipse cx="120" cy="300" rx="20" ry="34" fill="#3a2a14" opacity=".35" filter="url(#apB4)"/>
        <ellipse cx="176" cy="350" rx="26" ry="22" fill="#2a1a0c" opacity=".4" filter="url(#apB4)"/>
        <path d="M168 170 q4 30 -2 60" stroke="#4a0a10" stroke-width="5" opacity=".45" fill="none" filter="url(#apB2)"/>
        <rect x="60" y="392" width="180" height="30" fill="#05070a" opacity=".55" filter="url(#apB4)"/>
      </g>`, 'ap-pocong');
  }

  /* ---------- Kuntilanak ---------- */
  function kuntilanak() {
    return svg(`
      ${ground(66)}
      <g class="ap-float" mask="url(#apFade)">
        <g class="ap-hair" filter="url(#apEdge)">
          <path d="M150 38 C70 34 62 150 74 250 C80 310 62 370 54 430 L246 430 C238 370 220 310 226 250 C238 150 230 34 150 38 Z" fill="#050507"/>
          ${strands(150, { x0: 90, x1: 210, y0: 44, y1: 64, spread: 38, len: 360, color: '#08080b', hl: '#3b4252', w: 1.6, seed: 4, drift: -2 })}
        </g>
        <path d="M110 176 C98 220 84 330 66 424 L234 424 C216 330 202 220 190 176 Q150 160 110 176 Z" fill="#c9c5b8" filter="url(#apCloth)"/>
        <path d="M110 176 C98 220 84 330 66 424 L234 424 C216 330 202 220 190 176 Q150 160 110 176 Z" fill="url(#apRim)"/>
        <path d="M100 190 C70 230 66 290 76 340" stroke="#bdb9ac" stroke-width="15" stroke-linecap="round" fill="none" filter="url(#apCloth)"/>
        <path d="M200 190 C230 230 234 290 224 340" stroke="#bdb9ac" stroke-width="15" stroke-linecap="round" fill="none" filter="url(#apCloth)"/>
        <g stroke="#9ea49a" stroke-width="3.2" stroke-linecap="round" opacity=".95"><path d="M70 344 l-4 26 M76 346 l0 30 M82 345 l5 26 M219 344 l4 26 M224 346 l0 30 M230 344 l-5 26"/></g>
        <rect x="136" y="150" width="28" height="34" fill="#9aa095" filter="url(#apB1)"/>
        <g transform="rotate(-7 150 96)">
          ${face(150, 96, 31, 42, { grad: 'apFace', socket: 0.98, blood: true })}
          <path d="M150 52 C112 54 112 150 124 200 C114 150 126 100 130 70 Z M150 52 C188 54 188 150 176 200 C186 150 174 100 170 70 Z" fill="#050507"/>
          <g class="ap-hair">${strands(110, { x0: 118, x1: 182, y0: 54, y1: 70, spread: 30, len: 120, color: '#07070a', hl: '#38404f', w: 1.5, seed: 8 })}</g>
          <path d="M132 40 C140 30 160 30 168 40 L172 72 C160 60 140 60 128 72 Z" fill="#050507"/>
        </g>
        <g fill="#f4f1e8" opacity=".95"><circle cx="190" cy="76" r="4"/><circle cx="196" cy="82" r="3"/><circle cx="186" cy="83" r="3"/></g>
      </g>`, 'ap-kunti');
  }

  /* ---------- Genderuwo ---------- */
  function genderuwo() {
    const torso = 'M60 440 L52 250 C46 170 86 128 150 128 C214 128 254 170 248 250 L240 440 Z';
    return svg(`
      ${ground(110)}
      <g class="ap-breathe">
        <g filter="url(#apEdge)">
          <path d="M46 440 C20 340 28 230 66 190 L72 300 L66 440 Z" fill="#150f0c" filter="url(#apFur)"/>
          <path d="M254 440 C280 340 272 230 234 190 L228 300 L234 440 Z" fill="#150f0c" filter="url(#apFur)"/>
          <path d="${torso}" fill="#1c1410" filter="url(#apFur)"/>
          <path d="${torso}" fill="url(#apRim)"/>
        </g>
        <g>${bristles(150, 270, 100, 140, Math.PI * 1.02, Math.PI * 1.98, 190, 16, { color: '#0e0907', w: 2, seed: 7 })}${bristles(150, 270, 98, 140, Math.PI * 1.1, Math.PI * 1.9, 120, 26, { color: '#1a110d', w: 1.6, seed: 11 })}</g>
        <g>${bristles(60, 330, 20, 120, Math.PI * 0.6, Math.PI * 1.4, 70, 18, { color: '#0e0907', w: 1.8, seed: 5 })}${bristles(240, 330, 20, 120, -Math.PI * 0.4, Math.PI * 0.4, 70, 18, { color: '#0e0907', w: 1.8, seed: 6 })}</g>
        <ellipse cx="150" cy="112" rx="50" ry="56" fill="#17100c" filter="url(#apFur)"/>
        <g>${bristles(150, 108, 52, 58, Math.PI * 1.0, Math.PI * 2.0, 150, 24, { color: '#0c0706', w: 2.2, seed: 9 })}</g>
        <path d="M104 96 Q128 80 146 98 M196 96 Q172 80 154 98" stroke="#050303" stroke-width="12" stroke-linecap="round" fill="none"/>
        <ellipse cx="124" cy="106" rx="9" ry="5" fill="#000"/><ellipse cx="176" cy="106" rx="9" ry="5" fill="#000"/>
        <g class="ap-eyes">
          <circle cx="124" cy="106" r="7" fill="#ff4a14" opacity=".35" filter="url(#apB2)"/><circle cx="176" cy="106" r="7" fill="#ff4a14" opacity=".35" filter="url(#apB2)"/>
          <ellipse cx="124" cy="106" rx="4.2" ry="2.4" fill="#ff7a2a"/><ellipse cx="176" cy="106" rx="4.2" ry="2.4" fill="#ff7a2a"/>
          <circle cx="125" cy="105.5" r="1" fill="#fff1c0"/><circle cx="177" cy="105.5" r="1" fill="#fff1c0"/>
        </g>
        <path d="M140 116 Q150 134 160 116" stroke="#050303" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
        <path d="M118 138 Q150 164 182 138 Q150 150 118 138 Z" fill="#1b0605"/>
        <path d="M126 142 l5 14 l5 -12 M164 142 l5 14 l5 -14" fill="#cfc0a0" stroke="#cfc0a0" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/>
        <rect x="30" y="410" width="240" height="34" fill="#030304" opacity=".6" filter="url(#apB4)"/>
      </g>`, 'ap-gender');
  }

  /* ---------- Tuyul ---------- */
  function tuyul() {
    return svg(`
      ${ground(46)}
      <g class="ap-creep" transform="translate(0 70)">
        <g filter="url(#apEdge)">
          <path d="M108 250 C100 300 96 340 100 388 L118 388 L124 330 L150 330 L156 388 L176 388 C180 340 176 300 168 250 Z" fill="#6c7660" filter="url(#apSkin)"/>
          <ellipse cx="138" cy="230" rx="38" ry="52" fill="#7b866d" filter="url(#apSkin)"/>
          <ellipse cx="138" cy="230" rx="38" ry="52" fill="url(#apRim)"/>
          <path d="M116 200 q8 6 20 3 M112 220 q10 6 24 3 M116 240 q10 6 22 2" stroke="#2b3226" stroke-width="2" opacity=".6" fill="none"/>
          <path d="M96 296 Q138 330 180 296 L176 332 Q138 352 100 332 Z" fill="#3b2a1b" filter="url(#apCloth)"/>
          <path d="M104 206 C86 232 84 262 98 292 M172 206 C192 224 196 238 186 262" stroke="#6f7a62" stroke-width="12" stroke-linecap="round" fill="none" filter="url(#apSkin)"/>
        </g>
        <g class="ap-coin"><circle cx="196" cy="236" r="13" fill="#9c7c25" stroke="#e6c25a" stroke-width="2"/><circle cx="193" cy="232" r="4" fill="#fff0b0" opacity=".7" filter="url(#apB1)"/><circle cx="196" cy="236" r="26" fill="url(#apCandle)" opacity=".45"/></g>
        <path d="M92 124 L64 100 Q76 142 96 156 Z M184 124 L212 100 Q200 142 180 156 Z" fill="#738066" filter="url(#apSkin)"/>
        <ellipse cx="138" cy="140" rx="46" ry="52" fill="#7b866d" filter="url(#apSkin)"/>
        <ellipse cx="124" cy="100" rx="16" ry="9" fill="#d5ddc8" opacity=".25" filter="url(#apB2)"/>
        ${face(138, 142, 40, 46, { grad: 'apFaceGreen', socket: 1, glint: 2, glintColor: '#fff', smile: 0.78, mouth: '#0d0505' })}
        <path d="M118 176 l4 8 l4 -7 M138 176 l4 8 l4 -7" stroke="#cfc8a8" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
      </g>`, 'ap-tuyul');
  }

  /* ---------- Kuyang ---------- */
  function kuyang() {
    const gut = (d, w, delay) => `<g class="ap-gut" style="animation-delay:${delay}s"><path d="${d}" stroke="url(#apGut)" stroke-width="${w}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#ff9aa6" stroke-width="${w * 0.18}" fill="none" stroke-linecap="round" opacity=".35" transform="translate(-1.5 -1)"/></g>`;
    return svg(`
      <circle class="ap-ember" cx="150" cy="320" r="130" fill="url(#apEmber)" opacity=".5"/>
      <g class="ap-float">
        <g class="ap-hair" filter="url(#apEdge)">
          ${strands(170, { x0: 92, x1: 208, y0: 60, y1: 120, spread: 110, len: 210, color: '#060506', hl: '#4a2a24', w: 1.7, seed: 3, drift: 0, jit: 14 })}
        </g>
        ${gut('M140 206 C112 250 150 280 124 330 C108 362 130 380 120 420', 11, 0)}
        ${gut('M152 208 C170 256 134 288 158 336 C172 366 150 392 160 428', 12, 0.4)}
        ${gut('M164 204 C196 244 168 274 190 316 C202 342 186 368 194 404', 9, 0.8)}
        ${gut('M132 204 C100 240 120 262 104 300', 7, 1.1)}
        <path d="M126 184 Q150 214 176 184 L170 206 Q150 224 132 206 Z" fill="#5d0c14" filter="url(#apB1)"/>
        <ellipse cx="150" cy="116" rx="40" ry="50" fill="#d9ccb8"/>
        ${face(150, 116, 40, 50, { grad: 'apFaceWarm', socket: 0.98, glintColor: '#ffb86b', glint: 1.5, blood: false, mouth: '#4a0c14' })}
        <path d="M110 108 C106 56 138 36 150 36 C170 36 196 56 190 108 C182 74 168 62 150 62 C132 62 118 76 110 108 Z" fill="#060506"/>
        <path d="M120 150 C124 170 134 182 150 184 C166 182 176 170 180 150 C170 166 160 172 150 172 C140 172 130 166 120 150 Z" fill="#350a10" opacity=".65" filter="url(#apB1)"/>
        <ellipse cx="150" cy="224" rx="30" ry="12" fill="#ff7a28" opacity=".35" filter="url(#apB4)"/>
      </g>`, 'ap-kuyang');
  }

  /* ---------- Sundel Bolong (from behind, looking back) ---------- */
  function sundel() {
    return svg(`
      ${ground(64)}
      <g class="ap-sway" mask="url(#apFade)">
        <g filter="url(#apEdge)">
          <path d="M104 156 C92 220 82 330 62 428 L238 428 C218 330 208 220 196 156 Q150 144 104 156 Z" fill="#8c1a2c" filter="url(#apCloth)"/>
          <path d="M104 156 C92 220 82 330 62 428 L238 428 C218 330 208 220 196 156 Q150 144 104 156 Z" fill="url(#apRim)"/>
        </g>
        <path d="M100 170 C82 220 78 280 86 324 M200 170 C218 220 222 280 214 324" stroke="#d8cfc4" stroke-width="13" stroke-linecap="round" fill="none" filter="url(#apSkin)"/>
        <g class="ap-hole">
          <path d="M150 190 C122 196 118 240 126 276 C130 304 142 322 150 330 C158 322 170 304 174 276 C182 240 178 196 150 190 Z" fill="#050203"/>
          <path d="M150 190 C122 196 118 240 126 276 C130 304 142 322 150 330 C158 322 170 304 174 276 C182 240 178 196 150 190 Z" fill="none" stroke="#5a0f1c" stroke-width="5" filter="url(#apB1)"/>
          <path d="M138 214 q-6 24 2 50 M162 216 q6 24 -2 52 M150 236 q-3 22 0 44" stroke="#3b0a14" stroke-width="3" fill="none" opacity=".7" filter="url(#apB1)"/>
          <ellipse cx="150" cy="262" rx="12" ry="32" fill="#7a0e22" opacity=".25" filter="url(#apB2)"/>
        </g>
        <rect x="136" y="132" width="28" height="30" fill="#bfae9d" filter="url(#apB1)"/>
        <g class="ap-hair" filter="url(#apEdge)">
          <path d="M150 40 C86 40 78 150 90 230 C96 290 84 340 76 392 L224 392 C216 340 204 290 210 230 C222 150 214 40 150 40 Z" fill="#060509"/>
          ${strands(150, { x0: 100, x1: 200, y0: 50, y1: 80, spread: 40, len: 340, color: '#08070b', hl: '#40485a', w: 1.5, seed: 21 })}
          <path d="M150 44 L150 330" stroke="#000" stroke-width="2" opacity=".6"/>
        </g>
        <g transform="rotate(14 150 96)">
          <path d="M186 74 C202 86 206 118 190 140 C180 150 168 150 162 142 C176 122 182 98 186 74 Z" fill="#cdbba8" filter="url(#apSkin)"/>
          <ellipse cx="184" cy="104" rx="8" ry="5" fill="#020203" filter="url(#apB1)"/>
          <circle cx="185" cy="104" r="1.3" fill="#ff6a7c" opacity=".9"/>
          <path d="M186 132 q8 2 12 -2" stroke="#9c1428" stroke-width="3" fill="none" stroke-linecap="round"/>
        </g>
        <circle cx="120" cy="70" r="5" fill="#f7a5b8" opacity=".9"/><circle cx="127" cy="75" r="3.6" fill="#f7a5b8" opacity=".9"/>
      </g>`, 'ap-sundel');
  }

  /* ---------- Wewe Gombel ---------- */
  function wewe() {
    return svg(`
      ${ground(76)}
      <g class="ap-breathe">
        <g class="ap-hair" filter="url(#apEdge)">
          ${strands(220, { x0: 90, x1: 210, y0: 52, y1: 86, spread: 130, len: 150, color: '#d8d6dc', hl: '#ffffff', w: 1.6, seed: 31, jit: 18, op: 0.8 })}
          ${strands(120, { x0: 96, x1: 204, y0: 60, y1: 100, spread: 90, len: 110, color: '#8f8f98', hl: '#c9c9d0', w: 1.4, seed: 33, jit: 14, op: 0.7 })}
        </g>
        <g filter="url(#apEdge)">
          <path d="M60 440 C48 330 66 224 104 188 Q150 168 196 188 C238 224 252 330 240 440 Z" fill="#2d2420" filter="url(#apCloth)"/>
          <path d="M60 440 C48 330 66 224 104 188 Q150 168 196 188 C238 224 252 330 240 440 Z" fill="url(#apRim)"/>
        </g>
        <path d="M84 300 Q150 330 220 296 M76 360 Q150 392 226 356" stroke="#5a3a22" stroke-width="5" fill="none" opacity=".6"/>
        <path d="M106 206 l-8 28 l14 -6 M194 206 l8 26 l-14 -4" stroke="#17110f" stroke-width="3" fill="none"/>
        <path d="M136 156 L164 156 L176 204 L124 204 Z" fill="#5f5648" filter="url(#apB2)"/>
        ${face(150, 118, 36, 46, { grad: 'apFaceOld', socket: 0.96, glintColor: '#ffe9a0', glint: 1.3, mouth: '#1a0a0a', smile: 0.5 })}
        <path d="M118 96 q10 -5 20 0 M162 96 q10 -5 20 0 M120 142 q10 12 22 12 M180 142 q-10 12 -22 12 M126 126 q-4 14 2 24 M174 126 q4 14 -2 24" stroke="#201a14" stroke-width="2" fill="none" opacity=".55" filter="url(#apB1)"/>
        <ellipse cx="164" cy="112" rx="8" ry="6" fill="#c9cdd2" opacity=".85"/>
        <path d="M118 150 q12 24 32 22 q20 2 32 -22 q-16 14 -32 14 q-16 0 -32 -14 Z" fill="#150808" opacity=".55"/>
        <path d="M82 232 C70 270 96 312 138 316 M218 232 C228 270 204 312 168 316" stroke="#8c7f6c" stroke-width="13" stroke-linecap="round" fill="none" filter="url(#apSkin)"/>
        <g class="ap-bundle">
          <ellipse cx="150" cy="306" rx="46" ry="30" fill="#c8cfdc" filter="url(#apCloth)"/>
          <circle cx="150" cy="290" r="17" fill="#d6bfa4" filter="url(#apSkin)"/>
          <path d="M142 290 q4 3 8 0 M152 290 q4 3 8 0" stroke="#3a2a1a" stroke-width="1.6" fill="none"/>
          <circle cx="150" cy="296" r="46" fill="#dfe8ff" opacity=".1" filter="url(#apB4)"/>
        </g>
      </g>`, 'ap-wewe');
  }

  /* ---------- Babi Ngepet ---------- */
  function babi() {
    return svg(`
      ${ground(112)}
      <circle cx="58" cy="402" r="70" fill="url(#apCandle)" opacity=".55"/>
      <g class="ap-boar">
        <g filter="url(#apEdge)">
          <path d="M92 250 C86 190 130 160 188 164 C244 168 278 200 270 262 C266 306 250 330 228 336 L228 410 L206 410 L204 346 L148 346 L146 410 L124 410 L124 330 C100 314 94 286 92 250 Z" fill="#1b1613" filter="url(#apFur)"/>
          <path d="M92 250 C86 190 130 160 188 164 C244 168 278 200 270 262 C266 306 250 330 228 336 L228 410 L206 410 L204 346 L148 346 L146 410 L124 410 L124 330 C100 314 94 286 92 250 Z" fill="url(#apRim)"/>
          <path d="M96 258 C60 270 48 292 58 318 C76 340 110 332 118 308 Z" fill="#241c18" filter="url(#apFur)"/>
        </g>
        <g>${bristles(180, 250, 92, 92, Math.PI * 1.08, Math.PI * 1.78, 190, 22, { color: '#0c0807', w: 2.2, seed: 41 })}${bristles(150, 250, 66, 70, Math.PI * 1.1, Math.PI * 1.5, 70, 18, { color: '#17100d', w: 1.6, seed: 43 })}</g>
        <path d="M92 214 C74 196 78 168 98 160 C110 156 118 170 112 188 Z" fill="#17110e"/>
        <path d="M54 296 C34 300 26 316 34 330 C46 340 66 334 72 318 Z" fill="#3a2c27"/>
        <ellipse cx="36" cy="316" rx="5" ry="7" fill="#050303"/><ellipse cx="50" cy="326" rx="4.2" ry="6" fill="#050303"/>
        <ellipse cx="44" cy="306" rx="10" ry="4" fill="#d9c9b8" opacity=".25" filter="url(#apB1)"/>
        <path d="M60 330 C58 318 70 300 80 296 C86 306 78 322 66 336 Z" fill="#d8caa4"/>
        <path d="M64 332 C70 346 62 362 54 366 C54 352 56 342 52 336 Z" fill="#cdbf98" opacity=".9"/>
        <ellipse cx="86" cy="290" rx="9" ry="5.5" fill="#000"/>
        <g class="ap-eyes"><circle cx="86" cy="290" r="7" fill="#ff2a12" opacity=".35" filter="url(#apB2)"/><ellipse cx="86" cy="290" rx="3.6" ry="2.4" fill="#e0442a"/><circle cx="87" cy="289.5" r=".9" fill="#ffe3b0"/></g>
        <path d="M74 280 Q88 276 98 286" stroke="#050303" stroke-width="5" stroke-linecap="round" fill="none"/>
        <g class="ap-breath"><ellipse cx="22" cy="306" rx="16" ry="7" fill="#c9d4e0" opacity=".25" filter="url(#apB2)"/></g>
        <path d="M214 196 Q244 182 266 208 L262 236 Q238 214 214 220 Z" fill="#7b5d2a" opacity=".92" filter="url(#apCloth)"/>
        <circle cx="240" cy="218" r="3.4" fill="#4a3412"/>
      </g>
      <g class="ap-candle"><rect x="54" y="388" width="8" height="26" rx="2" fill="#e8dfc6"/><path class="ap-flame" d="M58 366 Q51 378 58 390 Q65 378 58 366" fill="#ffc261"/><circle cx="58" cy="380" r="22" fill="#fff0c0" opacity=".25" filter="url(#apB2)"/></g>`, 'ap-babi');
  }

  const MAP = { pocong, kuntilanak, genderuwo, tuyul, kuyang, sundel, wewe, babi };
  window.GHOSTS.forEach((g) => { g.svg = MAP[g.id] ? MAP[g.id]() : ''; });
})();
