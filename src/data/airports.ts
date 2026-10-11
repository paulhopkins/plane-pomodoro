export type LandmarkKind =
  | 'shard'
  | 'gherkin'
  | 'themeBuilding'
  | 'empireState'
  | 'oneWtc'
  | 'eiffel'
  | 'fuji'
  | 'tokyoTower'
  | 'burj'
  | 'harbourBridge'
  | 'operaHouse'
  | 'goldenGate'
  | 'transamerica'
  | 'icc'
  | 'bankOfChina'
  | 'bigBuddha'
  | 'marinaBaySands'
  | 'supertrees'
  | 'sugarloaf'
  | 'corcovado'
  | 'tableMountain'
  | 'rockOfGibraltar'
  | 'bergisel'
  | 'tigersNest';

export type TowerKind =
  | 'lhr' | 'lax' | 'jfk' | 'cdg' | 'hnd' | 'dxb' | 'syd' | 'sfo'
  | 'hkg' | 'sin' | 'sdu' | 'cpt' | 'gib' | 'inn' | 'zqn' | 'mle' | 'pbh';

export type Surround = 'grass' | 'dry' | 'sand';

/** Something placed in the airport's local frame: x along the runway (gate at 0), z metres away from the window. */
export interface Placement<K> {
  kind: K;
  x: number;
  z: number;
  /** Artistic size multiplier so distant landmarks still read. */
  s?: number;
}

/** A mountain range drawn as one silhouette at depth `z`. Heights in metres above the airfield. */
export interface Ridge {
  z: number;
  /** Mean height and relief amplitude. */
  h: number;
  amp: number;
  /** Horizontal size of the main peaks. */
  scale: number;
  col: string;
  /** Colour at the crest, blended from `col` at the foot. */
  top?: string;
  /** Snowline height, if the peaks are snow-capped. */
  snow?: number;
  /** 0 = rolling hills, 1 = saw-toothed peaks. */
  jagged?: number;
  /** Local x extent; the range tapers away outside it. */
  xMin?: number;
  xMax?: number;
  seed?: number;
}

/** Low rolling hills on the horizon. */
export const HILLS: Ridge = { z: 38_000, h: 260, amp: 260, scale: 4000, col: '#6c7556' };

export interface Airport {
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  tz: string;
  surround: Surround;
  /** Cloud coverage 0..1 for low / mid / high layers. */
  weather: { low: number; mid: number; high: number; lowBase: number; haze: number };
  /** `island`: the city's own box stays land even inside a water band. */
  skyline: { density: number; maxH: number; xMin: number; xMax: number; zMin: number; zMax: number; island?: boolean };
  /** z-bands (metres from window) that are water. */
  water: [number, number][];
  /** z-bands of shallow turquoise lagoon. */
  shallows?: [number, number][];
  tower: Placement<TowerKind>;
  landmarks: Placement<LandmarkKind>[];
  palms?: boolean;
  ridges?: Ridge[];
  /** Tail-fin colours of aircraft parked at neighbouring gates. */
  liveries: string[];
}

export const AIRPORTS: Airport[] = [
  {
    code: 'LHR', name: 'Heathrow', city: 'London', lat: 51.47, lon: -0.4543, tz: 'Europe/London',
    surround: 'grass',
    weather: { low: 0.75, mid: 0.45, high: 0.35, lowBase: 900, haze: 0.35 },
    skyline: { density: 0.55, maxH: 140, xMin: -6000, xMax: 8000, zMin: 6000, zMax: 11000 },
    water: [],
    tower: { kind: 'lhr', x: -300, z: 650 },
    landmarks: [
      { kind: 'shard', x: 900, z: 7000, s: 2.8 },
      { kind: 'gherkin', x: 1700, z: 7500, s: 3 },
    ],
    liveries: ['#1b3b8f', '#c8102e', '#5a2d82', '#ffffff'],
  },
  {
    code: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', lat: 33.9416, lon: -118.4085, tz: 'America/Los_Angeles',
    surround: 'dry',
    weather: { low: 0.12, mid: 0.06, high: 0.25, lowBase: 1100, haze: 0.5 },
    skyline: { density: 0.5, maxH: 300, xMin: -2000, xMax: 6000, zMin: 12000, zMax: 16000 },
    water: [[5500, 1e9]],
    tower: { kind: 'lax', x: -350, z: 750 },
    landmarks: [{ kind: 'themeBuilding', x: 350, z: 320, s: 1.3 }],
    palms: true,
    ridges: [HILLS],
    liveries: ['#003a70', '#e31837', '#0a2240', '#d6d6d6'],
  },
  {
    code: 'JFK', name: 'John F. Kennedy', city: 'New York', lat: 40.6413, lon: -73.7781, tz: 'America/New_York',
    surround: 'grass',
    weather: { low: 0.35, mid: 0.3, high: 0.3, lowBase: 1200, haze: 0.35 },
    skyline: { density: 1, maxH: 380, xMin: -3000, xMax: 4500, zMin: 8500, zMax: 11500 },
    water: [[2200, 6000]],
    tower: { kind: 'jfk', x: -280, z: 700 },
    landmarks: [
      { kind: 'oneWtc', x: 300, z: 9500, s: 2.4 },
      { kind: 'empireState', x: 1800, z: 9000, s: 2.4 },
    ],
    liveries: ['#0033a0', '#c8102e', '#003366', '#e9e9e9'],
  },
  {
    code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', lat: 49.0097, lon: 2.5479, tz: 'Europe/Paris',
    surround: 'grass',
    weather: { low: 0.45, mid: 0.4, high: 0.3, lowBase: 1300, haze: 0.4 },
    skyline: { density: 0.45, maxH: 60, xMin: -6000, xMax: 8000, zMin: 6000, zMax: 12000 },
    water: [],
    tower: { kind: 'cdg', x: -320, z: 600 },
    landmarks: [{ kind: 'eiffel', x: 1000, z: 8000, s: 3 }],
    liveries: ['#002157', '#e6e6e6', '#0d3b84', '#d61a3c'],
  },
  {
    code: 'HND', name: 'Haneda', city: 'Tokyo', lat: 35.5494, lon: 139.7798, tz: 'Asia/Tokyo',
    surround: 'grass',
    weather: { low: 0.3, mid: 0.3, high: 0.3, lowBase: 1200, haze: 0.25 },
    skyline: { density: 0.9, maxH: 220, xMin: -8000, xMax: 8000, zMin: 7000, zMax: 14000 },
    water: [[1200, 6500]],
    tower: { kind: 'hnd', x: -300, z: 700 },
    landmarks: [
      { kind: 'tokyoTower', x: 1500, z: 7000, s: 2.4 },
      { kind: 'fuji', x: -2000, z: 45000, s: 2.6 },
    ],
    liveries: ['#e60012', '#1a3e8c', '#ffffff', '#00467f'],
  },
  {
    code: 'DXB', name: 'Dubai Intl', city: 'Dubai', lat: 25.2532, lon: 55.3657, tz: 'Asia/Dubai',
    surround: 'sand',
    weather: { low: 0.02, mid: 0.05, high: 0.12, lowBase: 1500, haze: 0.6 },
    skyline: { density: 0.5, maxH: 330, xMin: -3000, xMax: 6000, zMin: 6500, zMax: 10000 },
    water: [[16000, 1e9]],
    tower: { kind: 'dxb', x: -300, z: 650 },
    landmarks: [{ kind: 'burj', x: 1000, z: 7000, s: 1.8 }],
    liveries: ['#d71921', '#7a1f3d', '#c9a227', '#ececec'],
  },
  {
    code: 'SYD', name: 'Kingsford Smith', city: 'Sydney', lat: -33.9399, lon: 151.1753, tz: 'Australia/Sydney',
    surround: 'grass',
    weather: { low: 0.25, mid: 0.2, high: 0.25, lowBase: 1300, haze: 0.3 },
    skyline: { density: 0.7, maxH: 240, xMin: -2500, xMax: 3000, zMin: 5800, zMax: 7500 },
    water: [[700, 3000], [4200, 5600]],
    tower: { kind: 'syd', x: -260, z: 550 },
    landmarks: [
      { kind: 'harbourBridge', x: 300, z: 5200, s: 3 },
      { kind: 'operaHouse', x: 1500, z: 5000, s: 3 },
    ],
    ridges: [HILLS],
    liveries: ['#e40000', '#ff6600', '#003d7c', '#ffffff'],
  },
  {
    code: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', lat: 37.6213, lon: -122.379, tz: 'America/Los_Angeles',
    surround: 'dry',
    weather: { low: 0.6, mid: 0.15, high: 0.2, lowBase: 350, haze: 0.45 },
    skyline: { density: 0.8, maxH: 260, xMin: 500, xMax: 4500, zMin: 7000, zMax: 9000 },
    water: [[500, 6500]],
    tower: { kind: 'sfo', x: -300, z: 500 },
    landmarks: [
      { kind: 'transamerica', x: 1800, z: 7500, s: 2.6 },
      { kind: 'goldenGate', x: -2500, z: 9000, s: 2.4 },
    ],
    ridges: [HILLS],
    liveries: ['#005daa', '#002244', '#d71921', '#f2f2f2'],
  },
  {
    code: 'HKG', name: 'Hong Kong Intl', city: 'Hong Kong', lat: 22.308, lon: 113.9185, tz: 'Asia/Hong_Kong',
    surround: 'grass',
    weather: { low: 0.4, mid: 0.3, high: 0.35, lowBase: 800, haze: 0.55 },
    skyline: { density: 1.3, maxH: 300, xMin: 2500, xMax: 12000, zMin: 21000, zMax: 25000 },
    water: [[380, 19000]],
    tower: { kind: 'hkg', x: -320, z: 680 },
    landmarks: [
      { kind: 'bigBuddha', x: -5200, z: 5600 },
      { kind: 'icc', x: 6500, z: 22500, s: 2.2 },
      { kind: 'bankOfChina', x: 8200, z: 23500, s: 2.2 },
    ],
    ridges: [
      { z: 6000, h: 420, amp: 330, scale: 2200, col: '#3f5c3c', top: '#5a7352', jagged: 0.35, xMin: -16000, xMax: 1500 },
      { z: 30000, h: 450, amp: 250, scale: 3500, col: '#566b5a', seed: 9 },
    ],
    liveries: ['#006564', '#5f259f', '#e4002b', '#ffffff'],
  },
  {
    code: 'SIN', name: 'Changi', city: 'Singapore', lat: 1.3644, lon: 103.9915, tz: 'Asia/Singapore',
    surround: 'grass',
    weather: { low: 0.45, mid: 0.3, high: 0.45, lowBase: 700, haze: 0.5 },
    skyline: { density: 1, maxH: 250, xMin: -3500, xMax: 5000, zMin: 15500, zMax: 18500 },
    water: [[2800, 14000]],
    tower: { kind: 'sin', x: -300, z: 700 },
    landmarks: [
      { kind: 'marinaBaySands', x: 1200, z: 14800, s: 3 },
      { kind: 'supertrees', x: 2600, z: 14600, s: 5 },
    ],
    palms: true,
    liveries: ['#1d3c78', '#f7b500', '#c8102e', '#ffffff'],
  },
  {
    code: 'SDU', name: 'Santos Dumont', city: 'Rio de Janeiro', lat: -22.9105, lon: -43.1631, tz: 'America/Sao_Paulo',
    surround: 'grass',
    weather: { low: 0.3, mid: 0.2, high: 0.3, lowBase: 1000, haze: 0.4 },
    skyline: { density: 0.8, maxH: 120, xMin: 500, xMax: 9000, zMin: 7500, zMax: 9500 },
    water: [[360, 7000]],
    tower: { kind: 'sdu', x: -280, z: 450 },
    landmarks: [
      { kind: 'sugarloaf', x: 2600, z: 3200 },
      { kind: 'corcovado', x: -1500, z: 7000 },
    ],
    palms: true,
    ridges: [{ z: 11000, h: 520, amp: 300, scale: 1800, col: '#3a5a37', jagged: 0.3 }],
    liveries: ['#ff6a13', '#1b2a5c', '#c8102e', '#ffffff'],
  },
  {
    code: 'CPT', name: 'Cape Town Intl', city: 'Cape Town', lat: -33.9715, lon: 18.6021, tz: 'Africa/Johannesburg',
    surround: 'dry',
    weather: { low: 0.15, mid: 0.1, high: 0.2, lowBase: 1300, haze: 0.25 },
    skyline: { density: 0.6, maxH: 120, xMin: -1500, xMax: 4500, zMin: 13000, zMax: 15500 },
    water: [],
    tower: { kind: 'cpt', x: -300, z: 600 },
    landmarks: [{ kind: 'tableMountain', x: 600, z: 17000, s: 1.5 }],
    ridges: [{ z: 45000, h: 900, amp: 400, scale: 4000, col: '#77809a', jagged: 0.5, xMin: -60000, xMax: -6000 }],
    liveries: ['#00529b', '#e2001a', '#f5a800', '#ffffff'],
  },
  {
    code: 'GIB', name: 'Gibraltar', city: 'Gibraltar', lat: 36.1512, lon: -5.3497, tz: 'Europe/Gibraltar',
    surround: 'dry',
    weather: { low: 0.3, mid: 0.2, high: 0.25, lowBase: 600, haze: 0.3 },
    skyline: { density: 0.9, maxH: 45, xMin: -2200, xMax: 400, zMin: 700, zMax: 1500 },
    water: [[2600, 25000]],
    tower: { kind: 'gib', x: -260, z: 400 },
    landmarks: [{ kind: 'rockOfGibraltar', x: 600, z: 1700 }],
    ridges: [{ z: 28000, h: 550, amp: 300, scale: 5000, col: '#6f7a8a', jagged: 0.4 }],
    liveries: ['#c8102e', '#ff6600', '#1b3b8f', '#ffffff'],
  },
  {
    code: 'INN', name: 'Innsbruck', city: 'Innsbruck', lat: 47.2602, lon: 11.344, tz: 'Europe/Vienna',
    surround: 'grass',
    weather: { low: 0.3, mid: 0.35, high: 0.3, lowBase: 1900, haze: 0.2 },
    skyline: { density: 0.6, maxH: 45, xMin: -1000, xMax: 5000, zMin: 2000, zMax: 3600 },
    water: [],
    tower: { kind: 'inn', x: -280, z: 500 },
    landmarks: [{ kind: 'bergisel', x: 2400, z: 2600, s: 2.5 }],
    ridges: [
      { z: 6000, h: 1350, amp: 420, scale: 2400, col: '#3d5340', top: '#7c7f7a', snow: 1550, jagged: 0.7 },
      { z: 20000, h: 2300, amp: 600, scale: 3600, col: '#76829a', snow: 1700, jagged: 0.6, seed: 11 },
    ],
    liveries: ['#e2001a', '#ffffff', '#1b3b8f', '#e2001a'],
  },
  {
    code: 'ZQN', name: 'Queenstown', city: 'Queenstown', lat: -45.0211, lon: 168.7392, tz: 'Pacific/Auckland',
    surround: 'grass',
    weather: { low: 0.2, mid: 0.3, high: 0.3, lowBase: 2300, haze: 0.12 },
    skyline: { density: 0.2, maxH: 18, xMin: -4000, xMax: -1000, zMin: 900, zMax: 1500 },
    water: [[1900, 3400]],
    tower: { kind: 'zqn', x: -260, z: 420 },
    landmarks: [],
    ridges: [
      { z: 4500, h: 1250, amp: 450, scale: 1700, col: '#5a5546', top: '#8f8a7c', snow: 1500, jagged: 1, xMin: -10000, xMax: 9000 },
      { z: 14000, h: 1300, amp: 450, scale: 3000, col: '#6a7186', snow: 1500, jagged: 0.6, seed: 5 },
    ],
    liveries: ['#111111', '#ff5800', '#00a3e0', '#ffffff'],
  },
  {
    code: 'MLE', name: 'Velana Intl', city: 'Malé', lat: 4.1918, lon: 73.529, tz: 'Indian/Maldives',
    surround: 'sand',
    weather: { low: 0.35, mid: 0.2, high: 0.4, lowBase: 600, haze: 0.3 },
    skyline: { density: 2, maxH: 70, xMin: -1200, xMax: 1600, zMin: 2300, zMax: 2900, island: true },
    water: [[1500, 1e9]],
    shallows: [[300, 1500]],
    tower: { kind: 'mle', x: -280, z: 240 },
    landmarks: [],
    palms: true,
    liveries: ['#0b7a75', '#d71921', '#5c0632', '#ffffff'],
  },
  {
    code: 'PBH', name: 'Paro', city: 'Paro', lat: 27.4032, lon: 89.4246, tz: 'Asia/Thimphu',
    surround: 'grass',
    weather: { low: 0.25, mid: 0.4, high: 0.3, lowBase: 2600, haze: 0.18 },
    skyline: { density: 0.15, maxH: 14, xMin: -2500, xMax: 2500, zMin: 900, zMax: 1500 },
    water: [],
    tower: { kind: 'pbh', x: -260, z: 420 },
    landmarks: [{ kind: 'tigersNest', x: -1800, z: 2300 }],
    ridges: [
      { z: 2600, h: 380, amp: 200, scale: 1300, col: '#2f4a30', top: '#4d6446', jagged: 0.4 },
      { z: 16000, h: 2600, amp: 700, scale: 3000, col: '#7d8aa6', snow: 2700, jagged: 0.8, seed: 21 },
      { z: 50000, h: 4800, amp: 900, scale: 5000, col: '#9aa6bd', snow: 3600, jagged: 0.9, seed: 22 },
    ],
    liveries: ['#f5a800', '#7b1e3a', '#ffffff', '#f5a800'],
  },
];

export const AIRPORT_BY_CODE: Record<string, Airport> = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));

export function airport(code: string): Airport {
  return AIRPORT_BY_CODE[code] ?? AIRPORTS[0];
}

/** Current local time string at an airport, e.g. "14:05". */
export function localTime(a: Airport, date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: a.tz, hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Solar elevation in degrees at a lat/lon for a given time (good to a degree or so). */
export function sunElevation(lat: number, lon: number, date = new Date()): number {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (date.getTime() - start) / 86_400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarHour = utcHours + lon / 15;
  const ha = 15 * (solarHour - 12);
  const s = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(ha * rad);
  return Math.asin(Math.max(-1, Math.min(1, s))) / rad;
}
