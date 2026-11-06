/* Mistis AI — procedural horror sound engine (WebAudio, no audio files).
 * Layers: (1) location ambience beds + random one-shots, (2) per-ghost signature sounds,
 * (3) scripted cues for omens / departure. Everything is synthesised: noise, formant "voices", reverb. */
(function () {
  'use strict';

  let ctx = null, master = null, comp = null, dry = null, reverb = null, wet = null;
  let enabled = true;
  let beds = [];
  let loops = [];
  let epoch = 0;
  let noiseCache = {};

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const sign = () => (Math.random() < 0.5 ? -1 : 1);
  const now = () => ctx.currentTime;
  const at = (delay) => Math.max(ctx.currentTime, ctx.currentTime + (delay || 0));

  /* ------------------------------------------------------------------ graph */
  function build(c) {
    ctx = c;
    noiseCache = {};
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = ctx.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    master.connect(comp); comp.connect(ctx.destination);
    dry = ctx.createGain(); dry.connect(master);
    reverb = ctx.createConvolver();
    reverb.buffer = makeIR(3.4, 2.4);
    wet = ctx.createGain(); wet.gain.value = 0.65;
    reverb.connect(wet); wet.connect(master);
  }
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    build(new AC());
    return ctx;
  }
  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp = lp * 0.5 + (Math.random() * 2 - 1) * 0.5; // darker tail
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }
  function noiseBuf(kind) {
    if (noiseCache[kind]) return noiseCache[kind];
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else { // brown
      let l = 0;
      for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    }
    noiseCache[kind] = buf;
    return buf;
  }

  /** connect a node to the mix: [lowpass] -> gain -> [pan] -> dry + reverb send */
  function route(node, o = {}) {
    let n = node;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; n.connect(f); n = f; }
    const g = ctx.createGain(); g.gain.value = 1; n.connect(g); n = g;
    if (o.pan != null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const t = at(o.delay);
      p.pan.setValueAtTime(o.pan, t);
      if (o.panTo != null) p.pan.linearRampToValueAtTime(o.panTo, t + (o.panDur || 2));
      n.connect(p); n = p;
    }
    n.connect(dry);
    const s = ctx.createGain(); s.gain.value = o.send ?? 0.3; n.connect(s); s.connect(reverb);
  }

  function env(param, t, a, peak, d) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.max(a, 0.002));
    param.exponentialRampToValueAtTime(0.0001, t + Math.max(a, 0.002) + Math.max(d, 0.01));
  }

  /* -------------------------------------------------------------- primitives */
  function tone(o) {
    const t = at(o.delay), a = o.a ?? 0.01, d = Math.max(o.dur - a, 0.02);
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur * (o.glide || 1));
    const g = ctx.createGain(); env(g.gain, t, a, o.vol ?? 0.2, d);
    if (o.vib) {
      const l = ctx.createOscillator(); l.frequency.value = o.vibRate || 5.5;
      const lg = ctx.createGain(); lg.gain.value = o.f * o.vib;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.1);
    }
    osc.connect(g); route(g, o);
    osc.start(t); osc.stop(t + o.dur + 0.1);
  }

  function noise(o) {
    const t = at(o.delay), a = o.a ?? 0.01, d = Math.max(o.dur - a, 0.02);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(o.kind || 'white'); src.loop = true;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    f.Q.value = o.q ?? 1;
    // makeup gain: band-limited noise carries little energy, compensate roughly by bandwidth
    const fc = o.f || 1000, bw = (o.type === 'lowpass' || o.type === 'highpass') ? fc : fc / Math.max(o.q ?? 1, 0.5);
    const makeup = Math.min(10, Math.max(1, Math.sqrt(22050 / Math.max(bw, 40)) * 0.45));
    const g = ctx.createGain(); env(g.gain, t, a, (o.vol ?? 0.1) * makeup, d);
    src.connect(f); let n = f;
    if (o.am) {
      const am = ctx.createGain(); const depth = o.amDepth ?? 0.8;
      am.gain.value = 1 - depth * 0.5;
      const l = ctx.createOscillator(); l.type = o.amType || 'sine'; l.frequency.value = o.am;
      const lg = ctx.createGain(); lg.gain.value = depth * 0.5; l.connect(lg); lg.connect(am.gain);
      l.start(t); l.stop(t + o.dur + 0.1);
      n.connect(am); n = am;
    }
    n.connect(g); route(g, o);
    src.start(t, Math.random() * 2); src.stop(t + o.dur + 0.1);
  }

  const VOW = {
    i: [[300, 7, 1], [2500, 10, 0.55], [3300, 12, 0.3]],
    a: [[760, 7, 1], [1200, 9, 0.7], [2600, 10, 0.3]],
    e: [[480, 7, 1], [2000, 9, 0.6], [2800, 10, 0.3]],
    o: [[500, 7, 1], [900, 8, 0.7], [2500, 10, 0.2]],
    u: [[320, 7, 1], [800, 8, 0.5], [2400, 10, 0.2]],
    m: [[250, 7, 1], [1000, 9, 0.25], [2200, 10, 0.1]],
    w: [[900, 7, 1], [1650, 9, 0.7], [2700, 10, 0.3]],
    g: [[420, 6, 1], [1000, 8, 0.6], [1800, 10, 0.2]],
  };
  /** formant "voice": sawtooth through parallel band-pass filters + breath noise */
  function voice(o) {
    const t = at(o.delay), a = o.a ?? 0.03, r = o.r ?? 0.08;
    const osc = ctx.createOscillator(); osc.type = o.type || 'sawtooth';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
    if (o.vib) {
      const l = ctx.createOscillator(); l.frequency.value = o.vibRate || 5.5;
      const lg = ctx.createGain(); lg.gain.value = o.f0 * o.vib; l.connect(lg); lg.connect(osc.frequency);
      l.start(t); l.stop(t + o.dur + 0.1);
    }
    const mix = ctx.createGain();
    mix.gain.setValueAtTime(0.0001, t);
    mix.gain.exponentialRampToValueAtTime(Math.max(o.vol ?? 0.2, 0.0002), t + a);
    mix.gain.setValueAtTime(Math.max(o.vol ?? 0.2, 0.0002), t + Math.max(o.dur - r, a));
    mix.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    const fm = typeof o.v === 'string' ? VOW[o.v] : o.v;
    fm.forEach(([f, q, gn]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = gn * 5;
      osc.connect(bp); bp.connect(bg); bg.connect(mix);
    });
    if (o.breath) {
      const ns = ctx.createBufferSource(); ns.buffer = noiseBuf('white'); ns.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm[1][0]; bp.Q.value = 1.2;
      const bg = ctx.createGain(); bg.gain.value = o.breath;
      ns.connect(bp); bp.connect(bg); bg.connect(mix);
      ns.start(t, Math.random() * 2); ns.stop(t + o.dur + 0.1);
    }
    route(mix, o);
    osc.start(t); osc.stop(t + o.dur + 0.1);
  }

  /* -------------------------------------------------------------------- beds */
  function bed(fn) {
    const nodes = [];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(1, now() + 3);
    route(g, { send: 0.18 });
    fn(g, nodes);
    const b = {
      stop(sec = 1.6) {
        try {
          g.gain.cancelScheduledValues(now());
          g.gain.setValueAtTime(Math.max(g.gain.value, 0.0002), now());
          g.gain.exponentialRampToValueAtTime(0.0001, now() + sec);
        } catch { /* closed */ }
        setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* ended */ } }), sec * 1000 + 200);
      },
    };
    beds.push(b);
    return b;
  }
  function src(kind, nodes) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(kind); s.loop = true; s.start(0, Math.random() * 2); nodes.push(s); return s; }
  function lfo(freq, depth, target, nodes, type = 'sine') {
    const l = ctx.createOscillator(); l.type = type; l.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = depth; l.connect(g); g.connect(target); l.start(); nodes.push(l); return l;
  }
  const BEDS = {
    wind: (f, vol, rate = 0.11) => (out, nodes) => {
      const s = src('pink', nodes);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = vol;
      lfo(rate, f * 0.55, bp.frequency, nodes);
      lfo(rate * 0.63, vol * 0.7, g.gain, nodes);
      s.connect(bp); bp.connect(g); g.connect(out);
    },
    leaves: (vol) => (out, nodes) => {
      const s = src('white', nodes);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
      const g = ctx.createGain(); g.gain.value = vol;
      lfo(0.17, vol * 0.8, g.gain, nodes);
      s.connect(hp); hp.connect(g); g.connect(out);
    },
    cricket: (f, vol, layers = 3) => (out, nodes) => {
      for (let i = 0; i < layers; i++) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + rand(-0.06, 0.06)); o.start(); nodes.push(o);
        const g = ctx.createGain(); g.gain.value = vol * 0.5;
        lfo(rand(11, 17), vol * 0.5, g.gain, nodes, 'square'); // chirp gating
        const env2 = ctx.createGain(); env2.gain.value = 0.6;
        lfo(rand(0.15, 0.3), 0.4, env2.gain, nodes); // swell in/out
        o.connect(g); g.connect(env2); env2.connect(out);
      }
    },
    drone: (f, vol) => (out, nodes) => {
      [f, f * 1.007].forEach((ff) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = ff; o.start(); nodes.push(o);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 2;
        lfo(0.07, 60, lp.frequency, nodes);
        const g = ctx.createGain(); g.gain.value = vol;
        o.connect(lp); lp.connect(g); g.connect(out);
      });
    },
    water: (vol, cut = 650) => (out, nodes) => {
      const s = src('brown', nodes);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut;
      const g = ctx.createGain(); g.gain.value = vol;
      lfo(0.27, vol * 0.5, g.gain, nodes);
      lfo(0.09, cut * 0.3, lp.frequency, nodes);
      s.connect(lp); lp.connect(g); g.connect(out);
    },
    hum: (vol) => (out, nodes) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 100; o.start(); nodes.push(o);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const g = ctx.createGain(); g.gain.value = vol;
      lfo(7.3, vol * 0.5, g.gain, nodes);
      o.connect(lp); lp.connect(g); g.connect(out);
    },
  };

  /* ------------------------------------------------------- location one-shots */
  const EV = {
    owl() {
      const pan = rand(-0.8, 0.8);
      [0, 0.7].forEach((dl, i) => tone({ f: 430 - i * 30, to: 380 - i * 30, dur: 0.5, vol: 0.09, a: 0.08, vib: 0.02, delay: dl, pan, lp: 1400, send: 0.55 }));
    },
    dog() {
      const t = now(), pan = rand(-0.9, 0.9);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(300, t); o.frequency.linearRampToValueAtTime(560, t + 0.9); o.frequency.linearRampToValueAtTime(430, t + 2.4);
      const l = ctx.createOscillator(); l.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 8; l.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.5); g.gain.setValueAtTime(0.1, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
      o.connect(bp); bp.connect(g); route(g, { pan, lp: 1800, send: 0.75, vol: 1 });
      o.start(t); l.start(t); o.stop(t + 2.8); l.stop(t + 2.8);
    },
    branch() {
      const pan = rand(-0.9, 0.9);
      noise({ f: 1800, q: 3, dur: 0.06, vol: 0.12, pan, send: 0.4 });
      noise({ f: 900, q: 2, dur: 0.05, vol: 0.09, delay: 0.07, pan, send: 0.4 });
      tone({ f: 120, to: 60, dur: 0.15, vol: 0.06, delay: 0.1, pan });
    },
    creak(v = 0.1) {
      const vol = v * 4; // narrow resonant band-pass loses level; compensate
      const t = now(), dur = rand(1.1, 2.2), pan = rand(-0.7, 0.7);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      let f = rand(90, 130); o.frequency.setValueAtTime(f, t);
      for (let x = 0.06; x < dur; x += rand(0.04, 0.1)) { f = Math.max(60, f * (1 + rand(-0.12, 0.16))); o.frequency.setValueAtTime(f, t + x); }
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(600, 1000); bp.Q.value = 9;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.25); g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(bp); bp.connect(g); route(g, { pan, send: 0.45 });
      o.start(t); o.stop(t + dur + 0.1);
    },
    drip() { tone({ f: rand(1100, 1500), to: 650, dur: 0.14, vol: 0.12, pan: rand(-0.6, 0.6), send: 0.9 }); },
    thump(far) {
      tone({ f: 70, to: 32, dur: 0.35, vol: far ? 0.16 : 0.3, pan: rand(-0.5, 0.5), send: 0.6 });
      noise({ f: 220, type: 'lowpass', dur: 0.16, vol: far ? 0.1 : 0.2, send: 0.5 });
    },
    knock(n = 3, gap = 0.28, vol = 0.18) {
      const pan = rand(-0.5, 0.5);
      for (let i = 0; i < n; i++) {
        noise({ f: 650, q: 5, dur: 0.07, vol, delay: i * gap, pan, send: 0.5 });
        tone({ f: 190, to: 110, dur: 0.11, vol: vol * 0.7, delay: i * gap, pan, send: 0.4 });
      }
    },
    gamelan() {
      const sc = [262, 301, 349, 392, 450, 524];
      let t = 0;
      for (let i = 0; i < Math.floor(rand(2, 5)); i++) {
        const f = pick(sc) * (Math.random() < 0.3 ? 0.5 : 1);
        tone({ f, dur: 5, vol: 0.07, a: 0.004, delay: t, pan: rand(-0.4, 0.4), send: 0.85 });
        tone({ f: f * 2.76, dur: 1.6, vol: 0.02, a: 0.004, delay: t, send: 0.8 });
        tone({ f: f * 5.4, dur: 0.6, vol: 0.01, a: 0.004, delay: t, send: 0.8 });
        t += rand(0.9, 1.8);
      }
    },
    clink() {
      const pan = rand(-0.8, 0.8);
      for (let i = 0; i < 3; i++) {
        const f = rand(2000, 3400);
        tone({ f, dur: 0.3, vol: 0.05, a: 0.002, delay: i * rand(0.08, 0.3), pan, send: 0.5 });
        tone({ f: f * 1.5, dur: 0.15, vol: 0.02, a: 0.002, delay: i * 0.15, pan });
      }
    },
    swing() {
      const pan = rand(-0.5, 0.5);
      for (let i = 0; i < 5; i++) {
        tone({ f: 1700, to: 2350, dur: 0.6, vol: 0.045, a: 0.1, vib: 0.012, delay: i * 1.9, pan, send: 0.55 });
        noise({ f: 1900, q: 14, dur: 0.5, vol: 0.02, delay: i * 1.9, pan });
      }
    },
    frog() {
      const base = rand(150, 190), pan = rand(-0.8, 0.8), n = Math.floor(rand(3, 8));
      for (let i = 0; i < n; i++) {
        tone({ f: base, to: base * 0.78, dur: 0.1, vol: 0.07, type: 'sawtooth', delay: i * 0.12, pan, lp: 1000, send: 0.4 });
        tone({ f: base * 1.5, to: base * 1.1, dur: 0.09, vol: 0.03, type: 'square', delay: i * 0.12, pan, lp: 900, send: 0.4 });
      }
    },
    cicada() { noise({ f: 5200, q: 9, dur: 3.5, a: 1.4, vol: 0.05, am: 62, amDepth: 0.9, amType: 'square', pan: rand(-0.7, 0.7), send: 0.3 }); },
    whisper(vol = 0.06) {
      const pan = rand(-0.9, 0.9), n = Math.floor(rand(4, 8));
      let t = 0;
      for (let i = 0; i < n; i++) {
        const v = VOW[pick(['i', 'e', 'a', 'o', 'u'])];
        const dur = rand(0.09, 0.24);
        v.slice(0, 2).forEach(([f, q]) => noise({ f: f * rand(0.9, 1.15), q: q * 0.7, dur, a: 0.03, vol: vol * 0.7, delay: t, pan, send: 0.75 }));
        noise({ f: rand(3500, 6500), q: 1.2, dur: dur * 0.6, a: 0.02, vol: vol * 0.5, delay: t, pan, send: 0.75 });
        t += dur + rand(0.03, 0.12);
      }
    },
    gust() { noise({ f: 280, to: 950, q: 0.8, dur: 3.2, a: 1.2, vol: 0.08, kind: 'pink', pan: rand(-0.5, 0.5), send: 0.4 }); },
    slam() {
      tone({ f: 85, to: 30, dur: 0.5, vol: 0.4, send: 0.8 });
      noise({ f: 420, type: 'lowpass', dur: 0.5, vol: 0.3, send: 0.9 });
      noise({ f: 2200, q: 2, dur: 0.06, vol: 0.14, send: 0.7 });
    },
    footsteps(n, gap, o = {}) {
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 0;
        const vol = (o.v0 ?? 0.15) + ((o.v1 ?? 0.15) - (o.v0 ?? 0.15)) * k;
        const pan = (o.p0 ?? 0) + ((o.p1 ?? 0) - (o.p0 ?? 0)) * k;
        tone({ f: o.heavy ? 52 : 90, to: o.heavy ? 28 : 45, dur: o.heavy ? 0.3 : 0.16, vol: vol * (o.heavy ? 1.6 : 1), delay: i * gap + rand(-0.03, 0.03), pan, send: o.heavy ? 0.7 : 0.5 });
        noise({ f: o.heavy ? 160 : 400, type: 'lowpass', dur: o.heavy ? 0.22 : 0.09, vol: vol * 0.8, delay: i * gap, pan, send: 0.4 });
        noise({ f: 1500, q: 1.5, dur: 0.1, vol: vol * 0.25, delay: i * gap + 0.04, pan }); // cloth / grit
      }
    },
    heels(n, gap, p0 = -0.8, p1 = 0.8, v0 = 0.12, v1 = 0.12) {
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 0, pan = p0 + (p1 - p0) * k, vol = v0 + (v1 - v0) * k;
        noise({ f: 3000, q: 2.2, dur: 0.028, a: 0.002, vol, delay: i * gap, pan, send: 0.6 });
        tone({ f: 230, to: 150, dur: 0.07, vol: vol * 0.45, delay: i * gap, pan, send: 0.5 });
      }
    },
    crow(pan = 0.4, far = true) {
      const notes = [[520, 760, 0.17], [740, 700, 0.1], [640, 980, 0.24], [980, 420, 0.62]];
      let d = 0;
      notes.forEach(([a, b, dur], i) => {
        voice({ f0: a, f1: b, dur, v: [[900, 6, 1], [1800, 8, 0.8], [3000, 10, 0.4]], vol: 0.13, breath: 0.06, delay: d, pan, send: far ? 0.7 : 0.35, lp: far ? 3200 : 6000, vib: i === 3 ? 0.03 : 0.0, vibRate: 11, a: 0.02, r: 0.06 });
        d += dur + 0.04;
      });
    },
  };

  /* --------------------------------------------------------- location configs */
  const LOC = {
    forest: {
      beds: [BEDS.wind(380, 0.07), BEDS.cricket(4300, 0.014), BEDS.leaves(0.02)],
      events: [[EV.owl, 14, 32], [EV.branch, 9, 22], [EV.dog, 40, 90], [EV.whisper, 28, 60], [() => EV.thump(true), 30, 70], [EV.gust, 18, 40]],
    },
    building: {
      beds: [BEDS.wind(260, 0.06), BEDS.drone(48, 0.05), BEDS.hum(0.01)],
      events: [[() => EV.creak(0.1), 7, 16], [EV.drip, 4, 9], [() => EV.thump(false), 14, 30], [EV.whisper, 24, 55], [EV.slam, 50, 100], [EV.gust, 20, 45]],
    },
    graveyard: {
      beds: [BEDS.wind(340, 0.06), BEDS.cricket(4000, 0.012, 2), BEDS.drone(42, 0.035)],
      events: [[EV.dog, 22, 50], [EV.owl, 16, 36], [EV.whisper, 22, 50], [EV.branch, 14, 30], [EV.gust, 16, 36], [() => EV.knock(2, 0.5, 0.08), 50, 110]],
    },
    beringin: {
      beds: [BEDS.wind(300, 0.06), BEDS.cricket(4600, 0.012), BEDS.leaves(0.025)],
      events: [[EV.cicada, 12, 28], [EV.gamelan, 28, 60], [EV.owl, 20, 44], [EV.whisper, 22, 48], [() => EV.creak(0.07), 12, 26], [EV.gust, 18, 40]],
    },
    rawa: {
      beds: [BEDS.water(0.05, 600), BEDS.wind(480, 0.04), BEDS.cricket(3800, 0.012, 3)],
      events: [[EV.frog, 5, 12], [EV.drip, 6, 14], [() => EV.creak(0.06), 22, 48], [EV.whisper, 28, 60], [EV.owl, 28, 60], [EV.gust, 22, 44]],
    },
    school: {
      beds: [BEDS.wind(280, 0.055), BEDS.drone(52, 0.04), BEDS.cricket(4200, 0.008, 2)],
      events: [[EV.swing, 16, 34], [EV.clink, 8, 18], [() => EV.creak(0.08), 14, 30], [EV.slam, 60, 120], [EV.whisper, 22, 48], [EV.drip, 12, 26]],
    },
    bridge: {
      beds: [BEDS.water(0.07, 760), BEDS.wind(450, 0.06), BEDS.cricket(4400, 0.008, 2)],
      events: [[() => EV.creak(0.08), 12, 26], [EV.dog, 30, 70], [EV.whisper, 24, 52], [EV.gust, 14, 32], [EV.clink, 18, 40], [() => EV.heels(5, 0.6, -0.9, 0.9, 0.04, 0.1), 40, 90]],
    },
    joglo: {
      beds: [BEDS.cricket(4300, 0.014, 3), BEDS.wind(240, 0.045), BEDS.drone(46, 0.035)],
      events: [[EV.gamelan, 14, 32], [() => EV.creak(0.09), 10, 22], [EV.drip, 7, 16], [() => EV.knock(3, 0.3, 0.12), 36, 80], [EV.whisper, 26, 56], [EV.owl, 24, 50]],
    },
    bukit: {
      beds: [BEDS.wind(560, 0.1, 0.07), BEDS.cricket(4100, 0.01), BEDS.leaves(0.02)],
      events: [[EV.dog, 22, 50], [EV.owl, 18, 40], [EV.gust, 10, 24], [EV.whisper, 24, 52], [EV.branch, 14, 30], [() => EV.knock(2, 0.4, 0.07), 60, 120]],
    },
  };

  /* ------------------------------------------------------ ghost signatures */
  const laugh = (o) => {
    // generic syllabic laugh: n bursts with falling pitch
    const { n, f, syl, gap, vol, v, pan = 0, panTo, panDur, send = 0.55, lp, dur = 0.14, delay = 0, drop = 0.9 } = o;
    for (let i = 0; i < n; i++) {
      const ff = f * (1 - i * 0.02);
      voice({ f0: ff * 1.12, f1: ff * drop, dur: dur * (1 + (i === n - 1 ? 0.5 : 0)), v, vol: vol * (1 - i * 0.04), breath: 0.1, vib: 0.02, vibRate: 7, delay: delay + i * (dur + gap), pan: panTo != null ? pan + (panTo - pan) * (i / n) : pan, send, lp, a: 0.015, r: 0.05 });
    }
  };

  const CH = {
    pocong: {
      events: [
        [() => { const dir = sign(); EV.footsteps(Math.floor(rand(3, 7)), 0.85, { v0: 0.06, v1: 0.22, p0: -0.9 * dir, p1: 0.2 * dir }); }, 16, 34],
        [() => voice({ f0: 135, f1: 95, dur: 2.3, v: 'o', vol: 0.09, vib: 0.03, vibRate: 4.5, breath: 0.15, pan: rand(-0.6, 0.6), send: 0.8, lp: 1600, a: 0.6, r: 0.9 }), 32, 70],
        [() => noise({ f: 1400, q: 1.2, dur: 1.4, a: 0.4, vol: 0.05, pan: rand(-0.7, 0.7), send: 0.4 }), 14, 30],
      ],
      arrive: () => EV.footsteps(5, 0.8, { v0: 0.05, v1: 0.26, p0: -0.7, p1: 0 }),
      accent: () => EV.footsteps(2, 0.75, { v0: 0.12, v1: 0.2, p0: rand(-0.4, 0.4), p1: 0 }),
      cue: () => EV.crow(0.5, true),
      leave: () => { EV.footsteps(7, 0.9, { v0: 0.24, v1: 0.03, p0: 0, p1: 0.9 }); EV.crow(-0.4, true); },
    },
    kuntilanak: {
      events: [
        [() => laugh({ n: Math.floor(rand(5, 8)), f: 640, gap: 0.07, vol: 0.12, v: 'i', pan: rand(-0.8, 0.8), send: 0.7, lp: 5000 }), 20, 42],
        [() => voice({ f0: 720, f1: 470, dur: 2.2, v: 'w', vol: 0.08, vib: 0.035, vibRate: 5.2, breath: 0.12, pan: rand(-0.7, 0.7), send: 0.85, lp: 3800, a: 0.5, r: 0.8 }), 38, 80],
        [() => EV.creak(0.06), 14, 30],
      ],
      arrive: () => { laugh({ n: 6, f: 660, gap: 0.07, vol: 0.14, v: 'i', pan: -0.7, panTo: 0.2, send: 0.75, lp: 5200 }); },
      accent: () => laugh({ n: 3, f: 640, gap: 0.07, vol: 0.12, v: 'i', pan: rand(-0.6, 0.6), send: 0.7, lp: 5000 }),
      cue: () => { EV.creak(0.1); EV.branch(); },
      leave: () => { laugh({ n: 8, f: 700, gap: 0.08, vol: 0.14, v: 'i', pan: 0, panTo: 1, send: 0.9, lp: 3600, dur: 0.15, drop: 1.05 }); voice({ f0: 760, f1: 430, dur: 2.8, delay: 1.6, v: 'w', vol: 0.06, vib: 0.035, breath: 0.1, pan: 0.8, send: 0.95, lp: 3000, a: 0.8, r: 1.4 }); },
    },
    genderuwo: {
      events: [
        [() => { const t = now(); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(38, t + 2.2); const am = ctx.createGain(); am.gain.value = 0.5; const l = ctx.createOscillator(); l.frequency.value = 26; const lg = ctx.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(am.gain); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; o.connect(am); am.connect(lp); lp.connect(g); route(g, { pan: rand(-0.5, 0.5), send: 0.6 }); o.start(t); l.start(t); o.stop(t + 2.6); l.stop(t + 2.6); noise({ f: 300, type: 'lowpass', dur: 2, a: 0.5, vol: 0.08, send: 0.5 }); }, 22, 48],
        [() => EV.footsteps(4, 1.0, { heavy: true, v0: 0.05, v1: 0.2, p0: rand(-0.8, 0), p1: rand(0, 0.8) }), 18, 38],
        [() => EV.branch(), 10, 22],
      ],
      arrive: () => { EV.footsteps(4, 0.95, { heavy: true, v0: 0.06, v1: 0.26, p0: 0.8, p1: 0 }); laugh({ n: 4, f: 96, gap: 0.14, dur: 0.24, vol: 0.2, v: 'a', send: 0.7, lp: 1200, drop: 0.8, delay: 3.5 }); },
      accent: () => laugh({ n: 2, f: 92, gap: 0.14, dur: 0.22, vol: 0.18, v: 'a', send: 0.6, lp: 1200, drop: 0.8 }),
      cue: () => { EV.knock(5, 0.22, 0.2); EV.whisper(0.04); },
      leave: () => { laugh({ n: 5, f: 98, gap: 0.14, dur: 0.26, vol: 0.22, v: 'a', send: 0.8, lp: 1100, drop: 0.78 }); EV.footsteps(6, 1.0, { heavy: true, v0: 0.26, v1: 0.03, p0: 0, p1: -0.9 }); },
    },
    tuyul: {
      events: [
        [() => laugh({ n: Math.floor(rand(5, 9)), f: 520, gap: 0.05, dur: 0.09, vol: 0.1, v: 'i', pan: rand(-0.8, 0.8), send: 0.5, lp: 5600 }), 14, 30],
        [() => { const pan = rand(-0.7, 0.7); let t = 0; for (let i = 0; i < 14; i++) { noise({ f: rand(3000, 6000), q: 6, dur: 0.02, vol: 0.06, delay: t, pan, send: 0.3 }); tone({ f: rand(1800, 2600), dur: 0.04, vol: 0.02, delay: t, pan }); t += 0.04 + i * 0.012 + rand(0, 0.03); } }, 20, 44],
        [() => [2093, 3136, 4186].forEach((f, i) => tone({ f: f * rand(0.99, 1.01), dur: 0.5 - i * 0.12, vol: 0.04, a: 0.002, delay: i * 0.012, pan: rand(-0.5, 0.5), send: 0.55 })), 26, 55],
      ],
      arrive: () => { laugh({ n: 7, f: 540, gap: 0.05, dur: 0.09, vol: 0.13, v: 'i', pan: 0.6, panTo: -0.3, send: 0.55, lp: 5600 }); },
      accent: () => laugh({ n: 4, f: 520, gap: 0.05, dur: 0.09, vol: 0.11, v: 'i', pan: rand(-0.5, 0.5), send: 0.5, lp: 5600 }),
      cue: () => { voice({ f0: 520, f1: 700, dur: 0.35, v: 'a', vol: 0.1, breath: 0.2, pan: 0, send: 0.4 }); EV.knock(2, 0.3, 0.1); },
      leave: () => { laugh({ n: 10, f: 560, gap: 0.045, dur: 0.085, vol: 0.12, v: 'i', pan: -0.2, panTo: 1, send: 0.7, lp: 5000 }); const pan = 0.4; let t = 0.1; for (let i = 0; i < 18; i++) { noise({ f: rand(3000, 6000), q: 6, dur: 0.02, vol: 0.07, delay: t, pan: pan + i * 0.03, send: 0.3 }); t += 0.03 + rand(0, 0.06); } EV.creak(0.07); },
    },
    kuyang: {
      events: [
        [() => noise({ f: 900, q: 3, dur: 2.2, a: 0.6, vol: 0.08, am: 38, amDepth: 0.8, pan: rand(-0.9, -0.3), panTo: rand(0.3, 0.9), panDur: 2.2, send: 0.5 }), 14, 32],
        [() => { const p = rand(-0.5, 0.5); [440, 443, 660].forEach((f) => tone({ f, dur: 4, a: 1.6, vol: 0.035, vib: 0.012, vibRate: 3.5, pan: p, send: 0.9 })); }, 36, 75],
        [() => { for (let i = 0; i < 10; i++) noise({ f: rand(1500, 5000), q: 3, dur: 0.03, vol: 0.05, delay: rand(0, 1.6), pan: rand(-0.4, 0.4), send: 0.4 }); }, 10, 22],
        [() => noise({ f: 300, to: 1100, q: 1, dur: 2.4, a: 0.9, vol: 0.06, kind: 'pink', pan: rand(-0.9, 0.9), send: 0.7 }), 28, 60],
      ],
      arrive: () => { noise({ f: 700, q: 3, dur: 2.8, a: 0.9, vol: 0.12, am: 38, amDepth: 0.85, pan: -0.9, panTo: 0.3, panDur: 2.8, send: 0.5 }); },
      accent: () => noise({ f: 900, q: 3, dur: 1.2, a: 0.3, vol: 0.09, am: 38, amDepth: 0.8, pan: rand(-0.5, 0.5), send: 0.5 }),
      cue: () => { EV.crow(0.8, true); EV.gust(); },
      leave: () => { noise({ f: 1000, q: 3, dur: 4, a: 0.3, vol: 0.12, am: 38, amDepth: 0.85, pan: -0.2, panTo: 1, panDur: 4, send: 0.7 }); noise({ f: 500, to: 2000, q: 1, dur: 3, a: 1, vol: 0.07, kind: 'pink', pan: 0.2, panTo: 1, panDur: 3 }); },
    },
    sundel: {
      events: [
        [() => { const d = sign(); EV.heels(Math.floor(rand(5, 10)), 0.58, -0.9 * d, 0.6 * d, 0.05, 0.14); }, 16, 34],
        [() => { const mel = [247, 262, 220, 247, 196]; let t = 0; mel.forEach((f, i) => { const dur = i === 4 ? 1.6 : 0.8; voice({ f0: f, f1: f * 0.99, dur, v: 'm', vol: 0.06, vib: 0.02, vibRate: 5, breath: 0.1, delay: t, pan: rand(-0.4, 0.4), send: 0.9, lp: 2200, a: 0.2, r: 0.3 }); t += dur + 0.05; }); }, 34, 70],
        [() => { const pan = rand(-0.6, 0.6); noise({ f: 3500, q: 3, dur: 0.03, vol: 0.1, pan, send: 0.4 }); noise({ f: 5000, q: 4, dur: 0.025, vol: 0.09, delay: 0.09, pan }); noise({ f: 700, q: 0.8, dur: 0.7, a: 0.1, vol: 0.05, delay: 0.2, pan, kind: 'pink' }); }, 40, 90],
      ],
      arrive: () => EV.heels(8, 0.55, -0.9, 0, 0.04, 0.18),
      accent: () => EV.heels(3, 0.5, rand(-0.5, 0.5), 0, 0.12, 0.16),
      cue: () => {
        // car passing: engine + tyre noise sweeping across the stereo field, headlight "whoosh"
        const t = now();
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(62, t); o.frequency.linearRampToValueAtTime(84, t + 2.4); o.frequency.linearRampToValueAtTime(58, t + 4.2);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 2.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
        o.connect(lp); lp.connect(g); route(g, { pan: -1, panTo: 1, panDur: 4.2, send: 0.4 });
        o.start(t); o.stop(t + 4.5);
        noise({ f: 400, to: 1200, q: 0.8, dur: 4, a: 2, vol: 0.14, kind: 'pink', pan: -1, panTo: 1, panDur: 4, send: 0.3 });
      },
      leave: () => { EV.heels(3, 0.7, -0.2, -0.2, 0.14, 0.05); const pan = 0.1; noise({ f: 3500, q: 3, dur: 0.03, vol: 0.12, delay: 2.4, pan }); noise({ f: 5000, q: 4, dur: 0.025, vol: 0.1, delay: 2.5, pan }); noise({ f: 800, q: 0.8, dur: 1.2, a: 0.1, vol: 0.06, delay: 2.6, pan, kind: 'pink' }); },
    },
    wewe: {
      events: [
        [() => { const mel = [392, 330, 294, 330, 262, 294, 330, 262]; let t = 0; mel.forEach((f, i) => { const dur = i % 4 === 3 ? 1.1 : 0.55; voice({ f0: f * 0.5, f1: f * 0.5 * 0.995, dur, v: 'm', vol: 0.09, vib: 0.025, vibRate: 4.8, breath: 0.12, delay: t, pan: rand(-0.3, 0.3), send: 0.85, lp: 2000, a: 0.15, r: 0.25 }); t += dur + 0.04; }); }, 22, 48],
        [() => { let t = 0; for (let i = 0; i < 3; i++) { voice({ f0: 430, f1: 560, dur: 0.5, v: 'w', vol: 0.06, vib: 0.05, vibRate: 7, breath: 0.1, delay: t, pan: rand(-0.7, 0.7), send: 0.9, lp: 3600 }); voice({ f0: 560, f1: 420, dur: 0.6, v: 'w', vol: 0.05, vib: 0.05, vibRate: 7, delay: t + 0.5, pan: 0, send: 0.9, lp: 3600 }); t += 1.4; } }, 40, 85],
        [() => EV.creak(0.07), 12, 26],
        [() => EV.knock(2, 0.5, 0.07), 40, 90],
      ],
      arrive: () => { EV.knock(4, 0.7, 0.1); },
      accent: () => voice({ f0: 220, f1: 214, dur: 1.4, v: 'm', vol: 0.09, vib: 0.025, breath: 0.1, pan: rand(-0.3, 0.3), send: 0.85, lp: 2000, a: 0.3, r: 0.5 }),
      cue: () => EV.knock(8, 0.26, 0.22),
      leave: () => { const mel = [392, 330, 294, 330, 262]; let t = 0; mel.forEach((f, i) => { voice({ f0: f * 0.5, dur: 0.7, v: 'm', vol: 0.1 * (1 - i * 0.17), vib: 0.025, vibRate: 4.8, breath: 0.12, delay: t, pan: 0.3 + i * 0.15, send: 0.95, lp: 1800, a: 0.15, r: 0.3 }); t += 0.8; }); },
    },
    babi: {
      events: [
        [() => { let t = 0; for (let i = 0; i < Math.floor(rand(2, 4)); i++) { voice({ f0: 95, f1: 62, dur: 0.22, v: 'g', vol: 0.2, type: 'sawtooth', breath: 0.25, delay: t, pan: rand(-0.6, 0.6), send: 0.45, lp: 1400, a: 0.01, r: 0.08 }); tone({ f: 70, to: 45, dur: 0.18, vol: 0.12, delay: t }); t += 0.34; } }, 12, 28],
        [() => noise({ f: 900, to: 280, q: 1.4, dur: 0.22, a: 0.02, vol: 0.12, pan: rand(-0.6, 0.6), send: 0.4 }), 14, 30],
        [() => { const d = sign(); const n = 10, gap = 0.14; for (let i = 0; i < n; i++) { noise({ f: 1800, q: 3, dur: 0.03, vol: 0.06, delay: i * gap, pan: -0.8 * d + (1.6 * d * i) / n, send: 0.4 }); noise({ f: 1500, q: 3, dur: 0.03, vol: 0.05, delay: i * gap + 0.07, pan: -0.8 * d + (1.6 * d * i) / n }); } }, 18, 40],
        [() => [2093, 3136, 4186].forEach((f, i) => tone({ f: f * rand(0.99, 1.01), dur: 0.45 - i * 0.1, vol: 0.035, a: 0.002, delay: i * 0.01, pan: rand(-0.5, 0.5), send: 0.5 })), 30, 65],
      ],
      arrive: () => { for (let i = 0; i < 3; i++) voice({ f0: 95, f1: 60, dur: 0.24, v: 'g', vol: 0.22, breath: 0.3, delay: i * 0.38, pan: -0.5 + i * 0.4, send: 0.45, lp: 1400, a: 0.01, r: 0.08 }); },
      accent: () => voice({ f0: 92, f1: 58, dur: 0.22, v: 'g', vol: 0.2, breath: 0.25, pan: rand(-0.5, 0.5), send: 0.4, lp: 1400, a: 0.01, r: 0.08 }),
      cue: () => { EV.knock(10, 0.13, 0.22); },
      leave: () => { const n = 14; for (let i = 0; i < n; i++) { noise({ f: 1800, q: 3, dur: 0.03, vol: 0.12 - i * 0.006, delay: i * 0.11, pan: 0 + i * 0.07, send: 0.4 }); noise({ f: 1500, q: 3, dur: 0.03, vol: 0.1 - i * 0.005, delay: i * 0.11 + 0.055, pan: i * 0.07 }); } voice({ f0: 100, f1: 60, dur: 0.24, v: 'g', vol: 0.2, breath: 0.3, pan: 0.2, send: 0.5, lp: 1400 }); noise({ f: 2500, q: 0.9, dur: 0.5, a: 0.04, vol: 0.06, delay: 1.7, kind: 'pink', pan: 0.7 }); },
    },
  };

  /* -------------------------------------------------------------- scheduling */
  function loop(fn, min, max, my) {
    const tick = () => {
      if (my !== epoch || !ctx || !enabled) { if (my === epoch) loops.push(setTimeout(tick, 3000)); return; }
      try { fn(); } catch (e) { /* never break the loop */ }
      loops.push(setTimeout(tick, rand(min, max) * 1000));
    };
    loops.push(setTimeout(tick, rand(min * 0.25, min * 0.7) * 1000));
  }
  function clearLoops() { loops.forEach(clearTimeout); loops = []; }

  /* --------------------------------------------------------------------- API */
  const Sound = {
    get on() { return enabled; },
    async unlock() {
      const c = ensure();
      if (!c) return false;
      if (c.state === 'suspended') { try { await c.resume(); } catch { /* ignore */ } }
      return true;
    },
    setEnabled(on) {
      enabled = !!on;
      if (!ctx) return;
      master.gain.cancelScheduledValues(now());
      master.gain.setTargetAtTime(enabled ? 0.9 : 0, now(), 0.15);
      if (enabled && ctx.state === 'suspended') ctx.resume();
    },
    /** begin location ambience + ghost's random sounds */
    start(locId, ghostId) {
      if (!ensure()) return;
      this.stop(0.4);
      const my = ++epoch;
      const L = LOC[locId] || LOC.forest;
      L.beds.forEach((b) => bed(b));
      L.events.forEach(([fn, a, b]) => loop(fn, a, b, my));
      const C = CH[ghostId];
      if (C) C.events.forEach(([fn, a, b]) => loop(fn, a, b, my));
    },
    stop(fade = 1.6) {
      epoch++;
      clearLoops();
      beds.forEach((b) => b.stop(fade));
      beds = [];
    },
    arrive(id) { if (ctx && enabled && CH[id]) CH[id].arrive(); },
    accent(id) { if (ctx && enabled && CH[id]) CH[id].accent(); },
    cue(id) { if (ctx && enabled && CH[id]) CH[id].cue(); },
    leave(id) { if (ctx && enabled && CH[id]) CH[id].leave(); },
    reveal(id) { if (ctx && enabled) { this.sting(); setTimeout(() => this.accent(id), 700); } },
    omen() {
      if (!ctx || !enabled) return;
      noise({ f: 100, type: 'lowpass', q: 1, dur: 1.6, a: 0.05, vol: 0.12, am: 50, amDepth: 1, amType: 'square', send: 0.2 });
      tone({ f: 48, to: 70, dur: 5, a: 2.4, vol: 0.2, send: 0.8, type: 'sine' });
      EV.whisper(0.07);
      this.heartbeat(); setTimeout(() => this.heartbeat(), 900); setTimeout(() => this.heartbeat(), 1700);
    },
    /* UI blips used by the scanner */
    blip(freq = 880, dur = 0.08, vol = 0.05, type = 'sine') {
      if (!ctx || !enabled) return;
      tone({ f: freq, dur, vol: vol * 2, type, send: 0.1, a: 0.004 });
    },
    heartbeat() {
      if (!ctx || !enabled) return;
      tone({ f: 62, to: 40, dur: 0.2, vol: 0.5, send: 0.2, a: 0.01 });
      tone({ f: 56, to: 36, dur: 0.22, vol: 0.38, send: 0.2, a: 0.01, delay: 0.19 });
    },
    sting() {
      if (!ctx || !enabled) return;
      tone({ f: 110, dur: 1.4, vol: 0.14, type: 'sawtooth', lp: 900, a: 0.04, send: 0.7 });
      tone({ f: 116.5, dur: 1.4, vol: 0.12, type: 'sawtooth', lp: 900, a: 0.04, send: 0.7 });
      noise({ f: 3000, to: 400, q: 0.8, dur: 1.2, a: 0.02, vol: 0.12, send: 0.6 });
    },
    /* test hooks (offline rendering) */
    _test: { build, EV, CH, LOC, BEDS, bed, get ctx() { return ctx; } },
  };

  window.Sound = Sound;
})();
