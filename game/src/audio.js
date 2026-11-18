// audio.js — VELMARA v6: every sound is synthesized live with WebAudio.
// Engine hum, sirens, gunfire, pickups and three radio stations — no audio files.
'use strict';

const Audio8 = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  engineOsc1: null,
  engineOsc2: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  muted: false,
  station: 0,
  radioTimer: null,
  step: 0,
  nextStepTime: 0,
  started: false,

  init: function () {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.30;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 700;
      this.engineOsc1.connect(filt); this.engineOsc2.connect(filt);
      filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc1.start(); this.engineOsc2.start();
      // Siren: one triangle that the update loop wails up and down.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.started = true;
      this.startRadio();
    } catch (e) { this.ctx = null; }
  },

  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setMuted: function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  },

  setStation: function (i) {
    this.station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
    this.step = 0;
    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.05;
  },

  // The radio is a step sequencer: bass + hats + lead, different per station.
  startRadio: function () {
    if (!this.ctx || this.radioTimer) return;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.radioTimer = setInterval(() => this.scheduleRadio(), 40);
  },

  scheduleRadio: function () {
    if (!this.ctx || this.muted) return;
    const st = RADIO[this.station];
    if (!st || st.bpm === 0) { this.talkChatter(); return; }
    const stepDur = 60 / st.bpm / 2; // eighth notes
    while (this.nextStepTime < this.ctx.currentTime + 0.18) {
      this.playRadioStep(st, this.step, this.nextStepTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += stepDur;
    }
  },

  playRadioStep: function (st, step, t, stepDur) {
    const scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const bar = Math.floor(step / 16) % 4;
    const roots = [0, 0, -4, 5]; // chord roots in semitones per bar
    const root = st.root * Math.pow(2, roots[bar] / 12);
    // Bass on beats 0, 4, 8, 12 and the off-beat for latin.
    if (step % 4 === 0 || (st.id === 1 && step % 8 === 6)) {
      this.tone(root / 2, t, stepDur * 1.8, 'triangle', 0.5, this.musicGain);
    }
    // Hat tick on every off-beat.
    if (step % 2 === 1) this.noiseBurst(t, 0.03, 0.10, 6000, this.musicGain);
    // Lead arpeggio, sparse so it never gets annoying.
    if (step % 8 === 2 || step % 8 === 5) {
      const deg = scale[(step * 3 + bar) % scale.length];
      this.tone(root * 2 * Math.pow(2, deg / 12), t, stepDur * 0.9, 'square', 0.08, this.musicGain);
    }
    // Snare-ish noise on 4 and 12 for the synthwave station.
    if (st.id === 0 && (step % 16 === 4 || step % 16 === 12)) this.noiseBurst(t, 0.09, 0.16, 1800, this.musicGain);
  },

  talkChatter: function () {
    // Talk radio: soft blips that sound like a distant broadcast, rarely.
    if (Math.random() < 0.02 && this.ctx) {
      const t = this.ctx.currentTime;
      this.tone(180 + Math.random() * 120, t, 0.08, 'sine', 0.05, this.musicGain);
    }
  },

  tone: function (freq, t, dur, type, vol, dest) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noiseBurst: function (t, dur, vol, freq, dest) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t);
  },

  sfx: function (name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (name === 'shoot') this.noiseBurst(t, 0.12, 0.5, 900);
    else if (name === 'shotgun') this.noiseBurst(t, 0.25, 0.7, 500);
    else if (name === 'pickup') { this.tone(880, t, 0.12, 'sine', 0.3); this.tone(1318, t + 0.08, 0.18, 'sine', 0.3); }
    else if (name === 'coin') { this.tone(1567, t, 0.1, 'sine', 0.25); this.tone(2093, t + 0.07, 0.16, 'sine', 0.25); }
    else if (name === 'mission') { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.09, 0.22, 'triangle', 0.3)); }
    else if (name === 'fail') { [392, 330, 262].forEach((f, i) => this.tone(f, t + i * 0.14, 0.25, 'sawtooth', 0.2)); }
    else if (name === 'crash') this.noiseBurst(t, 0.3, 0.6, 300);
    else if (name === 'honk') { this.tone(370, t, 0.18, 'square', 0.25); this.tone(466, t, 0.18, 'square', 0.2); }
    else if (name === 'door') { this.tone(220, t, 0.08, 'square', 0.2); this.noiseBurst(t, 0.06, 0.2, 800); }
    else if (name === 'busted') { [440, 415, 392, 370].forEach((f, i) => this.tone(f, t + i * 0.16, 0.3, 'sawtooth', 0.25)); }
    else if (name === 'cash') { this.tone(1046, t, 0.1, 'sine', 0.28); this.tone(1568, t + 0.06, 0.14, 'sine', 0.28); }
  },

  update: function (speedFrac, inCar, wanted, nearCop, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineOsc1) {
      const f = inCar ? 55 + speedFrac * 165 : 0;
      this.engineOsc1.frequency.setTargetAtTime(f, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(f * 1.5 + 3, t, 0.08);
      this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speedFrac * 0.06 : 0, t, 0.1);
    }
    if (this.sirenOsc) {
      const wail = wanted > 0 && nearCop;
      const phase = (t * 0.9) % 1;
      this.sirenOsc.frequency.setTargetAtTime(wail ? (phase < 0.5 ? 720 : 960) : 700, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(wail ? 0.045 : 0, t, 0.2);
    }
    // Wanted music: the radio gets tenser — hats double when the heat is on.
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(wanted >= 3 ? 0.38 : 0.30, t, 0.5);
  },
};
