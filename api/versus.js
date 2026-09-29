// Versus: two consenting profiles, side by side. Pure functions over one user's stored state —
// the routes in server.js decide who may see whom; this only decides WHAT is shown, and that is
// aggregates only: counts, totals, bests, and for the current month a calendar of each day's
// session names and cheat-meal foods. Never a workout's contents, a routine, a note or a set
// list, so the other person's state never leaves the server.
//
// Loads are compared in kg whatever unit each profile logs in, so two people on different units
// still compare like with like.

const LB = 0.45359237;
const DAY = 86400000;
const list = v => (Array.isArray(v) ? v : []);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const round1 = n => Math.round(n * 10) / 10;
// Longest session or food name a calendar cell carries
const NAME_MAX = 60;

export function isWarmup(s) {
  if (s?.phase != null && s.phase !== '') return String(s.phase).toLowerCase().replace(/[^a-z]/g, '') === 'warmup';
  return s?.warmup === true;
}

// 'YYYY-MM-DD' minus n days, on the calendar (no time zone involved: both sides are dates).
export function dayMinus(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Cheat meals as the app stores them, or the history migrated from the previous app before the
// profile wrote its own list (same rule as frontend/src/lib/cheat-meals.js).
export function cheatMealsOf(S) {
  if (Array.isArray(S?.cheatMeals)) return S.cheatMeals.filter(e => obj(e) && isDay(e.d) && typeof e.food === 'string');
  return list(S?.legacy?.cheatMeals).filter(e => obj(e) && isDay(e.day) && typeof e.food === 'string').map(e => ({ food: e.food, d: e.day }));
}

function topFood(meals) {
  const by = new Map();
  for (const m of meals) {
    const k = m.food.trim().toLowerCase();
    if (!k) continue;
    const cur = by.get(k) || { food: m.food.trim(), n: 0 };
    cur.n++;
    by.set(k, cur);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.food.localeCompare(b.food))[0] || null;
}

const doneWorkSets = e => list(e?.sets).filter(s => obj(s) && s.done && !isWarmup(s));

/**
 * One side of the comparison. `today` is the viewer's own calendar day ('YYYY-MM-DD'), so "this
 * week" and "this month" follow the person looking, not the server's clock.
 */
export function summarize(S, { today, shareBodyweight = true } = {}) {
  const toKg = (S?.unit === 'lb') ? (x => x * LB) : (x => x);
  const workouts = list(S?.workouts).filter(w => obj(w) && isDay(w.d));
  const since28 = dayMinus(today, 27), since7 = dayMinus(today, 6), month = today.slice(0, 7);

  const tally = ws => {
    let volume = 0, sets = 0;
    for (const w of ws) {
      volume += toKg(Number(w.vol) || 0);
      for (const e of list(w.entries)) sets += doneWorkSets(e).length;
    }
    return { workouts: ws.length, volume: Math.round(volume), sets };
  };

  const trainedDays = [...new Set(workouts.filter(w => w.d.startsWith(month)).map(w => w.d))].sort();

  const meals = cheatMealsOf(S);
  const cheat = {
    total: meals.length,
    week: meals.filter(m => m.d >= since7 && m.d <= today).length,
    top: topFood(meals),
    days: [...new Set(meals.filter(m => m.d.startsWith(month)).map(m => m.d))].sort()
  };

  // The month as a calendar: { 'YYYY-MM-DD': { workouts: [names], cheat: [foods] } }, each list
  // in the order logged. An unnamed session is '' and the viewer labels it.
  const calendar = {};
  const dayOf = d => (calendar[d] = calendar[d] || { workouts: [], cheat: [] });
  for (const w of workouts.filter(w => w.d.startsWith(month)).sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0))) {
    dayOf(w.d).workouts.push(typeof w.name === 'string' ? w.name.slice(0, NAME_MAX) : '');
  }
  for (const m of meals.filter(m => m.d.startsWith(month))) dayOf(m.d).cheat.push(m.food.trim().slice(0, NAME_MAX));

  let bodyweight = null;
  if (shareBodyweight) {
    const bw = list(S?.bodyweight).filter(b => obj(b) && isDay(b.d) && Number(b.w) > 0).sort((a, b) => (a.d < b.d ? -1 : 1));
    if (bw.length) {
      const last = bw[bw.length - 1];
      const since30 = dayMinus(today, 29);
      const first30 = bw.find(b => b.d >= since30);
      bodyweight = {
        kg: round1(toKg(Number(last.w))),
        d: last.d,
        change30: first30 && first30 !== last ? round1(toKg(Number(last.w) - Number(first30.w))) : null
      };
    }
  }

  return {
    allTime: tally(workouts),
    last28: tally(workouts.filter(w => w.d >= since28 && w.d <= today)),
    trainedDays,
    calendar,
    cheat,
    bodyweight
  };
}

// Heaviest completed work set per exercise, in kg: { exId: { w, r, d } }. Cardio and timed rows
// carry no load and are skipped.
export function bestSets(S) {
  const toKg = (S?.unit === 'lb') ? (x => x * LB) : (x => x);
  const out = {};
  for (const w of list(S?.workouts)) {
    if (!obj(w) || !isDay(w.d)) continue;
    for (const e of list(w.entries)) {
      if (!obj(e) || typeof e.id !== 'string') continue;
      for (const s of doneWorkSets(e)) {
        const kg = toKg(Number(s.w) || 0), r = Number(s.r) || 0;
        if (!(kg > 0) || !(r > 0)) continue;
        const cur = out[e.id];
        if (!cur || kg > cur.w || (kg === cur.w && r > cur.r)) out[e.id] = { w: round1(kg), r, d: w.d };
      }
    }
  }
  return out;
}

// The exercises both people have a best for, so every row compares the same lift. Custom
// exercises only match when both profiles hold the same id; their names travel with them, since
// the viewer's own library does not know the other person's customs.
export function commonBests(A, B, max = 30) {
  const a = bestSets(A), b = bestSets(B);
  const nameOf = (S, id) => (list(S?.customEx).find(c => c?.id === id)?.n) || null;
  return Object.keys(a).filter(id => b[id])
    .map(id => ({ id, name: nameOf(A, id) || nameOf(B, id), you: a[id], them: b[id] }))
    .sort((x, y) => Math.max(y.you.w, y.them.w) - Math.max(x.you.w, x.them.w))
    .slice(0, max);
}
