// Versus, client side: the pairings list (who you compare with, who asked you) and the pure
// helpers the screen uses. The comparison itself is computed on the server (api/versus.js), which
// only ever sends aggregates of the other person.
import { create } from 'zustand'
import { api } from './api.js'

// Pairings + the incoming-request count that puts a dot on the tab. Not persisted: it is a view
// of the server, refreshed on load, on focus, every minute while open, and after every action.
export const useVersus = create(() => ({ pairs: [], incoming: 0, loaded: false }))

let inflight = null
export function refreshVersus() {
  if (inflight) return inflight
  inflight = api('/api/versus')
    .then(r => useVersus.setState({ pairs: r.pairs || [], incoming: r.incoming || 0, loaded: true }))
    .catch(() => { /* offline or signed out: keep what we had */ })
    .finally(() => { inflight = null })
  return inflight
}

export const versusAction = async (path, body) => {
  const r = await api(path, { method: 'POST', body: JSON.stringify(body) })
  await refreshVersus()
  return r
}

const LB = 0.45359237
/** A kg figure from the server, in the viewer's own unit. */
export const inUnit = (kg, unit) => (unit === 'lb' ? kg / LB : kg)

/**
 * Which side is ahead on one number: 'you', 'them' or 'tie'. `lowerWins` for counts where less is
 * better (cheat meals). Nothing to compare when either side has no number.
 */
export function leader(you, them, { lowerWins = false } = {}) {
  if (you == null || them == null || you === them) return 'tie'
  return (you > them) !== lowerWins ? 'you' : 'them'
}

/**
 * One calendar day, both people: `[{ who: 'you'|'them', kind: 'workout'|'cheat', name }]`,
 * workouts before cheat meals and, within each, yours first. An unnamed session keeps name ''.
 * A side from a server that predates the per-day calendar falls back to its trained days alone.
 */
export function dayEvents(you, them, iso) {
  const side = s => s?.calendar?.[iso] || { workouts: (s?.trainedDays || []).includes(iso) ? [''] : [], cheat: [] }
  const a = side(you), b = side(them)
  const as = (who, kind) => name => ({ who, kind, name })
  return [
    ...a.workouts.map(as('you', 'workout')), ...b.workouts.map(as('them', 'workout')),
    ...a.cheat.map(as('you', 'cheat')), ...b.cheat.map(as('them', 'cheat'))
  ]
}

/**
 * One person's half of a calendar cell: what fits in `rows` lines, and how many fold into "+n".
 * The "+n" takes a line of its own, so an overflowing half shows one name fewer.
 */
export function halfOf(events, who, rows = 2) {
  const mine = events.filter(e => e.who === who)
  const shown = mine.length > rows ? mine.slice(0, rows - 1) : mine
  return { shown, more: mine.length - shown.length }
}

/** The pairing to show: the remembered one if it is still active, else the first active one. */
export function pickPair(pairs, remembered) {
  const active = (pairs || []).filter(p => p.status === 'active')
  return active.find(p => p.id === remembered) || active[0] || null
}
