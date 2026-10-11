import type { Durations, TimerSnapshot } from './timer';

export interface Settings extends Durations {
  volume: number;
  muted: boolean;
  announcements: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  longEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  volume: 0.6,
  muted: false,
  announcements: true,
};

export interface Journey {
  from: string;
  to: string;
  flightNo: string;
}

export interface Task {
  id: number;
  text: string;
  done: boolean;
}

export interface Persisted {
  settings: Settings;
  timer?: TimerSnapshot;
  journey?: Journey;
  view?: 'seat' | 'window';
  tasks?: Task[];
  shade?: boolean;
  zoom?: number;
}

const KEY = 'plane-pomodoro:v1';

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<Persisted>;
      return { ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { settings: { ...DEFAULT_SETTINGS } };
}

export function save(data: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
