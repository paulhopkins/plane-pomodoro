import { describe, expect, it } from 'vitest';
import { CRUISE_ALT_M, distanceAt, flightState, phaseAt, PHASES, progressOf, TOUCHDOWN } from './flight';

describe('flight model', () => {
  it('phase shares sum to one', () => {
    expect(PHASES.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1, 10);
  });

  it('maps progress to phases in order', () => {
    expect(phaseAt(0).phase).toBe('gate');
    expect(phaseAt(0.5).phase).toBe('cruise');
    expect(phaseAt(0.999).phase).toBe('taxiIn');
    expect(phaseAt(1).phase).toBe('taxiIn');
    expect(phaseAt(progressOf('descent')).phase).toBe('descent');
    expect(phaseAt(progressOf('descent')).pp).toBeCloseTo(0);
  });

  it('starts and ends parked on the ground', () => {
    const start = flightState(0), end = flightState(1);
    expect(start.altitude).toBe(0);
    expect(start.speed).toBe(0);
    expect(end.altitude).toBe(0);
    expect(end.speed).toBeCloseTo(0, 5);
    expect(end.enginesOn).toBe(false);
  });

  it('cruises at altitude with the seatbelt sign off', () => {
    const s = flightState(0.5);
    expect(s.altitude).toBe(CRUISE_ALT_M);
    expect(s.seatbelt).toBe(false);
  });

  it('altitude is continuous and rises then falls', () => {
    let prev = flightState(0).altitude;
    let peaked = false;
    for (let i = 1; i <= 2000; i++) {
      const a = flightState(i / 2000).altitude;
      expect(Math.abs(a - prev)).toBeLessThan(150);
      if (a < prev - 1e-6) peaked = true;
      if (!peaked) expect(a).toBeGreaterThanOrEqual(prev - 1e-6);
      else expect(a).toBeLessThanOrEqual(prev + 1e-6);
      prev = a;
    }
  });

  it('touches down exactly at the touchdown point', () => {
    expect(flightState(progressOf('approach', TOUCHDOWN) - 1e-4).altitude).toBeGreaterThan(0);
    expect(flightState(progressOf('approach', TOUCHDOWN) + 1e-4).altitude).toBe(0);
  });

  it('distance travelled never decreases', () => {
    let prev = 0;
    for (let i = 0; i <= 1000; i++) {
      const d = distanceAt(i / 1000);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
});
