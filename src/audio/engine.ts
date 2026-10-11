/** Inputs the cabin soundscape follows. */
export interface SoundState {
  thrust: number;
  enginesOn: boolean;
  /** Ground speed in m/s. */
  speed: number;
  onGround: boolean;
  reverse: boolean;
  /** Window shade closed: muffle a little. */
  muffled: boolean;
  /** Parked during a break: terminal ambience instead of engines. */
  parked: boolean;
}

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'brown' | 'pink'): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }
  return buf;
}

/**
 * Synthesised aircraft cabin: airflow rumble, engine fan tone + whine, jet hiss,
 * runway rumble and a soft APU/air-conditioning hum. Everything is driven by
 * `setState` with slow ramps so changes feel like engines spooling.
 */
export class CabinAudio {
  ctx: AudioContext | null = null;
  out!: GainNode;
  private master!: GainNode;
  private muffle!: BiquadFilterNode;
  private airLP!: BiquadFilterNode;
  private airGain!: GainNode;
  private rumbleGain!: GainNode;
  private fan!: OscillatorNode;
  private fan2!: OscillatorNode;
  private fanGain!: GainNode;
  private whine!: OscillatorNode;
  private whineGain!: GainNode;
  private hissBP!: BiquadFilterNode;
  private hissGain!: GainNode;
  private humGain!: GainNode;
  private volume = 0.6;
  private muted = false;

  /** Must be called from a user gesture (autoplay policy). */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const now = ctx.currentTime;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.out = ctx.createGain();
    // A gentle limiter keeps the summed layers (and chimes) from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    this.out.connect(this.muffle).connect(this.master).connect(limiter).connect(ctx.destination);

    const brown = noiseBuffer(ctx, 6, 'brown');
    const white = noiseBuffer(ctx, 4, 'white');
    const pink = noiseBuffer(ctx, 5, 'pink');
    const loop = (buf: AudioBuffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(now, Math.random() * buf.duration);
      return s;
    };

    // Airflow over the fuselage: the bed of every cabin.
    this.airLP = ctx.createBiquadFilter();
    this.airLP.type = 'lowpass';
    this.airLP.frequency.value = 300;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0;
    loop(brown).connect(this.airLP).connect(this.airGain).connect(this.out);
    const airPink = ctx.createGain();
    airPink.gain.value = 0.25;
    loop(pink).connect(airPink).connect(this.airLP);

    // Wheels on concrete: low rumble with a juddering LFO.
    const rumbleLP = ctx.createBiquadFilter();
    rumbleLP.type = 'lowpass';
    rumbleLP.frequency.value = 110;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    const judder = ctx.createGain();
    judder.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth).connect(judder.gain);
    lfo.start();
    loop(brown).connect(rumbleLP).connect(judder).connect(this.rumbleGain).connect(this.out);

    // Engine fan tone (N1) and its slightly detuned twin from the other engine.
    const fanLP = ctx.createBiquadFilter();
    fanLP.type = 'lowpass';
    fanLP.frequency.value = 900;
    this.fanGain = ctx.createGain();
    this.fanGain.gain.value = 0;
    this.fan = ctx.createOscillator();
    this.fan.type = 'sawtooth';
    this.fan2 = ctx.createOscillator();
    this.fan2.type = 'sawtooth';
    this.fan.connect(fanLP);
    this.fan2.connect(fanLP);
    fanLP.connect(this.fanGain).connect(this.out);
    this.fan.start();
    this.fan2.start();

    // High compressor whine.
    this.whine = ctx.createOscillator();
    this.whine.type = 'sine';
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain).connect(this.out);
    this.whine.start();

    // Jet exhaust hiss / roar.
    this.hissBP = ctx.createBiquadFilter();
    this.hissBP.type = 'bandpass';
    this.hissBP.Q.value = 0.7;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    loop(white).connect(this.hissBP).connect(this.hissGain).connect(this.out);

    // APU / air-conditioning hum at the gate.
    const hum = ctx.createOscillator();
    hum.frequency.value = 118;
    const humLP = ctx.createBiquadFilter();
    humLP.type = 'lowpass';
    humLP.frequency.value = 400;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    hum.type = 'triangle';
    hum.connect(humLP).connect(this.humGain).connect(this.out);
    hum.start();

    this.applyVolume();
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = volume;
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.9, this.ctx.currentTime, 0.3);
  }

  setState(s: SoundState): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const spool = 1.6; // seconds: turbofans are slow to respond
    const set = (p: AudioParam, v: number, tc = spool) => p.setTargetAtTime(v, t, tc);
    const speedK = Math.min(1, s.speed / 240);
    const thrust = s.enginesOn ? s.thrust : 0;

    set(this.airGain.gain, s.parked ? 0.05 : 0.08 + 0.22 * speedK + 0.12 * thrust, 2);
    set(this.airLP.frequency, 220 + 520 * speedK + 380 * thrust, 2);
    set(this.rumbleGain.gain, s.onGround && s.speed > 0.5 ? 0.12 + 0.55 * Math.min(1, s.speed / 75) : 0, 0.4);

    const n1 = 38 + 105 * thrust;
    set(this.fan.frequency, n1);
    set(this.fan2.frequency, n1 * 1.012);
    set(this.fanGain.gain, s.enginesOn ? 0.012 + 0.045 * thrust : 0);
    set(this.whine.frequency, 1900 + 2600 * thrust);
    set(this.whineGain.gain, s.enginesOn ? 0.0025 + 0.004 * thrust * (s.onGround ? 1.4 : 0.6) : 0);
    const roar = s.reverse ? 0.9 : thrust;
    set(this.hissBP.frequency, 700 + 1400 * roar);
    set(this.hissGain.gain, s.enginesOn ? 0.01 + 0.13 * roar * roar * (s.onGround ? 1.3 : 0.7) : 0, s.reverse ? 0.5 : spool);
    set(this.humGain.gain, s.enginesOn ? 0.004 : 0.018, 2);

    this.muffle.frequency.setTargetAtTime(s.muffled ? 1400 : 18000, t, 0.4);
  }
}
