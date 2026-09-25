import { describe, it, expect } from 'vitest'
import { leader, pickPair, inUnit } from './versus.js'

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
