import { MUTE_KEY } from './constants';

// 用 WebAudio 现场合成音效，无需任何音频文件
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  ensure(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType = 'square', vol = 0.2, delay = 0) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.3, delay = 0, lowpass = 1200) {
    if (!this.ensure() || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shoot() {
    this.tone(900, 200, 0.09, 'square', 0.12);
  }
  hitBrick() {
    this.noise(0.06, 0.22, 0, 900);
  }
  hitSteel() {
    this.tone(220, 140, 0.06, 'square', 0.15);
    this.noise(0.04, 0.1, 0, 3000);
  }
  hitTank() {
    this.tone(300, 90, 0.1, 'sawtooth', 0.2);
  }
  explosion() {
    this.noise(0.3, 0.4, 0, 700);
    this.tone(140, 40, 0.28, 'sawtooth', 0.3);
  }
  bigExplosion() {
    this.noise(0.6, 0.5, 0, 500);
    this.tone(120, 30, 0.55, 'sawtooth', 0.35);
    this.tone(80, 25, 0.7, 'triangle', 0.3, 0.08);
  }
  powerup() {
    this.tone(500, 1000, 0.1, 'sine', 0.22);
    this.tone(750, 1500, 0.12, 'sine', 0.22, 0.09);
  }
  oneUp() {
    this.tone(660, 660, 0.09, 'square', 0.18);
    this.tone(880, 880, 0.09, 'square', 0.18, 0.09);
    this.tone(1320, 1320, 0.16, 'square', 0.18, 0.18);
  }
  freeze() {
    this.tone(1500, 300, 0.35, 'sine', 0.2);
  }
  stageStart() {
    const notes = [392, 523, 659, 784];
    notes.forEach((f, i) => this.tone(f, f, 0.12, 'square', 0.16, i * 0.11));
  }
  levelClear() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.16, i * 0.1));
  }
  gameOver() {
    const notes = [523, 392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, f * 0.97, 0.22, 'sawtooth', 0.18, i * 0.18));
  }
  uiClick() {
    this.tone(600, 500, 0.05, 'square', 0.1);
  }
}

export const sfx = new Sfx();
