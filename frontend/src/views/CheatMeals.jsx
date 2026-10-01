// Cheat meals — a per-profile log of what was eaten off-plan. Ported from the previous gym app:
// log a food (today by default, backdating allowed), see how often each one comes up, a month
// calendar of cheat days, and the recent list. Only ever your own entries; a head-to-head
// between two people is a separate (Versus) screen.
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtDate, weekStartOf, weekOrder, weekDayOffset, DAYS, MONTHS_LONG } from '../lib/format.js'
import { cheatMealsOf, newCheatMeal, foodCounts, foodBreakdown, weekCount, byDay, recent, FOOD_MAX } from '../lib/cheat-meals.js'
import { confirmSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import '../calendar-names.css'

const toast = msg => useUI.getState().toast(msg)

// Every write goes through here: the first one turns migrated history into this profile's own list.
function useCheatMeals() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const entries = cheatMealsOf(S)
  const write = fn => update(s => { s.cheatMeals = fn(cheatMealsOf(s)) })
  return { S, entries, add: m => write(list => [...list, m]), remove: id => write(list => list.filter(e => e.id !== id)) }
}

function DaySheet({ day, close }) {
  const { entries, remove } = useCheatMeals()
  const items = entries.filter(e => e.d === day).sort((a, b) => a.t - b.t)
  return <>
    <h3>{fmtDate(day, true)}</h3>
    {items.length ? <div className="list">{items.map(e => <MealRow key={e.id} e={e} onDelete={() => { remove(e.id); if (items.length === 1) close() }} />)}</div>
      : <div className="empty small">{t('No cheat meals that day.')}</div>}
  </>
}

function MealRow({ e, onDelete, showDate }) {
  return <div className="item">
    <span className="lrow-i" style={{ width: 34, height: 34, borderRadius: 8, fontSize: 19 }}><Icon name="pizza" /></span>
    <div className="grow"><div className="tt" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.food}</div>
      {showDate && <div className="ss">{fmtDate(e.d, true)}</div>}</div>
    <button className="iconbtn" aria-label={t('Delete')} onClick={onDelete}><Icon name="trash" /></button>
  </div>
}

function MonthCard({ S, entries }) {
  const [cur, setCur] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const y = cur.getFullYear(), mo = cur.getMonth()
  const month = y + '-' + String(mo + 1).padStart(2, '0')
  const atCurrentMonth = month >= todayISO().slice(0, 7)
  const days = byDay(entries, month)
  const ws = weekStartOf(S)
  const cells = []
  for (let i = 0; i < weekDayOffset(new Date(y, mo, 1).getDay(), ws); i++) cells.push(<div key={'e' + i} />)
  for (let d = 1, n = new Date(y, mo + 1, 0).getDate(); d <= n; d++) {
    const iso = month + '-' + String(d).padStart(2, '0')
    const has = days[iso]
    // Like a calendar: the food itself in the cell, two at most, the rest as "+n".
    cells.push(<button key={d} className={'cal-d named' + (has ? ' has' : '') + (iso === todayISO() ? ' today' : '')}
      aria-label={has ? fmtDate(iso, true) + ': ' + has.map(e => e.food).join(', ') : fmtDate(iso, true)}
      onClick={() => has && useUI.getState().openSheet(close => <DaySheet day={iso} close={close} />)}>
      <span>{d}</span>
      {has && <span className="evs">
        {has.slice(0, 2).map(e => <span key={e.id} className="ev done"><span className="t">{e.food}</span></span>)}
        {has.length > 2 && <span className="ev more">+{has.length - 2}</span>}
      </span>}
    </button>)
  }
  const inMonth = Object.values(days).reduce((a, l) => a + l.length, 0)
  return <div className="card">
    <div className="row between" style={{ marginBottom: 2 }}>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo - 1, 1))} aria-label={t('Previous month')}><Icon name="chevronLeft" /></button>
      <h2 style={{ margin: 0 }}>{t(MONTHS_LONG[mo])} {y}</h2>
      <button className="iconbtn" disabled={atCurrentMonth} onClick={() => !atCurrentMonth && setCur(new Date(y, mo + 1, 1))} aria-label={t('Next month')}><Icon name="chevronRight" /></button>
    </div>
    <div className="small muted" style={{ textAlign: 'center' }}>
      {inMonth ? t(inMonth === 1 ? '{0} cheat meal' : '{0} cheat meals', inMonth) + ' · ' + t(Object.keys(days).length === 1 ? '{0} day' : '{0} days', Object.keys(days).length) : t('No cheat meals this month')}
    </div>
    <div className="cal-grid named">{weekOrder(ws).map(d => <div key={d} className="cal-h">{t(DAYS[d])}</div>)}{cells}</div>
    {inMonth > 0 && <div className="small dim" style={{ textAlign: 'center', marginTop: 10 }}>{t('Tap a marked day to see what it was')}</div>}
  </div>
}

export default function CheatMeals() {
  const { S, entries, add, remove } = useCheatMeals()
  const [food, setFood] = useState('')
  const [day, setDay] = useState(todayISO())

  const counts = foodCounts(entries)
  const top = counts[0]
  const week = weekCount(entries, todayISO())
  const rows = foodBreakdown(counts)
  const maxN = Math.max(1, ...rows.map(r => r.n))

  const log = e => {
    e?.preventDefault()
    const m = newCheatMeal(food, day)
    if (m.error) { toast(t('Say what you ate')); return }
    add(m)
    setFood(''); setDay(todayISO())
    toast(m.d === todayISO() ? t('Logged') : t('Logged for {0}', fmtDate(m.d, true)))
  }
  const del = e => confirmSheet({ title: t('Delete this cheat meal?'), message: e.food + ' · ' + fmtDate(e.d, true), confirmText: t('Delete'), danger: true, onConfirm: () => remove(e.id) })

  return <>
    <div className="hdr"><div><h1>{t('Cheat meals')}</h1><div className="sub">{t('What you ate off-plan, and how often')}</div></div></div>

    <div className="card">
      <form onSubmit={log}>
        <input className="input" placeholder={t('What did you eat?')} maxLength={FOOD_MAX} value={food} onChange={e => setFood(e.target.value)} />
        {counts.length > 0 && <div className="chips" style={{ margin: '10px 0 0' }}>
          {counts.slice(0, 8).map(c => <button type="button" key={c.food} className="chip nocap" onClick={() => setFood(c.food)}>{c.food}</button>)}
        </div>}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <input className="input" type="date" value={day} max={todayISO()} onChange={e => setDay(e.target.value || todayISO())} style={{ flex: 1 }} />
          <Button variant="primary" type="submit" icon="plus" style={{ flex: 1 }}>{t('Log it')}</Button>
        </div>
      </form>
      <div className="small dim" style={{ marginTop: 8 }}>{t('Defaults to today — pick a date to log an earlier one.')}</div>
    </div>

    <div className="tiles">
      <div className="tile"><div className="l"><Icon name="pizza" />{t('Logged')}</div><div className="v">{entries.length}</div></div>
      <div className="tile"><div className="l"><Icon name="calendar" />{t('Last 7 days')}</div><div className="v">{week}</div></div>
      <div className="tile" style={{ gridColumn: '1 / -1' }}><div className="l"><Icon name="trophy" />{t('Top pick')}</div>
        <div className="v" style={{ fontSize: 22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top ? top.food : '—'}</div>
        {top && <div className="small dim">{t(top.n === 1 ? '{0} time' : '{0} times', top.n)}</div>}</div>
    </div>

    <div className="card">
      <h2>{t('What, and how often')}</h2>
      {rows.length ? rows.map(r => <div key={r.other ? '~other' : r.food} className="mrow">
        <span className="nm">{r.other ? t('Everything else') : r.food}</span>
        <span className="bar"><i style={{ width: Math.round(r.n / maxN * 100) + '%', background: r.other ? 'var(--label-3)' : 'var(--acc)' }} /></span>
        <span className="v">{r.n} · {Math.round(r.n / entries.length * 100)}%</span>
      </div>) : <div className="muted small">{t('Nothing logged yet.')}</div>}
    </div>

    <MonthCard S={S} entries={entries} />

    <div className="card">
      <h2>{t('Recent')}</h2>
      {entries.length ? <div className="list">{recent(entries).map(e => <MealRow key={e.id} e={e} showDate onDelete={() => del(e)} />)}</div>
        : <div className="empty"><div className="ico"><Icon name="pizza" /></div>{t('Nothing logged yet.')}</div>}
    </div>
  </>
}
