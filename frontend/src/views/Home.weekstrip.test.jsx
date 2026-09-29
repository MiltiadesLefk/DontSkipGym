// @vitest-environment happy-dom
// The Home week strip reads like a calendar: each day names the session logged on it, else the
// one planned, and a tap goes to that day (its session, or the plan picker — see openDaySheet).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { openDaySheet } from '../sheets.jsx'
import { todayISO } from '../lib/format.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(), openDaySheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '',
}))

const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  openDaySheet.mockClear()
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const every = { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }
const mount = over => {
  useStore.setState(s => ({ S: { ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false, week: every, ...over }, user: null }))
  act(() => root.render(<Home />))
}
const todayCell = () => host.querySelector('.wday.today')

describe('Home week strip', () => {
  it('names the planned session, and the logged one once it is done', () => {
    mount()
    expect(todayCell().querySelector('.ev.plan').textContent).toBe('Push')
    mount({ workouts: [{ id: 'w', d: todayISO(), name: 'Pull', entries: [] }] })
    expect(todayCell().querySelector('.ev.done').textContent).toBe('Pull')
  })

  it('a tap on a day opens that day', () => {
    mount()
    act(() => { todayCell().dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(openDaySheet).toHaveBeenCalledWith(expect.objectContaining({ routines }), todayISO())
  })
})
