// Cardio is logged as what the machine shows at the end: time and distance. The pace can change
// during a session (intervals, a hill, a cool-down), so one speed for a whole set was never what
// happened; average speed is derived from the two and stored alongside as `speed`, which keeps
// every reader that still looks at speed (Stats, the Coach, plan files) working unchanged.
//
// A set is { min, km, speed, done }. Sets and routine targets written before distance existed
// carry only { min, speed }; their distance is read back as speed × time.

const round = (n, p) => Math.round(n * p) / p
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** The distance of a cardio set or target, in km — logged, or implied by an older speed. */
export function kmOf(s) {
  if (!s) return 0
  if (s.km != null && s.km !== '') return Math.max(0, num(s.km))
  return num(s.speed) > 0 && num(s.min) > 0 ? round(num(s.speed) * num(s.min) / 60, 100) : 0
}

/** Average km/h over a set, 0 when there is no time or no distance to divide. */
export function avgSpeed(min, km) {
  return num(min) > 0 && num(km) > 0 ? round(num(km) / (num(min) / 60), 10) : 0
}

/** The set with `speed` brought back in line after `min` or `km` changed. */
export function withSpeed(s) {
  return { ...s, speed: avgSpeed(s.min, kmOf(s)) }
}

/** A fresh cardio set: from the previous set when there is one, else the target. */
export function cardioSet(prev, target = {}, extra = {}) {
  const src = prev || { min: target.min || 20, km: kmOf(target) || 3 }
  return withSpeed({ min: num(src.min) || 20, km: kmOf(src), done: false, ...extra })
}

/** Distance of every completed set of a workout entry, added up. */
export const entryKm = sets => round((sets || []).filter(s => s && s.done !== false).reduce((a, s) => a + kmOf(s), 0), 100)
