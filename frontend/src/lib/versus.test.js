import { describe, it, expect } from 'vitest'
import { leader, pickPair, inUnit, dayEvents, halfOf } from './versus.js'

describe('leader', () => {
  it('names who is ahead, or a tie', () => {
    expect(leader(5, 3)).toBe('you')
    expect(leader(2, 3)).toBe('them')
    expect(leader(3, 3)).toBe('tie')
  })
  it('flips for numbers where less is better', () => {
    expect(leader(1, 4, { lowerWins: true })).toBe('you')
    expect(leader(4, 1, { lowerWins: true })).toBe('them')
  })
  it('does not crown anyone when a number is missing', () => {
    expect(leader(null, 3)).toBe('tie')
    expect(leader(80, undefined)).toBe('tie')
  })
})

describe('pickPair', () => {
  const pairs = [{ id: 'p', status: 'pending' }, { id: 'a', status: 'active' }, { id: 'b', status: 'active' }]
  it('keeps the remembered pairing while it is active', () => expect(pickPair(pairs, 'b').id).toBe('b'))
  it('falls back to the first active one', () => {
    expect(pickPair(pairs, 'gone').id).toBe('a')
    expect(pickPair(pairs, 'p').id).toBe('a')
  })
  it('is empty when nobody has accepted yet', () => expect(pickPair([{ id: 'p', status: 'pending' }])).toBe(null))
})

it('shows kg figures in the viewer unit', () => {
  expect(inUnit(100, 'kg')).toBe(100)
  expect(Math.round(inUnit(100, 'lb'))).toBe(220)
})

describe('dayEvents', () => {
  const D = '2026-09-24'
  const you = { calendar: { [D]: { workouts: ['Pull'], cheat: ['Pizza'] } } }
  const them = { calendar: { [D]: { workouts: ['', 'Legs'], cheat: [] } } }
  it('lists workouts before cheat meals, yours first within each', () => {
    expect(dayEvents(you, them, D)).toEqual([
      { who: 'you', kind: 'workout', name: 'Pull' },
      { who: 'them', kind: 'workout', name: '' },
      { who: 'them', kind: 'workout', name: 'Legs' },
      { who: 'you', kind: 'cheat', name: 'Pizza' }
    ])
  })
  it('an empty day is empty on both sides', () => expect(dayEvents(you, them, '2026-09-01')).toEqual([]))
  it('a side without the per-day calendar still shows its trained days, unnamed', () => {
    expect(dayEvents({ trainedDays: [D] }, {}, D)).toEqual([{ who: 'you', kind: 'workout', name: '' }])
  })
})

describe('halfOf', () => {
  const ev = (who, name, kind = 'workout') => ({ who, kind, name })
  const day = [ev('you', 'Pull'), ev('them', 'Legs'), ev('you', 'Pizza', 'cheat'), ev('them', 'Gyros', 'cheat'), ev('them', 'Donuts', 'cheat')]
  it('keeps each person to their own half, whole when it fits', () => {
    expect(halfOf(day, 'you')).toEqual({ shown: [ev('you', 'Pull'), ev('you', 'Pizza', 'cheat')], more: 0 })
  })
  it('an overflowing half gives its last line to "+n"', () => {
    expect(halfOf(day, 'them')).toEqual({ shown: [ev('them', 'Legs')], more: 2 })
  })
  it('an empty half is empty', () => expect(halfOf([ev('you', 'Pull')], 'them')).toEqual({ shown: [], more: 0 }))
})
