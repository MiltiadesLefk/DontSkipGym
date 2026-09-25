// Cheat meals: a per-profile log of what was eaten off-plan, synced with the rest of the state
// as `S.cheatMeals` = [{ id, food, d: 'YYYY-MM-DD', t: ms it was logged }].
//
// Profiles migrated from the previous gym app carry their history in `S.legacy.cheatMeals`
// ({ food, day, logged_at }). Until this profile writes its first entry here, that history is
// read through `cheatMealsOf`; the first add or delete then stores it as `S.cheatMeals`. Legacy
// ids are derived from the entry itself, so two devices converting the same history produce the
// same ids and the sync merge (union by id) does not double it.

import { isoOf, uid } from './format.js'

export const FOOD_MAX = 120
// As many distinct foods as the breakdown shows before folding the rest into "other"
export const TOP_FOODS = 6

const list = v => (Array.isArray(v) ? v : [])
const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T12:00:00'))

export function fromLegacy(legacy) {
  return list(legacy)
    .filter(e => e && typeof e.food === 'string' && isDay(e.day))
    .map((e, i) => {
      const t = Date.parse(e.logged_at)
      return { id: 'lg-' + (Number.isFinite(t) ? t.toString(36) : e.day + '-' + i), food: e.food.slice(0, FOOD_MAX), d: e.day, t: Number.isFinite(t) ? t : Date.parse(e.day + 'T12:00:00') }
    })
}

/** The profile's cheat meals, from `S.cheatMeals` or, before the first write, the migrated history. */
export const cheatMealsOf = S => (Array.isArray(S?.cheatMeals) ? S.cheatMeals.filter(e => e && e.id && isDay(e.d)) : fromLegacy(S?.legacy?.cheatMeals))

/**
 * A new entry, or `{ error }`. The day defaults to today and may be backdated but never set in
 * the future; `t` is always the real moment of logging, so "recent" sorts by when it was entered.
 */
export function newCheatMeal(food, day, now = Date.now()) {
  const f = String(food ?? '').trim().replace(/\s+/g, ' ')
  if (!f) return { error: 'empty' }
  const today = isoOf(new Date(now))
  const d = isDay(day) && day <= today ? day : today
  return { id: uid(), food: f.slice(0, FOOD_MAX), d, t: now }
}

const keyOf = food => String(food).trim().toLowerCase()

/**
 * How often each food was logged, most frequent first. "Pizza" and "pizza " count as one food;
 * the spelling shown is the most recently logged one.
 */
export function foodCounts(entries) {
  const by = new Map()
  for (const e of [...list(entries)].sort((a, b) => (a.t || 0) - (b.t || 0))) {
    const k = keyOf(e.food)
    if (!k) continue
    const cur = by.get(k) || { food: e.food.trim(), n: 0 }
    cur.n++
    cur.food = e.food.trim()
    by.set(k, cur)
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.food.localeCompare(b.food))
}

/** The top foods plus one `{ other: true }` row for everything past them. */
export function foodBreakdown(counts, top = TOP_FOODS) {
  const rows = counts.slice(0, top)
  const rest = counts.slice(top).reduce((a, f) => a + f.n, 0)
  if (rest > 0) rows.push({ food: null, n: rest, other: true })
  return rows
}

/** Entries on the 7 days ending `todayIso` (today counts). */
export function weekCount(entries, todayIso) {
  const from = new Date(todayIso + 'T12:00:00'); from.setDate(from.getDate() - 6)
  const start = isoOf(from)
  return list(entries).filter(e => e.d >= start && e.d <= todayIso).length
}

/** `{ 'YYYY-MM-DD': [entries…] }` for one month ('YYYY-MM'), each day in logging order. */
export function byDay(entries, month) {
  const out = {}
  for (const e of [...list(entries)].sort((a, b) => (a.t || 0) - (b.t || 0))) {
    if (month && !e.d.startsWith(month)) continue
    ;(out[e.d] = out[e.d] || []).push(e)
  }
  return out
}

/** Most recently logged first. */
export const recent = (entries, n = 20) => [...list(entries)].sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, n)
