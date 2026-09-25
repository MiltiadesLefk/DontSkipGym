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

/** The pairing to show: the remembered one if it is still active, else the first active one. */
export function pickPair(pairs, remembered) {
  const active = (pairs || []).filter(p => p.status === 'active')
  return active.find(p => p.id === remembered) || active[0] || null
}
