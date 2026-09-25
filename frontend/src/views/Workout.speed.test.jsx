// @vitest-environment happy-dom
// Cardio is time + distance (km) in the set row; the average speed is derived and stored in km/h.
// The reference line under the exercise still reads that speed in the profile's unit (mph).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const BIKE = '2138'   // stationary bike, cardio
let root, container

function mount(settings = {}, sets = [{ min: 20, km: 3, speed: 9, done: false }]) {
  if (root) unmount()
  const S = { ...JSON.parse(JSON.stringify(DEF)), ...settings }
  S.active = {
    id: 'speed-test', d: '2026-09-23', start: Date.now(), routineId: null, name: 'Cardio', bw: null, cur: 0,
    entries: [{ id: BIKE, target: { sets: 1, min: 20, km: 3, speed: 9 }, sets }],
  }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}
function unmount() {
  act(() => root.unmount())
  container.remove()
  root = null
}
afterEach(() => { if (root) unmount() })

// The distance column is the second stepper of the set row, after the minutes.
const speedCell = () => container.querySelector('.setrow').querySelectorAll('.stp')[1]
const shown = () => speedCell().querySelector('input').value
const header = () => container.querySelector('.sethead .r-sp').textContent
const storedSet = () => useStore.getState().S.active.entries[0].sets[0]
const stored = () => storedSet().speed
const tap = label => act(() => speedCell().querySelector(`button[aria-label="${label}"]`).click())
function type(value) {
  const input = speedCell().querySelector('input')
  act(() => {
    Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('cardio distance in the set row', () => {
  // Cardio is logged as time + distance (lib/cardio.js); the speed column is gone, and the
  // average speed is derived and stored, always in km/h, whatever speed unit the profile reads.
  it('logs distance in km for a profile in pounds too, and stores the derived km/h', () => {
    mount({ unit: 'lb' })
    expect(header()).toBe('Distance (km)')
    expect(shown()).toBe('3')
    tap('Increase')
    expect(storedSet().km).toBe(3.1)
    expect(stored()).toBe(9.3)   // 3.1 km in 20 min
    type('4.5')
    expect(storedSet().km).toBe(4.5)
    expect(stored()).toBe(13.5)
    expect(shown()).toBe('4.5')
  })

  it('does not follow a chosen speed unit: the column is a distance either way', () => {
    mount({ unit: 'kg', speedUnit: 'mph' })
    expect(header()).toBe('Distance (km)')
    mount({ unit: 'lb', speedUnit: 'kmh' })
    expect(header()).toBe('Distance (km)')
    expect(shown()).toBe('3')
  })

  it('re-derives the speed when the minutes change, and reads an older set\'s distance as speed x time', () => {
    mount()
    const min = container.querySelector('.setrow').querySelectorAll('.stp')[0]
    act(() => min.querySelector('button[aria-label="Increase"]').click())
    expect(stored()).toBe(8.6)   // 3 km in 21 min
    mount({}, [{ min: 30, speed: 8, done: false }])
    expect(shown()).toBe('4')   // 8 km/h for half an hour
  })
})

// The line under the exercise reads the past in the same unit as the row it sits over, whether
// it holds the last time or the best set (#173).
describe('the reference line in mph', () => {
  const past = { id: 'w0', d: '2026-09-20', start: Date.now() - 3 * 86400000, end: Date.now() - 3 * 86400000 + 1800000, name: 'Cardio',
    entries: [{ id: BIKE, target: { mode: 'cardio', sets: 1, min: 20, speed: 16.09344 }, sets: [{ min: 20, speed: 16.09344, done: true }] }] }
  const refText = () => container.querySelector('.refline')?.textContent || ''

  it('shows last time and the best set in mph for a profile in pounds', () => {
    mount({ unit: 'lb', workouts: [past] })
    expect(refText()).toContain('20 min · 5.4 km (10 mph)')
    mount({ unit: 'lb', workouts: [past], logRef: 'best' })
    expect(refText()).toContain('20 min · 5.4 km (10 mph)')
  })
})
