import { clamp, easeInOut, lerp, smoothstep } from '../util/math';

export type FlightPhase = 'gate' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'approach' | 'taxiIn';

/** Share of the focus session spent in each phase (sums to 1). */
export const PHASES: { id: FlightPhase; share: number }[] = [
  { id: 'gate', share: 0.06 },
  { id: 'takeoff', share: 0.04 },
  { id: 'climb', share: 0.12 },
  { id: 'cruise', share: 0.58 },
  { id: 'descent', share: 0.12 },
  { id: 'approach', share: 0.06 },
  { id: 'taxiIn', share: 0.02 },
];

export const CRUISE_ALT_M = 11000;
/** Within the gate phase: boarding until here, then taxi. */
export const GATE_TAXI_START = 0.35;
/** Within the takeoff phase: wheels leave the runway here. */
export const LIFTOFF = 0.8;
/** Within the approach phase: wheels touch the runway here. */
export const TOUCHDOWN = 0.7;
/** Distances are scripted as if the flight took this long; shorter/longer sessions just play faster/slower. */
const REF_DURATION_S = 25 * 60;

export interface FlightState {
  progress: number;
  phase: FlightPhase;
  phaseProgress: number;
  /** Altitude above ground in metres. */
  altitude: number;
  /** Ground speed in m/s. */
  speed: number;
  /** Distance travelled along track in metres (scene coordinate). */
  x: number;
  pitch: number;
  bank: number;
  flaps: number;
  spoilers: number;
  /** Engine thrust 0..1 (0 = engines off). */
  thrust: number;
  enginesOn: boolean;
  reverse: boolean;
  onGround: boolean;
  seatbelt: boolean;
  label: string;
}

const STARTS: number[] = [];
{
  let acc = 0;
  for (const p of PHASES) {
    STARTS.push(acc);
    acc += p.share;
  }
}

export function phaseAt(progress: number): { phase: FlightPhase; index: number; pp: number } {
  const p = clamp(progress);
  for (let i = PHASES.length - 1; i > 0; i--) {
    if (p >= STARTS[i]) return { phase: PHASES[i].id, index: i, pp: clamp((p - STARTS[i]) / PHASES[i].share) };
  }
  return { phase: PHASES[0].id, index: 0, pp: clamp(p / PHASES[0].share) };
}

/** Overall progress at which a phase (plus a fraction of it) is reached. */
export function progressOf(phase: FlightPhase, pp = 0): number {
  const i = PHASES.findIndex((p) => p.id === phase);
  return STARTS[i] + PHASES[i].share * pp;
}

function speedAt(phase: FlightPhase, pp: number): number {
  switch (phase) {
    case 'gate':
      return 8 * smoothstep(GATE_TAXI_START, GATE_TAXI_START + 0.1, pp) * (1 - smoothstep(0.88, 1, pp));
    case 'takeoff':
      return pp < 0.1 ? 0 : 82 * Math.pow((pp - 0.1) / 0.9, 0.9);
    case 'climb':
      return lerp(82, 240, pp);
    case 'cruise':
      return 240;
    case 'descent':
      return lerp(240, 120, pp);
    case 'approach':
      return pp < TOUCHDOWN
        ? lerp(120, 70, pp / TOUCHDOWN)
        : 70 - 60 * Math.pow((pp - TOUCHDOWN) / (1 - TOUCHDOWN), 0.7);
    case 'taxiIn':
      return 9 * (1 - smoothstep(0.75, 1, pp));
  }
}

function altitudeAt(phase: FlightPhase, pp: number): number {
  switch (phase) {
    case 'gate':
      return 0;
    case 'takeoff':
      return pp < LIFTOFF ? 0 : 120 * ((pp - LIFTOFF) / (1 - LIFTOFF)) ** 2;
    case 'climb':
      return 120 + (CRUISE_ALT_M - 120) * (1 - (1 - pp) ** 1.6);
    case 'cruise':
      return CRUISE_ALT_M;
    case 'descent':
      return CRUISE_ALT_M - (CRUISE_ALT_M - 900) * easeInOut(pp);
    case 'approach':
      return pp < TOUCHDOWN ? 900 * Math.pow(1 - pp / TOUCHDOWN, 1.15) : 0;
    case 'taxiIn':
      return 0;
  }
}

// Distance travelled is the integral of speed; tabulate once.
const N = 4000;
const X_TABLE = new Float64Array(N + 1);
{
  const dt = REF_DURATION_S / N;
  let prev = 0;
  for (let i = 1; i <= N; i++) {
    const { phase, pp } = phaseAt(i / N);
    const v = speedAt(phase, pp);
    X_TABLE[i] = X_TABLE[i - 1] + 0.5 * (prev + v) * dt;
    prev = v;
  }
}

export function distanceAt(progress: number): number {
  const f = clamp(progress) * N;
  const i = Math.min(Math.floor(f), N - 1);
  return lerp(X_TABLE[i], X_TABLE[i + 1], f - i);
}

export const TOTAL_DISTANCE = X_TABLE[N];

const LABELS: Record<FlightPhase, string> = {
  gate: 'Taxiing',
  takeoff: 'Takeoff',
  climb: 'Climbing',
  cruise: 'Cruising',
  descent: 'Descending',
  approach: 'Final approach',
  taxiIn: 'Taxiing to gate',
};

export function flightState(progress: number): FlightState {
  const p = clamp(progress);
  const { phase, pp } = phaseAt(p);
  const altitude = altitudeAt(phase, pp);
  const speed = speedAt(phase, pp);

  let pitch = 0, bank = 0, flaps = 0, spoilers = 0, thrust = 0;
  let enginesOn = true, reverse = false, seatbelt = true;
  let label = LABELS[phase];

  switch (phase) {
    case 'gate':
      enginesOn = pp > 0.2;
      thrust = enginesOn
        ? 0.12 + 0.08 * smoothstep(GATE_TAXI_START, GATE_TAXI_START + 0.05, pp) * (1 - smoothstep(0.45, 0.55, pp))
        : 0;
      flaps = 0.35 * smoothstep(0.55, 0.7, pp);
      if (pp < GATE_TAXI_START) label = pp < 0.2 ? 'Boarding' : 'Pushback';
      break;
    case 'takeoff':
      thrust = pp < 0.1 ? lerp(0.12, 0.45, pp / 0.1) : lerp(0.45, 1, smoothstep(0.1, 0.22, pp));
      pitch = 11 * smoothstep(0.72, 0.9, pp);
      flaps = 0.35;
      if (pp >= LIFTOFF) label = 'Liftoff';
      break;
    case 'climb':
      thrust = lerp(0.92, 0.78, pp);
      pitch = lerp(11, 3, smoothstep(0, 0.6, pp)) * (1 - smoothstep(0.92, 1, pp));
      bank = 14 * Math.sin(Math.PI * clamp((pp - 0.12) / 0.3));
      flaps = 0.35 * (1 - smoothstep(0.15, 0.3, pp));
      break;
    case 'cruise':
      thrust = 0.62;
      seatbelt = pp > 0.97;
      break;
    case 'descent':
      thrust = 0.2;
      pitch = -2 * smoothstep(0, 0.1, pp) * (1 - smoothstep(0.85, 1, pp));
      bank = -10 * Math.sin(Math.PI * clamp((pp - 0.55) / 0.3));
      break;
    case 'approach':
      if (pp < TOUCHDOWN) {
        thrust = 0.38;
        pitch = lerp(2.5, 5, smoothstep(TOUCHDOWN - 0.12, TOUCHDOWN, pp));
        flaps = lerp(0.5, 1, smoothstep(0, 0.4, pp));
      } else {
        reverse = pp > TOUCHDOWN + 0.01 && pp < 0.88;
        thrust = reverse ? 0.85 : 0.15;
        pitch = 5 * (1 - smoothstep(TOUCHDOWN, TOUCHDOWN + 0.05, pp));
        flaps = 1;
        spoilers = 1 - smoothstep(0.9, 1, pp);
        label = 'Landed';
      }
      break;
    case 'taxiIn':
      enginesOn = pp < 0.92;
      thrust = enginesOn ? 0.12 : 0;
      flaps = 1 - smoothstep(0, 0.3, pp);
      break;
  }

  return {
    progress: p,
    phase,
    phaseProgress: pp,
    altitude,
    speed,
    x: distanceAt(p),
    pitch,
    bank,
    flaps,
    spoilers,
    thrust,
    enginesOn,
    reverse,
    onGround: altitude <= 0,
    seatbelt,
    label,
  };
}

/** The aircraft parked at the gate with engines off (used for breaks). */
export function parkedState(): FlightState {
  return { ...flightState(0), label: 'At the gate', enginesOn: false, thrust: 0, seatbelt: false };
}
