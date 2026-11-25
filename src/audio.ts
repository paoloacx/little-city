/** Wind, water and the odd gull, all made with WebAudio: no files to download. */

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private gullTimer: number | null = null;
  private enabled = false;

  get isOn(): boolean {
    return this.enabled;
  }

  async setEnabled(on: boolean): Promise<void> {
    this.enabled = on;
    if (on) {
      this.ensure();
      await this.ctx?.resume();
      this.master?.gain.setTargetAtTime(0.85, this.ctx?.currentTime ?? 0, 0.4);
      this.scheduleGull();
      return;
    }
    if (this.gullTimer !== null) {
      window.clearTimeout(this.gullTimer);
      this.gullTimer = null;
    }
    this.master?.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.25);
  }

  /** A soft tick when a block lands. Silent unless the sound is on. */
  tick(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  dispose(): void {
    if (this.gullTimer !== null) window.clearTimeout(this.gullTimer);
    this.gullTimer = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  private ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // Wind: brown noise through a low pass, with a slow gust on the filter.
    const seconds = 4;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.2;

    noise.connect(filter).connect(windGain).connect(master);
    noise.start();

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 170;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();
  }

  private scheduleGull(): void {
    if (this.gullTimer !== null) window.clearTimeout(this.gullTimer);
    const delay = 4200 + Math.random() * 7000;
    this.gullTimer = window.setTimeout(() => {
      this.gull();
      if (this.enabled) this.scheduleGull();
    }, delay);
  }

  private gull(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.26);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.42);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}
