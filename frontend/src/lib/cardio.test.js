import { describe, it, expect } from 'vitest'
import { kmOf, avgSpeed, withSpeed, cardioSet, entryKm } from './cardio.js'

describe('distance', () => {
  it('is what was logged', () => expect(kmOf({ min: 27, km: 5, speed: 11.1 })).toBe(5))
  it('is implied by speed × time for sets logged before distance existed', () => {
    expect(kmOf({ min: 30, speed: 10 })).toBe(5)
    expect(kmOf({ min: 10, speed: 6.2 })).toBe(1.03)
  })
  it('is 0 when nothing says otherwise, and never negative', () => {
    expect(kmOf({ min: 10 })).toBe(0)
    expect(kmOf(null)).toBe(0)
    expect(kmOf({ km: -2 })).toBe(0)
  })
  it('counts a logged 0 km as 0, not as "unknown"', () => expect(kmOf({ min: 10, km: 0, speed: 8 })).toBe(0))
})

describe('average speed', () => {
  it('comes from time and distance, whatever the pace did in between', () => {
    expect(avgSpeed(27, 5)).toBe(11.1)
    expect(avgSpeed(60, 12)).toBe(12)
  })
  it('is 0 without time or distance', () => {
    expect(avgSpeed(0, 5)).toBe(0)
    expect(avgSpeed(20, 0)).toBe(0)
  })
  it('follows an edit of either field', () => {
    expect(withSpeed({ min: 30, km: 6, speed: 99 }).speed).toBe(12)
    expect(withSpeed({ min: 20, km: 6, speed: 12 }).speed).toBe(18)
  })
})

describe('new sets', () => {
  it('copy the previous set, distance included', () => {
    expect(cardioSet({ min: 25, km: 4.2, done: true })).toEqual({ min: 25, km: 4.2, speed: 10.1, done: false })
  })
  it('start from the target otherwise, converting an older speed target', () => {
    expect(cardioSet(null, { min: 20, km: 3 })).toEqual({ min: 20, km: 3, speed: 9, done: false })
    expect(cardioSet(null, { min: 20, speed: 9 })).toEqual({ min: 20, km: 3, speed: 9, done: false })
    expect(cardioSet(null, {})).toEqual({ min: 20, km: 3, speed: 9, done: false })
  })
  it('carry extra flags such as a warm-up', () => {
    expect(cardioSet(null, {}, { phase: 'warmup', warmup: true })).toMatchObject({ phase: 'warmup', warmup: true })
  })
})

it('adds up the distance of the completed sets', () => {
  expect(entryKm([{ min: 10, km: 2, done: true }, { min: 10, km: 1.5, done: true }, { min: 10, km: 9, done: false }])).toBe(3.5)
})
