import type { CabinAudio } from './engine';

function tone(audio: CabinAudio, freq: number, start: number, dur: number, gain: number): void {
  const ctx = audio.ctx!;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  g.connect(audio.out);
  // A chime is a sine plus a quieter octave and a slightly inharmonic partial.
  for (const [mult, amp] of [[1, 1], [2, 0.25], [2.76, 0.08]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const og = ctx.createGain();
    og.gain.value = amp;
    o.connect(og).connect(g);
    o.start(start);
    o.stop(start + dur + 0.05);
  }
}

/** Single "bing": seatbelt sign switched off. */
export function chimeSingle(audio: CabinAudio): void {
  if (!audio.ctx) return;
  tone(audio, 1318.5, audio.ctx.currentTime + 0.02, 2.2, 0.16);
}

/** "Bing-bong": cabin announcement / seatbelt sign on. */
export function chimeDouble(audio: CabinAudio): void {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime + 0.02;
  tone(audio, 1318.5, t, 1.8, 0.15);
  tone(audio, 1046.5, t + 0.55, 2.2, 0.15);
}

/** Touchdown thump: a low sine drop plus a burst of noise. */
export function thump(audio: CabinAudio): void {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(audio.out);
  o.start(t);
  o.stop(t + 0.7);
  burst(audio, 0.35, 0.5, 300);
}

/** Landing gear / flaps: a short mechanical whir and clunk. */
export function clunk(audio: CabinAudio): void {
  if (!audio.ctx) return;
  burst(audio, 0.12, 1.4, 600);
  const ctx = audio.ctx;
  const t = ctx.currentTime + 1.3;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(audio.out);
  o.start(t);
  o.stop(t + 0.3);
}

function burst(audio: CabinAudio, gain: number, dur: number, freq: number): void {
  const ctx = audio.ctx!;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(audio.out);
  src.start(t);
}

/** Captain / cabin-crew announcement via the browser's speech synthesis. */
export function announce(text: string, volume: number): void {
  if (!('speechSynthesis' in window) || volume <= 0) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 0.9;
  u.volume = Math.min(1, volume * 1.2);
  const voices = speechSynthesis.getVoices();
  const en = voices.find((v) => /en-GB/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
  if (en) u.voice = en;
  // Let the chime finish first.
  setTimeout(() => speechSynthesis.speak(u), 1600);
}
