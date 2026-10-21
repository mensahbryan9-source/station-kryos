// Sons et musique 100 % synthétisés avec la Web Audio API.

class Audio {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.5;
    this.listener = { x: 0, y: 0, a: 0 };
    this.seqTimer = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -14; this.master.ratio.value = 4;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.35; this.mus.connect(this.master);
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // réverbération courte pour l'ambiance des coursives métalliques
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
    }
    this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.22;
    this.verb.connect(vg); vg.connect(this.master);
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.ctx) {
      this.sfx.gain.value = sfx;
      this.mus.gain.value = music * 0.35;
    }
  }

  // Crée une chaîne gain + panoramique selon la position de la source.
  out(pos, vol = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let v = vol, pan = 0;
    if (pos) {
      const dx = pos.x - this.listener.x, dy = pos.y - this.listener.y;
      const dist = Math.hypot(dx, dy);
      v *= Math.min(1, 2.2 / (dist + 1.2));
      const ang = Math.atan2(dy, dx) - this.listener.a;
      pan = Math.max(-1, Math.min(1, Math.sin(ang)));
    }
    g.gain.value = v;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(this.sfx); p.connect(this.verb);
    } else { g.connect(this.sfx); }
    return g;
  }

  osc(type, f0, f1, dur, vol, dest, t = 0, attack = 0.005) {
    const ctx = this.ctx, now = ctx.currentTime + t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(dest);
    o.start(now); o.stop(now + dur + 0.05);
    return o;
  }

  noise(dur, vol, dest, { type = 'lowpass', f0 = 4000, f1 = 300, q = 1, t = 0 } = {}) {
    const ctx = this.ctx, now = ctx.currentTime + t;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, now);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(now, Math.random()); s.stop(now + dur + 0.05);
  }

  play(name, pos, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const fn = SOUNDS[name];
    if (fn) fn(this, this.out(pos, vol));
  }

  // ——— Musique générative ———
  startMusic(cfg) {
    this.stopMusic();
    if (!this.ctx || !cfg) return;
    const ctx = this.ctx;
    const beat = 60 / cfg.tempo / 2; // croches
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const prog = [0, 0, 3, 3, 5, 5, -2, -2];
    let step = 0, next = ctx.currentTime + 0.1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(this.mus);
    this.musFilter = lp;
    const tick = () => {
      while (next < ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 16), pos = step % 16;
        const chordRoot = cfg.root + prog[bar % prog.length];
        // basse
        if (pos % 4 === 0 || pos === 14) this.osc('sawtooth', midi(chordRoot - 12), midi(chordRoot - 12), beat * 1.8, 0.22, lp, next - ctx.currentTime);
        // nappe
        if (pos === 0) {
          for (const iv of [0, 7, 12 + cfg.scale[1]]) {
            const o = this.osc('triangle', midi(chordRoot + iv), midi(chordRoot + iv), beat * 15, 0.05, lp, next - ctx.currentTime, beat * 4);
            o.detune.value = (Math.random() - 0.5) * 14;
          }
        }
        // arpège
        if (pos % 2 === 0 && Math.random() < 0.8) {
          const deg = cfg.scale[(step * 3 + bar) % cfg.scale.length];
          this.osc('square', midi(chordRoot + 12 + deg + (pos > 8 ? 12 : 0)), midi(chordRoot + 12 + deg), beat * 0.9, 0.035, lp, next - ctx.currentTime);
        }
        // percussions
        if (pos % 8 === 0) this.osc('sine', 120, 40, 0.25, 0.5, this.mus, next - ctx.currentTime);
        if (pos % 8 === 4) this.noise(0.12, 0.18, this.mus, { type: 'bandpass', f0: 1800, f1: 900, q: 0.8, t: next - ctx.currentTime });
        if (pos % 2 === 1) this.noise(0.03, 0.05, this.mus, { type: 'highpass', f0: 7000, f1: 6000, t: next - ctx.currentTime });
        next += beat; step++;
      }
    };
    tick();
    this.seqTimer = setInterval(tick, 60);
  }

  stopMusic() {
    if (this.seqTimer) clearInterval(this.seqTimer);
    this.seqTimer = null;
  }

  muffle(on) { if (this.musFilter) this.musFilter.frequency.value = on ? 450 : 1400; }
}

const SOUNDS = {
  blade: (a, o) => { a.noise(0.22, 0.6, o, { type: 'bandpass', f0: 600, f1: 3000, q: 2 }); a.osc('sine', 900, 1800, 0.15, 0.15, o); },
  pistol: (a, o) => { a.osc('square', 1200, 180, 0.14, 0.35, o); a.noise(0.08, 0.5, o, { f0: 6000, f1: 800 }); },
  rifle: (a, o) => { a.osc('sawtooth', 1600, 300, 0.09, 0.28, o); a.noise(0.06, 0.4, o, { f0: 8000, f1: 1200 }); },
  scatter: (a, o) => { a.noise(0.45, 1.0, o, { f0: 5000, f1: 120 }); a.osc('sine', 140, 40, 0.3, 0.8, o); },
  arc: (a, o) => {
    const ctx = a.ctx, now = ctx.currentTime;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sawtooth'; car.frequency.value = 220; mod.type = 'square'; mod.frequency.value = 57;
    mg.gain.value = 900; mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    car.connect(g); g.connect(o); car.start(now); mod.start(now); car.stop(now + 0.65); mod.stop(now + 0.65);
    a.noise(0.5, 0.6, o, { type: 'highpass', f0: 2000, f1: 6000 });
  },
  dry: (a, o) => a.osc('square', 300, 280, 0.06, 0.2, o),
  hit: (a, o) => { a.noise(0.08, 0.5, o, { f0: 2500, f1: 300 }); },
  wallhit: (a, o) => { a.noise(0.05, 0.25, o, { type: 'bandpass', f0: 3000, f1: 1500, q: 3 }); },
  plasma: (a, o) => { a.osc('sine', 900, 250, 0.3, 0.35, o); a.osc('triangle', 1800, 500, 0.2, 0.1, o); },
  orb: (a, o) => { a.osc('sawtooth', 300, 90, 0.5, 0.35, o); a.osc('sine', 600, 150, 0.5, 0.25, o); },
  sentShot: (a, o) => { a.osc('square', 700, 200, 0.08, 0.3, o); a.noise(0.06, 0.35, o, { f0: 5000, f1: 900 }); },
  claw: (a, o) => { a.noise(0.2, 0.6, o, { type: 'bandpass', f0: 2000, f1: 500, q: 2 }); a.osc('sawtooth', 120, 60, 0.2, 0.3, o); },
  alert_g: (a, o) => { a.osc('square', 880, 880, 0.08, 0.2, o); a.osc('square', 1320, 1320, 0.1, 0.2, o, 0.1); },
  alert_s: (a, o) => { a.osc('sawtooth', 220, 220, 0.12, 0.25, o); a.osc('sawtooth', 165, 165, 0.18, 0.25, o, 0.14); },
  alert_m: (a, o) => { a.osc('sawtooth', 90, 55, 0.6, 0.5, o); a.noise(0.5, 0.3, o, { type: 'bandpass', f0: 400, f1: 200, q: 3 }); },
  alert_O: (a, o) => { a.osc('sawtooth', 70, 35, 1.6, 0.7, o); a.osc('square', 105, 52, 1.6, 0.2, o); a.noise(1.4, 0.4, o, { f0: 600, f1: 80 }); },
  die_g: (a, o) => { a.noise(0.6, 0.8, o, { f0: 3000, f1: 100 }); a.osc('sine', 200, 30, 0.4, 0.6, o); },
  die_s: (a, o) => { a.osc('sawtooth', 400, 40, 0.9, 0.35, o); a.noise(0.3, 0.4, o, { f0: 4000, f1: 400 }); },
  die_m: (a, o) => { a.noise(0.7, 0.7, o, { type: 'bandpass', f0: 900, f1: 120, q: 2 }); a.osc('sawtooth', 110, 30, 0.8, 0.4, o); },
  die_O: (a, o) => { for (let i = 0; i < 5; i++) { a.noise(1.2, 0.9, o, { f0: 2500, f1: 60, t: i * 0.35 }); a.osc('sine', 120, 25, 1, 0.8, o, i * 0.35); } },
  pain_g: (a, o) => a.osc('square', 1400, 600, 0.08, 0.15, o),
  pain_s: (a, o) => a.osc('square', 300, 150, 0.1, 0.2, o),
  pain_m: (a, o) => a.osc('sawtooth', 160, 90, 0.2, 0.3, o),
  pain_O: (a, o) => a.osc('sawtooth', 120, 70, 0.3, 0.35, o),
  hurt: (a, o) => { a.osc('sawtooth', 180, 80, 0.25, 0.35, o); a.noise(0.15, 0.3, o, { f0: 1200, f1: 200 }); },
  die: (a, o) => { a.osc('sawtooth', 220, 30, 1.5, 0.5, o); a.osc('square', 110, 20, 1.5, 0.2, o); },
  door: (a, o) => { a.noise(0.7, 0.5, o, { type: 'bandpass', f0: 300, f1: 900, q: 1.5 }); a.osc('sine', 80, 60, 0.6, 0.3, o); },
  locked: (a, o) => { a.osc('square', 140, 140, 0.15, 0.3, o); a.osc('square', 110, 110, 0.2, 0.3, o, 0.16); },
  push: (a, o) => { a.noise(1.6, 0.6, o, { type: 'lowpass', f0: 500, f1: 150 }); a.osc('sawtooth', 50, 40, 1.6, 0.3, o); },
  secret: (a, o) => [0, 4, 7, 12, 16].forEach((n, i) => a.osc('triangle', 523 * Math.pow(2, n / 12), 523 * Math.pow(2, n / 12), 0.25, 0.2, o, i * 0.07)),
  pickup: (a, o) => { a.osc('square', 660, 660, 0.06, 0.15, o); a.osc('square', 990, 990, 0.08, 0.15, o, 0.06); },
  health: (a, o) => { a.osc('sine', 440, 880, 0.25, 0.3, o); },
  armor: (a, o) => { a.osc('triangle', 330, 660, 0.3, 0.3, o); a.noise(0.2, 0.2, o, { type: 'highpass', f0: 3000, f1: 6000 }); },
  key: (a, o) => [0, 7, 12].forEach((n, i) => a.osc('sine', 880 * Math.pow(2, n / 12), 880 * Math.pow(2, n / 12), 0.3, 0.25, o, i * 0.08)),
  treasure: (a, o) => [0, 5, 9, 14].forEach((n, i) => a.osc('triangle', 1046 * Math.pow(2, n / 12), 1046 * Math.pow(2, n / 12), 0.18, 0.16, o, i * 0.05)),
  weapon: (a, o) => { a.noise(0.15, 0.4, o, { type: 'bandpass', f0: 1500, f1: 800, q: 2 }); [0, 3, 7, 12].forEach((n, i) => a.osc('square', 330 * Math.pow(2, n / 12), 330 * Math.pow(2, n / 12), 0.12, 0.12, o, 0.1 + i * 0.06)); },
  boom: (a, o) => { a.noise(1.0, 1.0, o, { f0: 3000, f1: 50 }); a.osc('sine', 90, 25, 0.8, 1.0, o); },
  exit: (a, o) => [0, 4, 7, 11, 14].forEach((n, i) => a.osc('triangle', 392 * Math.pow(2, n / 12), 392 * Math.pow(2, n / 12), 0.6, 0.18, o, i * 0.09)),
  click: (a, o) => { a.noise(0.03, 0.4, o, { type: 'highpass', f0: 3000, f1: 2500 }); a.osc('square', 2200, 1800, 0.02, 0.08, o); },
  blip: (a, o) => a.osc('square', 1100, 1100, 0.04, 0.12, o),
  select: (a, o) => { a.osc('square', 660, 660, 0.05, 0.14, o); a.osc('square', 1320, 1320, 0.07, 0.14, o, 0.05); },
  step: (a, o) => a.noise(0.05, 0.06, o, { type: 'bandpass', f0: 700, f1: 400, q: 2 }),
  switchW: (a, o) => a.noise(0.08, 0.25, o, { type: 'bandpass', f0: 2500, f1: 1200, q: 3 }),
};

export const audio = new Audio();
