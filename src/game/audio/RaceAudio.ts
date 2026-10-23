import type { RaceSound } from "./raceSoundCues";
import { drivingMix } from "./drivingSound";

const TONES: Readonly<Record<RaceSound, readonly number[]>> = {
  countdown: [440], go: [660, 880], finish: [523.25, 659.25, 783.99, 1046.5],
  pickup: [740, 988], use: [330, 660], hit: [170, 90], immune: [988, 1318], boost: [220, 440], collision: [110],
  drift1: [440, 554], drift2: [554, 698], drift3: [698, 880, 1109], crossing: [880, 660],
  draftReady: [660, 990, 1320], draftBoost: [330, 660, 990],
};

/** Original synthesized cues. Context is constructed only after a user gesture. */
export class RaceAudio {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly voices = new Set<OscillatorNode>();
  private readonly engine = this.context.createOscillator();
  private readonly harmonic = this.context.createOscillator();
  private readonly engineGain = this.context.createGain();
  private readonly wind = this.context.createBufferSource();
  private readonly tires = this.context.createBufferSource();
  private readonly windGain = this.context.createGain();
  private readonly tireGain = this.context.createGain();
  private readonly windFilter = this.context.createBiquadFilter();
  private readonly tireFilter = this.context.createBiquadFilter();
  private disposed = false;

  constructor() {
    this.master.connect(this.context.destination); this.master.gain.value = 0;
    this.engine.type = "triangle"; this.harmonic.type = "sine";
    this.engine.connect(this.engineGain); this.harmonic.connect(this.engineGain); this.engineGain.connect(this.master);
    const noise = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const samples = noise.getChannelData(0);
    let seed = 173;
    for (let i = 0; i < samples.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
    this.wind.buffer = this.tires.buffer = noise; this.wind.loop = this.tires.loop = true;
    this.windFilter.type = "lowpass"; this.windFilter.frequency.value = 650;
    this.tireFilter.type = "bandpass"; this.tireFilter.frequency.value = 1500; this.tireFilter.Q.value = 1.8;
    this.wind.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
    this.tires.connect(this.tireFilter); this.tireFilter.connect(this.tireGain); this.tireGain.connect(this.master);
    this.engineGain.gain.value = this.windGain.gain.value = this.tireGain.gain.value = 0;
    this.engine.start(); this.harmonic.start(); this.wind.start(); this.tires.start();
  }
  async resume() { await this.context.resume(); }
  setVolume(volume: number) {
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.18, this.context.currentTime, 0.02);
  }
  drive(speed: number, drifting: boolean, boosting: boolean, active: boolean, draftCharge = 0) {
    if (this.disposed) return;
    const mix = drivingMix(speed, drifting, boosting, active, draftCharge), now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(mix.frequency, now, .06);
    this.harmonic.frequency.setTargetAtTime(mix.frequency * 2, now, .06);
    this.engineGain.gain.setTargetAtTime(mix.engine, now, .05);
    this.windGain.gain.setTargetAtTime(mix.wind, now, .08);
    this.tireGain.gain.setTargetAtTime(mix.tires, now, .04);
  }
  play(sound: RaceSound) {
    if (this.context.state !== "running") return;
    TONES[sound].forEach((frequency, index) => {
      if (this.voices.size >= 12) return;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime + index * 0.1;
      oscillator.type = sound === "collision" || sound === "hit" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.6, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain); gain.connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect();
      };
      oscillator.start(start); oscillator.stop(start + 0.2);
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.voices) { voice.stop(); voice.disconnect(); }
    for (const source of [this.engine, this.harmonic, this.wind, this.tires]) { source.stop(); source.disconnect(); }
    for (const node of [this.engineGain, this.windGain, this.tireGain, this.windFilter, this.tireFilter]) node.disconnect();
    this.voices.clear(); this.master.disconnect();
    void this.context.close();
  }
}
