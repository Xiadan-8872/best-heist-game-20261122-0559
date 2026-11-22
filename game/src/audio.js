// Synthesised sound for The Velvet Vault — no audio files, everything is
// built with the Web Audio API at run time. The museum at 2:14 AM is quiet:
// soft footsteps, a low room tone, a ticking vault, and an alarm that
// climbs when the night goes wrong. M mutes. Audio starts on the first
// key press or click, so a silent page load never throws.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.roomTone = null;
    this.stepAlt = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startRoomTone();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  startRoomTone() {
    // A barely-there low hum plus slow filtered noise: the museum's air.
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 52;
    const g = ctx.createGain();
    g.gain.value = 0.018;
    osc.connect(g).connect(this.master);
    osc.start();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 220;
    const ng = ctx.createGain();
    ng.gain.value = 0.012;
    noise.connect(filt).connect(ng).connect(this.master);
    noise.start();
    this.roomTone = { osc, noise };
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      /* audio is best-effort */
    }
  }

  noiseBurst(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq || 900;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.15;
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
    } catch {
      /* audio is best-effort */
    }
  }

  step(sneaking) {
    this.stepAlt = !this.stepAlt;
    // Sneaking is silent by design; a soft tap is all a walk makes.
    this.blip(sneaking ? 0 : this.stepAlt ? 190 : 160, 0.05, 'triangle', sneaking ? 0 : 0.045);
  }

  dash() {
    this.noiseBurst(0.16, 0.2, 1400);
    this.blip(320, 0.14, 'sawtooth', 0.05, 140);
  }

  pickup() {
    this.blip(880, 0.09, 'sine', 0.14);
    setTimeout(() => this.blip(1318, 0.14, 'sine', 0.12), 70);
  }

  vaultTick(p) {
    this.blip(1200 + p * 900, 0.04, 'square', 0.05);
  }

  vaultOpen() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.12), i * 90));
  }

  spotted() {
    this.blip(220, 0.18, 'sawtooth', 0.14, 440);
  }

  busted() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.13), i * 130));
  }

  alarmLoop(on) {
    if (!this.ctx) return;
    // Two-tone alarm while the meter is high; called once a second by the engine.
    if (on && !this.muted) {
      this.blip(740, 0.22, 'square', 0.05);
      setTimeout(() => this.blip(554, 0.22, 'square', 0.05), 240);
    }
  }

  cameraOff() {
    this.blip(1500, 0.06, 'square', 0.08, 500);
  }

  jobDone() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'triangle', 0.11), i * 80));
  }

  nightDone(ghost) {
    const seq = ghost
      ? [523, 659, 784, 1046, 1318, 1568]
      : [392, 523, 659, 784, 1046];
    seq.forEach((f, i) => setTimeout(() => this.blip(f, 0.28, 'triangle', 0.12), i * 110));
  }
}
