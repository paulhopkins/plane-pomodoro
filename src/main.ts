import './styles/main.css';
import { announce, chimeDouble, chimeSingle, clunk, thump } from './audio/cues';
import { CabinAudio } from './audio/engine';
import { AIRPORTS, airport, localTime, sunElevation } from './data/airports';
import { distanceKm, flightNumber, greatCirclePoint, pickDestination } from './data/routes';
import type { AirportScene } from './scenes/airport';
import { SceneRenderer } from './scenes/renderer';
import type { World } from './scenes/world';
import {
  distanceAt, flightState, LIFTOFF, parkedState, progressOf, TOTAL_DISTANCE, TOUCHDOWN, type FlightState,
} from './state/flight';
import { load, save, type Journey, type Persisted, type Task } from './state/settings';
import { PomodoroTimer, type Mode, type TimerEvent } from './state/timer';
import { strSeed } from './util/math';
import { SeatbackView } from './views/seatback';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------
const persisted: Persisted = load();
const settings = persisted.settings;
let journey: Journey = persisted.journey ?? newJourney('LHR');
let tasks: Task[] = persisted.tasks ?? [];
let view: 'seat' | 'window' = persisted.view ?? 'seat';
let shadeClosed = persisted.shade ?? false;
const timer = new PomodoroTimer(() => settings, Date.now, persisted.timer);

function newJourney(from: string): Journey {
  return { from, to: pickDestination(from), flightNo: flightNumber() };
}

function persist(): void {
  save({ settings, timer: timer.snapshot(), journey, tasks, view, shade: shadeClosed, zoom: renderer.getZoom() });
}

// ---------- Static runway layout (local coordinates of each airport) ----------
const ORIGIN_RUNWAY: [number, number] = [
  distanceAt(progressOf('takeoff')) - 150,
  distanceAt(progressOf('takeoff', LIFTOFF)) + 900,
];
const DEST_RUNWAY: [number, number] = [
  distanceAt(progressOf('approach', TOUCHDOWN)) - TOTAL_DISTANCE - 500,
  distanceAt(progressOf('taxiIn')) - TOTAL_DISTANCE + 250,
];

// ---------- Debug overrides (?debug) ----------
const debug = new URLSearchParams(location.search).has('debug');
const dbg = { progress: null as number | null, sun: null as number | null, mode: null as Mode | null };

// ---------- Modules ----------
const app = $('app');
const canvas = $<HTMLCanvasElement>('scene');
const renderer = new SceneRenderer(canvas);
renderer.setShade(shadeClosed);
renderer.setZoom(persisted.zoom ?? 1);
const ui = new SeatbackView();
const audio = new CabinAudio();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Audio + announcements ----------
async function ensureAudio(): Promise<void> {
  await audio.init();
  audio.setVolume(settings.volume, settings.muted);
}

function say(text: string): void {
  if (settings.announcements && !settings.muted) announce(text, settings.volume);
}

function greeting(a = airport(journey.from)): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: a.tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function notify(title: string, body: string): void {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, silent: true });
  } catch {
    /* some platforms only allow notifications from a service worker */
  }
}

function handleEvents(events: TimerEvent[]): void {
  for (const ev of events) {
    if (ev.type === 'start' && ev.fresh && ev.mode === 'focus') {
      const to = airport(journey.to);
      chimeDouble(audio);
      say(`${greeting()}, ladies and gentlemen, and welcome aboard flight ${journey.flightNo} to ${to.city}. Our flight time today is ${settings.focus} minutes. Please make sure your work is open and your phone is in flight mode.`);
    }
    if (ev.type !== 'complete') continue;
    if (ev.mode === 'focus') {
      const arrived = airport(journey.to);
      journey = newJourney(arrived.code);
      chimeSingle(audio);
      const breakMin = ev.next === 'longBreak' ? settings.longBreak : settings.shortBreak;
      say(`Ladies and gentlemen, welcome to ${arrived.city}, where the local time is ${localTime(arrived)}. Enjoy your ${breakMin} minute ${ev.next === 'longBreak' ? 'layover' : 'break'}.`);
      notify(`Landed in ${arrived.city}`, `Focus session done. Time for a ${breakMin}-minute break.`);
    } else {
      chimeDouble(audio);
      say(`Flight ${journey.flightNo} to ${airport(journey.to).city} is now boarding.`);
      notify(`Now boarding: ${journey.from} → ${journey.to}`, 'Break over. Ready for the next focus flight?');
    }
    persist();
  }
}

/** In-flight cues as the flight state crosses milestones. */
let prevFlight: FlightState | null = null;
function flightCues(f: FlightState): void {
  const p = prevFlight;
  prevFlight = f;
  if (!p || timer.mode !== 'focus' || Math.abs(f.progress - p.progress) > 0.02 || f.progress <= p.progress) return;
  const crossed = (phase: FlightState['phase'], pp: number) =>
    progressOf(phase, pp) > p.progress && progressOf(phase, pp) <= f.progress;
  const to = airport(journey.to);
  if (crossed('takeoff', 0)) {
    chimeSingle(audio);
    say('Cabin crew, please take your seats for departure.');
  }
  if (crossed('climb', 0.06)) clunk(audio);
  if (crossed('cruise', 0)) chimeSingle(audio);
  if (crossed('descent', 0)) {
    chimeDouble(audio);
    say(`Ladies and gentlemen, we have begun our descent into ${to.city}. Time to start wrapping up.`);
  }
  if (crossed('approach', 0.35)) clunk(audio);
  if (crossed('approach', TOUCHDOWN)) thump(audio);
}

// ---------- Controls ----------
async function toggleTimer(): Promise<void> {
  await ensureAudio();
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  handleEvents(timer.toggle());
  persist();
}

function setView(next: 'seat' | 'window'): void {
  view = next;
  app.dataset.view = view;
  $('btn-view').textContent = view === 'seat' ? 'Window view' : 'Seat-back view';
  persist();
}

function setShade(closed: boolean): void {
  shadeClosed = closed;
  persist();
}

$('btn-start').addEventListener('click', toggleTimer);
$('hud-toggle').addEventListener('click', toggleTimer);
$('btn-skip').addEventListener('click', () => {
  handleEvents(timer.skip());
  persist();
});
$('btn-reset').addEventListener('click', () => {
  timer.reset();
  prevFlight = null;
  persist();
});
$('btn-view').addEventListener('click', () => {
  void ensureAudio();
  setView(view === 'seat' ? 'window' : 'seat');
});
// Zoom the window: scroll wheel / trackpad pinch (ctrl+wheel) on desktop, two-finger pinch on touch.
let zoomSaveTimer = 0;
function zoomBy(factor: number): void {
  renderer.setZoom(renderer.getZoom() * factor);
  clearTimeout(zoomSaveTimer);
  zoomSaveTimer = window.setTimeout(persist, 400);
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomBy(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });
const touches = new Map<number, { x: number; y: number }>();
let pinchDist = 0;
let pinchEndedAt = 0;
const spread = () => {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) pinchDist = spread();
});
canvas.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size !== 2 || pinchDist <= 0) return;
  const d = spread();
  zoomBy(d / pinchDist);
  pinchDist = d;
});
const endTouch = (e: PointerEvent) => {
  if (!touches.delete(e.pointerId)) return;
  if (pinchDist > 0) pinchEndedAt = performance.now();
  if (touches.size < 2) pinchDist = 0;
};
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

canvas.addEventListener('click', (e) => {
  void ensureAudio();
  // A pinch shouldn't also pull the shade.
  if (performance.now() - pinchEndedAt < 400) return;
  if (renderer.hitWindow(e.clientX, e.clientY)) setShade(!shadeClosed);
});
const soundBtn = $('btn-sound');
function syncSoundButton(): void {
  soundBtn.textContent = settings.muted ? '🔇' : '🔊';
}
soundBtn.addEventListener('click', async () => {
  settings.muted = !settings.muted;
  await ensureAudio();
  if (settings.muted) window.speechSynthesis?.cancel();
  syncSoundButton();
  persist();
});
syncSoundButton();

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'v' || e.key === 'V') setView(view === 'seat' ? 'window' : 'seat');
  else if (e.key === ' ') {
    e.preventDefault();
    void toggleTimer();
  } else if (e.key === 's' || e.key === 'S') setShade(!shadeClosed);
  else if (e.key === 'm' || e.key === 'M') soundBtn.click();
  else if (e.key === '+' || e.key === '=') zoomBy(1.15);
  else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.15);
  else if (e.key === '0') zoomBy(1 / renderer.getZoom());
});

// ---------- Tasks on the tray table ----------
const taskList = $('task-list');
function renderTasks(): void {
  taskList.replaceChildren(
    ...tasks.map((t) => {
      const li = document.createElement('li');
      li.className = t.done ? 'done' : '';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = t.done;
      cb.addEventListener('change', () => {
        t.done = cb.checked;
        renderTasks();
        persist();
      });
      const span = document.createElement('span');
      span.textContent = t.text;
      const del = document.createElement('button');
      del.textContent = '×';
      del.setAttribute('aria-label', `Remove ${t.text}`);
      del.addEventListener('click', () => {
        tasks = tasks.filter((x) => x !== t);
        renderTasks();
        persist();
      });
      li.append(cb, span, del);
      return li;
    }),
  );
}
$('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('task-input');
  const text = input.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, done: false });
  input.value = '';
  renderTasks();
  persist();
});
renderTasks();

// ---------- Settings / flight-planning dialog ----------
const dialog = $<HTMLDialogElement>('settings');
const form = $<HTMLFormElement>('settings-form');
const fromSel = form.elements.namedItem('from') as HTMLSelectElement;
const toSel = form.elements.namedItem('to') as HTMLSelectElement;
const RANDOM = 'random';

function fillSelect(sel: HTMLSelectElement, exclude?: string): void {
  sel.replaceChildren(
    ...AIRPORTS.filter((a) => a.code !== exclude).map((a) => new Option(`${a.city} (${a.code})`, a.code)),
  );
}

/** The route can be changed at the gate, but not mid-flight. */
function routeEditable(): boolean {
  return !(timer.mode === 'focus' && timer.elapsedMs() > 0);
}

function syncRouteFields(): void {
  fillSelect(fromSel);
  fillSelect(toSel, journey.from);
  toSel.prepend(new Option('Surprise me', RANDOM));
  fromSel.value = journey.from;
  toSel.value = journey.to;
  const editable = routeEditable();
  fromSel.disabled = toSel.disabled = !editable;
  $('route-note').textContent = editable
    ? `Flight ${journey.flightNo} · ${Math.round(distanceKm(airport(journey.from), airport(journey.to))).toLocaleString()} km`
    : 'You are mid-flight: the route can be changed once you are back at a gate.';
  const preDeparture = timer.mode === 'focus' && !timer.running && timer.elapsedMs() === 0;
  $('btn-board').hidden = !preDeparture;
  $('settings-title').textContent = preDeparture ? 'Plan your flight' : 'Flight settings';
}

function openSettings(): void {
  for (const [k, v] of Object.entries(settings)) {
    const input = form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null;
    if (!input) continue;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(v);
    else input.value = String(v);
  }
  syncRouteFields();
  dialog.showModal();
}

$('btn-settings').addEventListener('click', openSettings);
fromSel.addEventListener('change', () => {
  if (!routeEditable()) return;
  const from = fromSel.value;
  journey = { from, to: journey.to === from ? pickDestination(from) : journey.to, flightNo: flightNumber() };
  syncRouteFields();
  persist();
});
toSel.addEventListener('change', () => {
  if (!routeEditable()) return;
  const to = toSel.value === RANDOM ? pickDestination(journey.from) : toSel.value;
  journey = { ...journey, to, flightNo: flightNumber() };
  syncRouteFields();
  persist();
});
form.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement | HTMLSelectElement;
  const k = input.name as keyof typeof settings;
  if (!(k in settings)) return;
  if (input instanceof HTMLInputElement && input.type === 'checkbox') (settings[k] as boolean) = input.checked;
  else if (input instanceof HTMLInputElement && (input.type === 'number' || input.type === 'range')) {
    const n = Number(input.value);
    if (!Number.isFinite(n) || (n <= 0 && input.type === 'number')) return;
    (settings[k] as number) = n;
  }
  audio.setVolume(settings.volume, settings.muted);
  persist();
});
$('btn-board').addEventListener('click', () => {
  dialog.close();
  void toggleTimer();
});

// ---------- Debug panel ----------
if (debug) {
  const panel = $('debug');
  panel.hidden = false;
  const from = $<HTMLSelectElement>('dbg-from'), to = $<HTMLSelectElement>('dbg-to');
  fillSelect(from);
  fillSelect(to);
  from.value = journey.from;
  to.value = journey.to;
  const prog = $<HTMLInputElement>('dbg-progress'), sun = $<HTMLInputElement>('dbg-sun');
  const sync = () => {
    dbg.progress = $<HTMLInputElement>('dbg-override').checked ? Number(prog.value) / 1000 : null;
    dbg.sun = $<HTMLInputElement>('dbg-sun-override').checked ? Number(sun.value) : null;
  };
  panel.addEventListener('input', sync);
  // Scriptable overrides, e.g. ?debug&p=0.3&sun=5&view=window&from=LHR&to=LAX
  const q = new URLSearchParams(location.search);
  if (q.has('p')) { prog.value = String(Number(q.get('p')) * 1000); $<HTMLInputElement>('dbg-override').checked = true; }
  if (q.has('sun')) { sun.value = q.get('sun')!; $<HTMLInputElement>('dbg-sun-override').checked = true; }
  if (q.get('from')) journey = { ...journey, from: q.get('from')! };
  if (q.get('to')) journey = { ...journey, to: q.get('to')! };
  if (q.get('view') === 'window' || q.get('view') === 'seat') view = q.get('view') as 'seat' | 'window';
  if (q.get('mode')) dbg.mode = q.get('mode') as Mode;
  if (q.has('autostart')) setTimeout(() => void toggleTimer(), 300);
  from.value = journey.from;
  to.value = journey.to;
  sync();
  from.addEventListener('change', () => (journey = { ...journey, from: from.value }));
  to.addEventListener('change', () => (journey = { ...journey, to: to.value }));
  // Allow audio while scrubbing.
  panel.addEventListener('pointerdown', () => void ensureAudio());
}

// ---------- Main loop ----------
let lastAudio = 0;
let lastPersist = 0;
function frame(nowMs: number): void {
  handleEvents(timer.update());

  const mode = dbg.mode ?? timer.mode;
  const focus = mode === 'focus';
  const progress = dbg.progress ?? timer.progress();
  const flight = focus ? flightState(progress) : parkedState();
  const from = airport(journey.from), to = airport(journey.to);
  const routeKm = distanceKm(from, to);
  const routeFraction = focus ? distanceAt(progress) / TOTAL_DISTANCE : 0;

  if (focus) flightCues(flight);

  const now = new Date();
  const [lat, lon] = greatCirclePoint(from, to, routeFraction);
  const sunElev = dbg.sun ?? sunElevation(lat, lon, now);

  if (view === 'window' && !document.hidden) {
    const world: World = focus
      ? { origin: from, dest: to, destOffset: TOTAL_DISTANCE, longHaul: routeKm > 3500, seed: strSeed(from.code + to.code) }
      : { origin: from, dest: from, destOffset: TOTAL_DISTANCE, longHaul: false, seed: strSeed(from.code) };
    const airports: AirportScene[] = [
      { airport: from, offset: 0, runway: ORIGIN_RUNWAY, jetBridge: !focus || (flight.phase === 'gate' && flight.phaseProgress < 0.2) },
    ];
    if (focus) {
      airports.push({ airport: to, offset: TOTAL_DISTANCE, runway: DEST_RUNWAY, jetBridge: flight.phase === 'taxiIn' && flight.phaseProgress > 0.97 });
    }
    renderer.render({ flight, world, airports, sunElev, shadeClosed, reducedMotion }, nowMs / 1000);
  }

  if (nowMs - lastAudio > 200) {
    lastAudio = nowMs;
    audio.setState({
      thrust: flight.thrust,
      enginesOn: flight.enginesOn,
      speed: flight.speed,
      onGround: flight.onGround,
      reverse: flight.reverse,
      muffled: view === 'window' && shadeClosed,
      parked: !focus,
    });
    const cyclePos = mode === 'longBreak' ? settings.longEvery : timer.cyclePosition();
    ui.update({
      mode,
      running: timer.running,
      started: timer.elapsedMs() > 0,
      remainingMs: dbg.progress !== null && focus ? timer.durationMs() * (1 - progress) : timer.remainingMs(),
      progress,
      flight,
      from,
      to,
      flightNo: journey.flightNo,
      routeFraction,
      routeKm,
      cyclePos,
      longEvery: settings.longEvery,
    });
    if (debug) $('dbg-readout').textContent = `${flight.phase} ${flight.phaseProgress.toFixed(2)} alt ${Math.round(flight.altitude)} m x ${Math.round(flight.x)} sun ${sunElev.toFixed(1)}° render ${renderer.frameMs.toFixed(1)} ms`;
  }
  if (nowMs - lastPersist > 5000) {
    lastPersist = nowMs;
    persist();
  }
  requestAnimationFrame(frame);
}

// Open on the flight planner unless a session is already under way.
if (!debug && !timer.running && timer.elapsedMs() === 0) openSettings();
app.classList.add('preload');
setView(view);
requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('preload')));
requestAnimationFrame(frame);

// rAF stops in background tabs; keep the timer (and its chimes) ticking.
setInterval(() => {
  if (document.hidden) handleEvents(timer.update());
}, 1000);
