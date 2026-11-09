import { CatmullRomCurve3, Vector3 } from 'three';

const v = (x, y, z) => new Vector3(x, y, z);
const HOLD = 0.7; // screens of scrolling spent parked at a stop
const TRAVEL = 0.32; // screens of scrolling between two points on the route
const PLANET_GAP = 200;

export function planetLayout(projects) {
  return projects.map((project, index) => {
    const side = index % 2 ? -1 : 1; // +1 = planet on the right, card on the left
    const R = project.planet.radius;
    const P = v(side * 30, index % 2 ? -10 : 8, -250 - index * PLANET_GAP);
    const sun = v(side * 0.7, 0.45, 0.6).normalize();
    return { project, index, side, R, P, sun, beatId: project.slug };
  });
}

export const gateCentres = (planets) =>
  planets.slice(0, -1).map((a, i) => {
    const b = planets[i + 1];
    return v(0, (a.P.y + b.P.y) * 0.3, (a.P.z + b.P.z) / 2);
  });

export const hallZ = (planets) => planets[planets.length - 1].P.z - 220;

// The route the camera flies. Beats with `hold` are stops; the rest are waypoints.
export function buildBeats(planets, portrait) {
  const beats = [];
  const add = (id, pos, look, extra = {}) => beats.push({ id, pos, look, hold: 0, ...extra });

  if (portrait) {
    add('hero', v(0, 10, 165), v(0, -42, 0), { hold: HOLD, nav: 'Station' });
    add('about', v(-30, 12, 120), v(0, -34, 0), { hold: HOLD, nav: 'Pilot log' });
  } else {
    add('hero', v(34, 12, 100), v(-32, 2, 0), { hold: HOLD, nav: 'Station' });
    add('about', v(-46, 14, 56), v(17, 0, 14), { hold: HOLD, nav: 'Pilot log' });
  }
  add('approach', v(0, 0, 44), v(0, 0, 0));
  add('gate', v(0, 0, 0), v(0, 0, -50));
  add('tunnel', v(0, 0, -100), planets[0].P);

  const gates = gateCentres(planets);
  const Z = hallZ(planets);

  planets.forEach((p, i) => {
    const { P, R, side } = p;
    const pos = portrait
      ? P.clone().add(v(0, R * 0.2, R * 3.5))
      : P.clone().add(v(-side * R * 0.75, R * 0.2, R * 2.3));
    const look = portrait
      ? P.clone().add(v(0, -R * 0.62, 0))
      : P.clone().add(v(-side * R * 0.95, 0, 0));
    add(p.beatId, pos, look, { hold: HOLD, nav: p.project.nav ?? p.project.title, planet: p });

    const nextPoint = gates[i] ?? v(0, 0, Z);
    add(`pass-${i}`, P.clone().add(v(-side * R * 1.8, R * 0.3, -R * 0.5)), nextPoint);
    if (gates[i]) add(`gate-${i}`, gates[i], planets[i + 1].P);
  });

  add('mouth', v(0, 0, Z + 22), v(0, 0, Z - 40));
  if (portrait) add('lab', v(0, 5, Z - 30), v(0, -9, Z - 70), { hold: HOLD, nav: 'Reactor' });
  else add('lab', v(-13, 3, Z - 38), v(11, 0, Z - 70), { hold: HOLD, nav: 'Reactor' });
  add('core-pass', v(-16, -3, Z - 100), v(0, 0, Z - 150));
  add('exit', v(0, 0, Z - 150), v(0, 0, Z - 310));
  add('comms', v(0, 0, Z - 242), v(0, 0, Z - 310), { hold: HOLD, nav: 'Comms' });
  return beats;
}

// Maps scroll distance (in screens) to a position along the camera curves.
export function buildTimeline(beats) {
  const last = beats.length - 1;
  const knots = [];
  let x = 0;
  beats.forEach((beat, i) => {
    beat.a = x;
    if (beat.hold) {
      knots.push({ x, k: Math.max(0, i - 0.04) });
      x += beat.hold;
      knots.push({ x, k: Math.min(last, i + 0.04) });
    } else {
      knots.push({ x, k: i });
    }
    beat.b = x;
    if (i < last) x += TRAVEL;
  });

  const kAt = (value) => {
    if (value <= 0) return knots[0].k;
    for (let i = 1; i < knots.length; i++) {
      if (value <= knots[i].x) {
        const a = knots[i - 1];
        const b = knots[i];
        return a.k + ((b.k - a.k) * (value - a.x)) / Math.max(b.x - a.x, 1e-6);
      }
    }
    return last;
  };

  return { total: x, kAt };
}

export const buildCurves = (beats) => ({
  position: new CatmullRomCurve3(beats.map((b) => b.pos), false, 'centripetal'),
  look: new CatmullRomCurve3(beats.map((b) => b.look), false, 'centripetal'),
});
