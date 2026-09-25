// @vitest-environment happy-dom
// Stats charts cardio as the distance per workout (km); sets named in the list read their derived
// speed in the profile's unit (mph for a pound profile).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats.jsx'

const mocks = vi.hoisted(() => ({ charts: [], S: null }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, calendarSheet: () => {}, workoutDetailSheet: () => {}, exerciseHistorySheet: () => {},
  WorkoutRow: () => null, bwDeltaColor: () => 'inherit',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: props => { mocks.charts.push(props); return null } }))
vi.mock('../components/Heatmap.jsx', () => ({ default: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null, BodyMapLegend: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const BIKE = '2138'
const session = (d, speeds) => ({
  id: d, d, start: Date.parse(d + 'T10:00:00Z'), end: Date.parse(d + 'T10:40:00Z'), name: 'Cardio',
  entries: [{ id: BIKE, target: { id: BIKE, sets: speeds.length, min: 20, speed: 8 }, sets: speeds.map(speed => ({ min: 20, speed, done: true })) }],
})
let root, host
afterEach(() => { act(() => root.unmount()); host.remove(); mocks.charts = [] })

function mount(settings) {
  mocks.S = { body: 'male', effort: 'none', targetW: null, bodyweight: [], routines: [], exWeights: {}, ...settings,
    workouts: [session('2026-09-01', [8, 9.66]), session('2026-09-08', [16.09])] }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Stats />))
  return mocks.charts.find(c => c.color === 'var(--blue)')
}

describe('Stats — cardio distance', () => {
  // Cardio charts as the distance per workout, in km whatever the profile's weight/speed unit;
  // the best-session line still reads its speed in the profile's unit.
  it('charts distance per workout in km for a pound profile, naming the session in mph', () => {
    const chart = mount({ unit: 'lb' })
    expect(chart.unit).toBe('km')
    expect(chart.points.map(p => p.y)).toEqual([5.89, 5.36])
    expect(host.textContent).toContain('20 min · 5.4 km (10 mph)')
  })

  it('names the session in km/h for a kg profile', () => {
    const chart = mount({ unit: 'kg' })
    expect(chart.unit).toBe('km')
    expect(chart.points.map(p => p.y)).toEqual([5.89, 5.36])
    expect(host.textContent).toContain('20 min · 5.4 km (16.1 km/h)')
  })
})
