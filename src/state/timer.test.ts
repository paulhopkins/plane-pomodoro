import { describe, expect, it } from 'vitest';
import { PomodoroTimer, type Durations } from './timer';

const cfg: Durations = { focus: 25, shortBreak: 5, longBreak: 15, longEvery: 4, autoStartBreaks: true, autoStartFocus: false };
const MIN = 60_000;

function setup(overrides: Partial<Durations> = {}) {
  let now = 1_000_000;
  const c = { ...cfg, ...overrides };
  const timer = new PomodoroTimer(() => c, () => now);
  return { timer, advance: (ms: number) => (now += ms) };
}

describe('PomodoroTimer', () => {
  it('counts down from wall-clock time and pauses', () => {
    const { timer, advance } = setup();
    expect(timer.remainingMs()).toBe(25 * MIN);
    timer.start();
    advance(10 * MIN);
    expect(timer.remainingMs()).toBe(15 * MIN);
    timer.pause();
    advance(60 * MIN);
    expect(timer.remainingMs()).toBe(15 * MIN);
    expect(timer.progress()).toBeCloseTo(0.4);
  });

  it('moves focus -> short break (auto-started) -> focus (paused)', () => {
    const { timer, advance } = setup();
    timer.start();
    advance(25 * MIN);
    const ev = timer.update();
    expect(ev).toEqual([{ type: 'complete', mode: 'focus', next: 'shortBreak', autoStarted: true }]);
    expect(timer.mode).toBe('shortBreak');
    expect(timer.running).toBe(true);
    advance(5 * MIN);
    timer.update();
    expect(timer.mode).toBe('focus');
    expect(timer.running).toBe(false);
    expect(timer.remainingMs()).toBe(25 * MIN);
  });

  it('carries overshoot into an auto-started break', () => {
    const { timer, advance } = setup();
    timer.start();
    advance(27 * MIN);
    timer.update();
    expect(timer.mode).toBe('shortBreak');
    expect(timer.remainingMs()).toBe(3 * MIN);
  });

  it('gives a long break after every Nth focus session', () => {
    const { timer } = setup({ autoStartBreaks: false });
    const modes: string[] = [];
    for (let i = 0; i < 8; i++) {
      timer.skip();
      modes.push(timer.mode);
    }
    expect(modes).toEqual(['shortBreak', 'focus', 'shortBreak', 'focus', 'shortBreak', 'focus', 'longBreak', 'focus']);
    expect(timer.completed).toBe(4);
  });

  it('handles a tab that slept through several sessions', () => {
    const { timer, advance } = setup({ autoStartFocus: true });
    timer.start();
    advance((25 + 5 + 25 + 1) * MIN);
    const ev = timer.update();
    expect(ev.map((e) => e.type === 'complete' && e.mode)).toEqual(['focus', 'shortBreak', 'focus']);
    expect(timer.mode).toBe('shortBreak');
    expect(timer.remainingMs()).toBe(4 * MIN);
  });

  it('reset restarts the current session paused', () => {
    const { timer, advance } = setup();
    timer.start();
    advance(5 * MIN);
    timer.reset();
    expect(timer.running).toBe(false);
    expect(timer.remainingMs()).toBe(25 * MIN);
  });
});
