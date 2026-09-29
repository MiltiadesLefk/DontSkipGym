// @vitest-environment happy-dom
// A tap on a day — from the month calendar or the Home week strip — answers "what happened that
// day" when something was logged, and only offers to plan a session when nothing was.
import React from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUI } from './store/useUI.js'
import { openDaySheet } from './sheets.jsx'

const D = '2026-09-22'
const w = (id, d = D) => ({ id, d, name: id, start: 1, end: 2, vol: 0, entries: [] })
const top = () => { const s = useUI.getState().sheets.at(-1); return s.render(() => {}) }

beforeEach(() => useUI.setState({ sheets: [], toastMsg: '' }))

describe('openDaySheet', () => {
  it('opens the session logged that day', () => {
    openDaySheet({ workouts: [w('Pull'), w('Legs', '2026-09-23')] }, D)
    expect(top().props.w.id).toBe('Pull')
  })

  it('lists the sessions to pick from when the day has several', () => {
    openDaySheet({ workouts: [w('Push'), w('Cardio')] }, D)
    const el = top()
    expect(el.props.w).toBeUndefined()
    const list = React.Children.toArray(el.props.children).find(c => c.props?.className === 'list')
    expect(list.props.children.map(c => c.props.w.id)).toEqual(['Push', 'Cardio'])
  })

  it('offers to plan a session on a day with nothing logged', () => {
    openDaySheet({ workouts: [w('Legs', '2026-09-23')] }, D)
    expect(top().props.iso).toBe(D)
  })
})
