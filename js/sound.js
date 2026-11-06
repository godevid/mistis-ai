/* Mistis AI — tiny WebAudio ambience (synthesised, no audio files). */
(function () {
  let ctx = null, wind = null, enabled = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function startWind(freq = 380, gain = 0.05) {
    const c = ensure();
    if (!c || wind) return;
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = gain;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.12;
    const lg = c.createGain(); lg.gain.value = freq * 0.5;
    lfo.connect(lg); lg.connect(bp.frequency);
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(); lfo.start();
    wind = { src, lfo, g, bp };
  }
  function stopWind() {
    if (!wind) return;
    try { wind.src.stop(); wind.lfo.stop(); } catch {}
    wind = null;
  }

  const Sound = {
    get on() { return enabled; },
    async enable(sceneAmb) {
      const c = ensure();
      if (!c) return false;
      if (c.state === 'suspended') await c.resume();
      enabled = true;
      startWind(sceneAmb?.freq, sceneAmb?.gain);
      return true;
    },
    disable() { enabled = false; stopWind(); },
    setScene(amb) {
      if (!enabled) return;
      stopWind();
      startWind(amb?.freq, amb?.gain);
    },
    /** short UI blips used by the scanner; works only after a user gesture */
    blip(freq = 880, dur = 0.08, vol = 0.05, type = 'sine') {
      const c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    },
    heartbeat() {
      this.blip(60, 0.18, 0.18, 'sine');
      setTimeout(() => this.blip(52, 0.2, 0.14, 'sine'), 180);
    },
    sting() {
      this.blip(110, 0.9, 0.08, 'sawtooth');
      this.blip(116, 0.9, 0.06, 'sawtooth');
    },
  };
  window.Sound = Sound;
})();
