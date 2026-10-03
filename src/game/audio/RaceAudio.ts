import type { RaceSound } from "./raceSoundCues";

const TONES: Readonly<Record<RaceSound, readonly number[]>> = {
  countdown: [440], go: [660, 880], finish: [523.25, 659.25, 783.99, 1046.5],
  pickup: [740, 988], use: [330, 660], hit: [170, 90], immune: [988, 1318], boost: [220, 440], collision: [110],
};

/** Original synthesized cues. Context is constructed only after a user gesture. */
export class RaceAudio {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly voices = new Set<OscillatorNode>();

  constructor() { this.master.connect(this.context.destination); this.master.gain.value = 0; }
  async resume() { await this.context.resume(); }
  setVolume(volume: number) {
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.18, this.context.currentTime, 0.02);
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
    for (const voice of this.voices) { voice.stop(); voice.disconnect(); }
    this.voices.clear(); this.master.disconnect();
    void this.context.close();
  }
}
