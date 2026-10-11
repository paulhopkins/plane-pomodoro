export type Mode = 'focus' | 'shortBreak' | 'longBreak';

export interface Durations {
  focus: number;
  shortBreak: number;
  longBreak: number;
  /** A long break follows every N focus sessions. */
  longEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export interface TimerSnapshot {
  mode: Mode;
  running: boolean;
  /** Epoch ms when the current running stretch began. */
  anchor: number;
  /** Ms elapsed in this session before `anchor`. */
  accumulated: number;
  /** Focus sessions completed in total. */
  completed: number;
}

export type TimerEvent =
  | { type: 'complete'; mode: Mode; next: Mode; autoStarted: boolean }
  | { type: 'start'; mode: Mode; fresh: boolean }
  | { type: 'pause'; mode: Mode };

/**
 * Wall-clock based pomodoro state machine: elapsed time is derived from
 * Date.now() so throttled background tabs stay accurate.
 */
export class PomodoroTimer {
  private s: TimerSnapshot;

  constructor(
    private config: () => Durations,
    private now: () => number = Date.now,
    snapshot?: TimerSnapshot,
  ) {
    this.s = snapshot ? { ...snapshot } : { mode: 'focus', running: false, anchor: 0, accumulated: 0, completed: 0 };
  }

  get mode(): Mode { return this.s.mode; }
  get running(): boolean { return this.s.running; }
  get completed(): number { return this.s.completed; }
  snapshot(): TimerSnapshot { return { ...this.s }; }

  durationMs(mode: Mode = this.s.mode): number {
    return this.config()[mode] * 60_000;
  }

  elapsedMs(): number {
    return this.s.accumulated + (this.s.running ? this.now() - this.s.anchor : 0);
  }

  remainingMs(): number {
    return Math.max(0, this.durationMs() - this.elapsedMs());
  }

  progress(): number {
    return Math.min(1, this.elapsedMs() / this.durationMs());
  }

  /** Focus sessions completed within the current long-break cycle. */
  cyclePosition(): number {
    return this.s.completed % this.config().longEvery;
  }

  start(): TimerEvent[] {
    if (this.s.running) return [];
    const fresh = this.s.accumulated === 0;
    this.s.running = true;
    this.s.anchor = this.now();
    return [{ type: 'start', mode: this.s.mode, fresh }];
  }

  pause(): TimerEvent[] {
    if (!this.s.running) return [];
    this.s.accumulated = this.elapsedMs();
    this.s.running = false;
    return [{ type: 'pause', mode: this.s.mode }];
  }

  toggle(): TimerEvent[] {
    return this.s.running ? this.pause() : this.start();
  }

  /** Restart the current session from zero, paused. */
  reset(): void {
    this.s.running = false;
    this.s.accumulated = 0;
  }

  /** Finish the current session immediately. */
  skip(): TimerEvent[] {
    return this.complete(this.now(), this.s.running);
  }

  /** Advance the clock; returns completion events (several if the tab slept through more than one session). */
  update(): TimerEvent[] {
    const events: TimerEvent[] = [];
    for (let guard = 0; guard < 16 && this.s.running && this.elapsedMs() >= this.durationMs(); guard++) {
      const endedAt = this.s.anchor + (this.durationMs() - this.s.accumulated);
      events.push(...this.complete(endedAt, true));
    }
    return events;
  }

  private complete(endedAt: number, wasRunning: boolean): TimerEvent[] {
    const cfg = this.config();
    const finished = this.s.mode;
    let next: Mode;
    if (finished === 'focus') {
      this.s.completed++;
      next = this.s.completed % cfg.longEvery === 0 ? 'longBreak' : 'shortBreak';
    } else {
      next = 'focus';
    }
    const autoStart = wasRunning && (next === 'focus' ? cfg.autoStartFocus : cfg.autoStartBreaks);
    this.s.mode = next;
    this.s.accumulated = 0;
    this.s.running = autoStart;
    this.s.anchor = endedAt;
    return [{ type: 'complete', mode: finished, next, autoStarted: autoStart }];
  }
}
