import { describe, it, expect } from 'vitest'
import { fromLegacy, cheatMealsOf, newCheatMeal, foodCounts, foodBreakdown, weekCount, byDay, recent, FOOD_MAX } from './cheat-meals.js'

const at = (d, h = 12) => new Date(d + `T${String(h).padStart(2, '0')}:00:00`).getTime()
const e = (food, d, h) => ({ id: food + d + (h || ''), food, d, t: at(d, h) })

describe('legacy history', () => {
  const legacy = [
    { food: 'annas tsiken', day: '2026-09-19', logged_at: '2026-09-19T18:40:00.000Z' },
    { food: 'Lottus', day: '2026-09-18', logged_at: '2026-09-18T20:00:00.000Z' },
    { food: 'broken', day: 'not a day', logged_at: 'x' }
  ]
  it('is read until the profile writes its own list', () => {
    const got = cheatMealsOf({ legacy: { cheatMeals: legacy } })
    expect(got.map(x => [x.food, x.d])).toEqual([['annas tsiken', '2026-09-19'], ['Lottus', '2026-09-18']])
    expect(got[0].t).toBe(Date.parse('2026-09-19T18:40:00.000Z'))
  })
  it('gets the same ids on every device, so a sync merge cannot double it', () => {
    expect(fromLegacy(legacy).map(x => x.id)).toEqual(fromLegacy(legacy).map(x => x.id))
    expect(new Set(fromLegacy(legacy).map(x => x.id)).size).toBe(2)
  })
  it('is ignored once cheatMeals exists, even when empty', () => {
    expect(cheatMealsOf({ cheatMeals: [], legacy: { cheatMeals: legacy } })).toEqual([])
  })
  it('copes with a profile that never had any', () => {
    expect(cheatMealsOf({})).toEqual([])
    expect(cheatMealsOf(null)).toEqual([])
  })
})

describe('newCheatMeal', () => {
  const now = at('2026-09-25', 15)
  it('defaults to today and keeps the real logging time', () => {
    const m = newCheatMeal('  pizza   margherita ', undefined, now)
    expect(m).toMatchObject({ food: 'pizza margherita', d: '2026-09-25', t: now })
    expect(m.id).toBeTruthy()
  })
  it('can be backdated but not set in the future', () => {
    expect(newCheatMeal('pizza', '2026-09-20', now).d).toBe('2026-09-20')
    expect(newCheatMeal('pizza', '2026-09-26', now).d).toBe('2026-09-25')
    expect(newCheatMeal('pizza', 'garbage', now).d).toBe('2026-09-25')
  })
  it('refuses nothing, and caps the length', () => {
    expect(newCheatMeal('   ', undefined, now)).toEqual({ error: 'empty' })
    expect(newCheatMeal('x'.repeat(500), undefined, now).food.length).toBe(FOOD_MAX)
  })
})

describe('counting', () => {
  const log = [e('Pizza', '2026-09-01'), e('pizza ', '2026-09-10'), e('Burger', '2026-09-20'), e('PIZZA', '2026-09-24'), e('Burger', '2026-09-24', 20)]
  it('groups spellings, most frequent first, showing the latest spelling', () => {
    expect(foodCounts(log)).toEqual([{ food: 'PIZZA', n: 3 }, { food: 'Burger', n: 2 }])
  })
  it('folds everything past the top foods into one row', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((f, i) => ({ food: f, n: 10 - i }))
    const rows = foodBreakdown(many)
    expect(rows).toHaveLength(7)
    expect(rows[6]).toEqual({ food: null, n: 4 + 3, other: true })   // g and h
    expect(foodBreakdown(many.slice(0, 3))).toHaveLength(3)
  })
  it('counts the 7 days ending today', () => {
    expect(weekCount(log, '2026-09-25')).toBe(3)       // 20th, 24th, 24th
    expect(weekCount(log, '2026-09-26')).toBe(3)       // the 20th is still day 7
    expect(weekCount(log, '2026-09-27')).toBe(2)
  })
  it('lists a month by day in logging order, and recent newest first', () => {
    const days = byDay(log, '2026-09')
    expect(Object.keys(days).sort()).toEqual(['2026-09-01', '2026-09-10', '2026-09-20', '2026-09-24'])
    expect(days['2026-09-24'].map(x => x.food)).toEqual(['PIZZA', 'Burger'])
    expect(byDay(log, '2026-08')).toEqual({})
    expect(recent(log, 2).map(x => x.food)).toEqual(['Burger', 'PIZZA'])
  })
})
