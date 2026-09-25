// @vitest-environment happy-dom
// A cardio exercise's settings: time and distance (km), with the average speed derived and kept.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXIDX } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'

const mounted = []
function open(settings, existing) {
  useStore.setState({ S: { ...structuredClone(DEF), ...settings }, user: null })
  const onSave = vi.fn()
  exConfigSheet(EXIDX['2138'], existing, onSave, null, null)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  const dist = [...host.querySelectorAll('.stp-w')].find(w => w.querySelector('.stp-l')?.textContent.startsWith('Distance'))
  const save = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save')
  return { dist, save, onSave }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('cardio settings distance', () => {
  // The routine target is time + distance in km; speed is derived from them and saved with them.
  it('steps the distance in km for a profile in pounds too, and saves the derived km/h', () => {
    const { dist, save, onSave } = open({ unit: 'lb' }, { sets: 1, min: 20, km: 3, speed: 9 })
    expect(dist.querySelector('.stp-l').textContent).toBe('Distance (km)')
    expect(dist.querySelector('input').value).toBe('3')
    act(() => dist.querySelector('button[aria-label="Increase"]').click())
    expect(dist.querySelector('input').value).toBe('3.1')
    act(() => save.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ min: 20, km: 3.1, speed: 9.3 }))
  })

  it('reads an older target\'s distance as speed x time', () => {
    const { dist, save, onSave } = open({ unit: 'kg' }, { sets: 1, min: 30, speed: 8 })
    expect(dist.querySelector('input').value).toBe('4')
    act(() => save.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ min: 30, km: 4, speed: 8 }))
  })
})
