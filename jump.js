// The spider's jump: a crouch, the push, a ballistic flight with the legs tucked, the landing and its absorb. Pure
// functions of t, no three.js. J = {t0: the crouch starts, tl: lift-off, ta: touch-down, dist: the forward travel,
// h: the apex over the standing height}. The forward travel rides on the gait's path as a velocity pulse (jumpKeys,
// its integral is dist), so the gait re-plants the feet round the landing spot; jumpAt gives what goes on top of the
// path: the body's height and pitch and the tuck the legs blend toward (spider.js legTuck).
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ssw = (e, s, f) => smoother((e - s) / (f - s));
// how far the body sinks into its legs before the push
export const CROUCH = 0.17;
// the absorb after touch-down
export const LAND = 0.45;

/** Height offset, pitch (radians, nose up > 0), tuck 0..1 and whether the body is in the air, at t. */
export function jumpAt(t, J) {
  const {t0, tl, ta, h} = J;
  if (t < t0 || t > ta + LAND) return {dy: 0, pitch: 0, tuck: 0, air: 0};
  if (t < tl) {
    // down and a little nose-down over most of the window, then the last 0.12 s straightens the legs fast
    const c = ssw(t, t0, tl - 0.12);
    const push = ssw(t, tl - 0.12, tl);
    return {dy: -CROUCH * c * (1 - push), pitch: -0.07 * c * (1 - push) + 0.16 * push, tuck: 0, air: 0};
  }
  if (t < ta) {
    const q = (t - tl) / (ta - tl);
    const tuck = ssw(q, 0.0, 0.28) * (1 - ssw(q, 0.7, 1.0));
    return {dy: 4 * h * q * (1 - q), pitch: 0.16 * (1 - 2 * q) - 0.04 * Math.sin(Math.PI * q), tuck, air: 1};
  }
  // the body sinks into the legs and comes back up
  const k = (t - ta) / LAND;
  const s = Math.sin(Math.PI * Math.min(1, k)) * (1 - 0.35 * k);
  return {dy: -0.13 * s, pitch: -0.08 * s, tuck: 0, air: 0};
}

/** The jump's forward travel as gait velocity keys [t, speed, yawRate°/s]: a pulse over the flight whose integral is
 * J.dist (the gait eases between keys with the same smoother, so the area is half of peak x flight). */
export const jumpKeys = (J) => [
  [J.tl, 0, 0],
  [(J.tl + J.ta) / 2, (2 * J.dist) / (J.ta - J.tl), 0],
  [J.ta, 0, 0],
];
