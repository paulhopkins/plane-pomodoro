import { localTime, type Airport } from '../data/airports';
import { PHASES, type FlightState } from '../state/flight';
import type { Mode } from '../state/timer';
import { MovingMap } from './movingMap';

export interface UiModel {
  mode: Mode;
  running: boolean;
  started: boolean;
  remainingMs: number;
  progress: number;
  flight: FlightState;
  from: Airport;
  to: Airport;
  flightNo: string;
  /** Fraction of the route flown. */
  routeFraction: number;
  routeKm: number;
  cyclePos: number;
  longEvery: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const MODE_LABEL: Record<Mode, string> = { focus: 'Focus flight', shortBreak: 'Short break', longBreak: 'Layover' };

/** Seat-back in-flight-entertainment screen + tray table + window HUD. */
export class SeatbackView {
  private map = new MovingMap($<HTMLElement>('map') as unknown as SVGSVGElement);
  private el = {
    flightNo: $('ife-flight'), route: $('ife-route'), seatbelt: $('seatbelt'), mode: $('ife-mode'),
    clock: $('ife-clock'), phase: $('ife-phase'), bar: $('ife-bar'), markers: $('ife-markers'),
    alt: $('st-alt'), gs: $('st-gs'), temp: $('st-temp'), dist: $('st-dist'), local: $('st-local'),
    localLabel: $('st-local-label'), start: $('btn-start'), legs: $('legs'),
    hudRoute: $('hud-route'), hudTime: $('hud-time'), hudPhase: $('hud-phase'), hudToggle: $('hud-toggle'),
  };
  private last = '';

  constructor() {
    let acc = 0;
    for (const p of PHASES.slice(0, -1)) {
      acc += p.share;
      const m = document.createElement('span');
      m.style.left = `${acc * 100}%`;
      this.el.markers.append(m);
    }
  }

  update(m: UiModel): void {
    const e = this.el;
    const focus = m.mode === 'focus';
    const clock = formatClock(m.remainingMs);
    const phase = focus ? m.flight.label : `At the gate in ${m.from.city}`;
    const nextLeg = `Next: ${m.from.code} → ${m.to.code}`;

    this.map.setRoute(m.from, m.to);
    this.map.update(focus ? m.routeFraction : 0);

    const key = [clock, phase, m.mode, m.running, m.started, m.cyclePos, m.from.code, m.to.code, Math.round(m.flight.altitude / 30)].join('|');
    if (key === this.last) return;
    this.last = key;

    e.flightNo.textContent = m.flightNo;
    e.route.textContent = `${m.from.city} → ${m.to.city}`;
    e.seatbelt.classList.toggle('on', focus ? m.flight.seatbelt : false);
    e.mode.textContent = MODE_LABEL[m.mode];
    e.clock.textContent = clock;
    e.phase.textContent = focus ? phase : `${phase} · ${nextLeg}`;
    e.bar.style.width = `${m.progress * 100}%`;
    e.markers.style.display = focus ? '' : 'none';

    const f = m.flight;
    const ft = Math.round((f.altitude * 3.281) / 100) * 100;
    e.alt.textContent = focus ? `${ft.toLocaleString()} ft` : '0 ft';
    e.gs.textContent = focus ? `${Math.round(f.speed * 1.944)} kn` : '0 kn';
    const tempC = 15 - 6.5 * (f.altitude / 1000);
    e.temp.textContent = `${Math.round(Math.max(-56.5, focus ? tempC : 15))}°C`;
    e.dist.textContent = focus ? `${Math.round(m.routeKm * (1 - m.routeFraction)).toLocaleString()} km` : `${Math.round(m.routeKm).toLocaleString()} km`;
    const localAt = focus ? m.to : m.from;
    e.localLabel.textContent = `Time in ${localAt.city}`;
    e.local.textContent = localTime(localAt);

    const label = m.running ? 'Pause' : m.started ? 'Resume' : focus ? 'Depart' : 'Start break';
    e.start.textContent = label;
    e.hudToggle.textContent = m.running ? 'Pause' : m.started ? 'Resume' : focus ? 'Depart' : 'Start';

    e.legs.replaceChildren();
    for (let i = 0; i < m.longEvery; i++) {
      const dot = document.createElement('i');
      if (i < m.cyclePos) dot.className = 'done';
      else if (i === m.cyclePos && focus) dot.className = 'current';
      e.legs.append(dot);
    }
    const legsText = document.createElement('span');
    legsText.textContent = m.mode === 'longBreak' ? 'Layover' : `Leg ${m.cyclePos + (focus ? 1 : 0)} of ${m.longEvery}`;
    e.legs.append(legsText);

    e.hudRoute.textContent = focus ? `${m.from.code} → ${m.to.code}` : `${m.from.code} gate`;
    e.hudTime.textContent = clock;
    e.hudPhase.textContent = focus ? phase : MODE_LABEL[m.mode];
    document.title = `${clock} · ${focus ? phase : MODE_LABEL[m.mode]} · Plane Pomodoro`;
  }
}
