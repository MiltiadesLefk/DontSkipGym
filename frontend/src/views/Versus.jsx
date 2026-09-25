// Versus — you and a friend side by side, by mutual consent. Ask by username; they accept or
// decline at the top of their own Versus tab (a dot on the tab tells them it is waiting). Either
// side can end it. With several partners, chips switch between them. What shows is aggregates
// only, computed on the server: counts, totals, bests and which days were trained.
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { EXIDX } from '../lib/exercises.js'
import { todayISO, fmtNum, fmtDate, weekStartOf, weekOrder, weekDayOffset, DAYS, MONTHS_LONG } from '../lib/format.js'
import { useVersus, refreshVersus, versusAction, inUnit, leader, pickPair } from '../lib/versus.js'
import { confirmSheet } from '../sheets.jsx'
import { Button, Switch } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import '../versus.css'

const toast = msg => useUI.getState().toast(msg)
const SEL_KEY = 'gym_versus_sel'
const remembered = () => { try { return localStorage.getItem(SEL_KEY) } catch { return null } }
const remember = id => { try { localStorage.setItem(SEL_KEY, id) } catch { /* private mode */ } }
const act = (path, body, done) => versusAction(path, body).then(done).catch(e => toast(e.message))

function AskForm({ onSent }) {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const send = e => {
    e.preventDefault()
    if (!username.trim()) { toast(t('Enter their username')); return }
    setBusy(true)
    act('/api/versus/request', { username: username.trim() }, r => { toast(t('Request sent to {0}', r.pair.other.name)); setUsername(''); onSent && onSent() })
      .finally(() => setBusy(false))
  }
  return <form onSubmit={send}>
    <div className="row" style={{ gap: 8 }}>
      <input className="input" style={{ flex: 1 }} placeholder={t('Their username')} autoCapitalize="none" spellCheck={false}
        value={username} onChange={e => setUsername(e.target.value.toLowerCase())} />
      <Button variant="primary" type="submit" icon="plus" disabled={busy} style={{ flex: 'none', width: 'auto' }}>{t('Ask')}</Button>
    </div>
    <div className="small dim" style={{ marginTop: 8 }}>{t('They see your request on their Versus tab and can accept or decline. Only totals are ever shared.')}</div>
  </form>
}

// One number, both sides: values at the edges, a bar split by share in the middle.
function Row({ label, you, them, fmt = fmtNum, lowerWins }) {
  const lead = leader(you, them, { lowerWins })
  const total = (you || 0) + (them || 0)
  const share = total > 0 ? Math.round((you || 0) / total * 100) : 50
  return <div className="vs-row">
    <span className={'vs-v' + (lead === 'you' ? ' lead' : '')}>{you == null ? '—' : fmt(you)}</span>
    <span className="vs-mid"><span className="vs-l">{label}</span><span className="vs-bar"><i style={{ width: share + '%' }} /></span></span>
    <span className={'vs-v r' + (lead === 'them' ? ' lead' : '')}>{them == null ? '—' : fmt(them)}</span>
  </div>
}

function Month({ S, you, them }) {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth()
  const month = todayISO().slice(0, 7)
  const a = new Set(you.trainedDays), b = new Set(them.trainedDays)
  const ws = weekStartOf(S)
  const cells = []
  for (let i = 0; i < weekDayOffset(new Date(y, mo, 1).getDay(), ws); i++) cells.push(<div key={'e' + i} />)
  for (let d = 1, n = new Date(y, mo + 1, 0).getDate(); d <= n; d++) {
    const iso = month + '-' + String(d).padStart(2, '0')
    cells.push(<div key={d} className={'cal-d vs-d' + (iso === todayISO() ? ' today' : '')}>
      <span>{d}</span><span className="vs-dots"><i className={a.has(iso) ? 'you' : ''} /><i className={b.has(iso) ? 'them' : ''} /></span>
    </div>)
  }
  return <div className="card">
    <h2>{t(MONTHS_LONG[mo])} {y}</h2>
    <div className="cal-grid">{weekOrder(ws).map(d => <div key={d} className="cal-h">{t(DAYS[d])}</div>)}{cells}</div>
    <div className="cal-legend"><span><i className="vs-key you" />{t('You')}</span><span><i className="vs-key them" />{them.name}</span></div>
  </div>
}

function Compare({ S, pair }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    let alive = true
    setData(null); setErr(null)
    api(`/api/versus/compare?id=${encodeURIComponent(pair.id)}&today=${todayISO()}`)
      .then(d => alive && setData(d)).catch(e => alive && setErr(e.message))
    return () => { alive = false }
  }, [pair.id, pair.shareBw])
  if (err) return <div className="card muted small">{err}</div>
  if (!data) return <div className="card muted small">{t('Loading…')}</div>
  const { you, them, bests } = data
  const u = S.unit
  const load = kg => fmtNum(Math.round(inUnit(kg, u))) + ' ' + u
  const weight = kg => fmtNum(inUnit(kg, u)) + ' ' + u
  const nameOf = b => (EXIDX[b.id] ? exerciseNameFor(EXIDX[b.id]) : b.name || t('Unknown exercise'))
  const end = () => confirmSheet({
    title: t('Stop comparing with {0}?', them.name),
    message: t('You both stop seeing each other here right away. Either of you can ask again later.'),
    confirmText: t('Stop comparing'), danger: true,
    onConfirm: () => act('/api/versus/end', { id: pair.id }, () => toast(t('Stopped comparing with {0}', them.name)))
  })
  return <>
    <div className="vs-names"><span>{t('You')}</span><span className="vs-vs">vs</span><span>{them.name}</span></div>

    <div className="card">
      <h2>{t('Last 28 days')}</h2>
      <Row label={t('Workouts')} you={you.last28.workouts} them={them.last28.workouts} />
      <Row label={t('Sets')} you={you.last28.sets} them={them.last28.sets} />
      <Row label={t('Total load')} you={you.last28.volume} them={them.last28.volume} fmt={load} />
    </div>

    <Month S={S} you={you} them={them} />

    <div className="card">
      <h2>{t('All time')}</h2>
      <Row label={t('Workouts')} you={you.allTime.workouts} them={them.allTime.workouts} />
      <Row label={t('Sets')} you={you.allTime.sets} them={them.allTime.sets} />
      <Row label={t('Total load')} you={you.allTime.volume} them={them.allTime.volume} fmt={load} />
    </div>

    <div className="card">
      <h2>{t('Best lifts')}</h2>
      {bests.length ? bests.map(b => <div key={b.id} className="vs-row">
        <span className={'vs-v' + (leader(b.you.w, b.them.w) === 'you' ? ' lead' : '')}>{weight(b.you.w)}<small> ×{b.you.r}</small></span>
        <span className="vs-mid"><span className="vs-l vs-ex">{nameOf(b)}</span></span>
        <span className={'vs-v r' + (leader(b.you.w, b.them.w) === 'them' ? ' lead' : '')}>{weight(b.them.w)}<small> ×{b.them.r}</small></span>
      </div>) : <div className="muted small">{t('No exercise you have both logged yet.')}</div>}
    </div>

    <div className="card">
      <h2>{t('Cheat meals')}</h2>
      <Row label={t('Last 7 days')} you={you.cheat.week} them={them.cheat.week} lowerWins />
      <Row label={t('All time')} you={you.cheat.total} them={them.cheat.total} lowerWins />
      <div className="vs-row">
        <span className="vs-v">{you.cheat.top ? you.cheat.top.food : '—'}</span>
        <span className="vs-mid"><span className="vs-l">{t('Top pick')}</span></span>
        <span className="vs-v r">{them.cheat.top ? them.cheat.top.food : '—'}</span>
      </div>
    </div>

    <div className="card">
      <h2>{t('Body weight')}</h2>
      <div className="vs-row">
        <span className="vs-v">{you.bodyweight ? weight(you.bodyweight.kg) : '—'}</span>
        <span className="vs-mid"><span className="vs-l">{t('Latest')}</span></span>
        <span className="vs-v r">{them.bodyweight ? weight(them.bodyweight.kg) : t('not shared')}</span>
      </div>
      {(you.bodyweight?.change30 != null || them.bodyweight?.change30 != null) && <div className="vs-row">
        <span className="vs-v">{you.bodyweight?.change30 != null ? (you.bodyweight.change30 > 0 ? '+' : '') + weight(you.bodyweight.change30) : '—'}</span>
        <span className="vs-mid"><span className="vs-l">{t('30 days')}</span></span>
        <span className="vs-v r">{them.bodyweight?.change30 != null ? (them.bodyweight.change30 > 0 ? '+' : '') + weight(them.bodyweight.change30) : '—'}</span>
      </div>}
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="small">{t('Share my body weight with {0}', them.name)}</span>
        <Switch checked={pair.shareBw} onChange={v => act('/api/versus/share', { id: pair.id, bodyweight: v })} />
      </div>
    </div>

    <Button variant="danger" onClick={end} style={{ marginBottom: 12 }}>{t('Stop comparing with {0}', them.name)}</Button>
  </>
}

export default function Versus() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { pairs, loaded } = useVersus()
  const [sel, setSel] = useState(remembered)
  const [adding, setAdding] = useState(false)
  useEffect(() => { if (user) refreshVersus() }, [user])

  const head = <div className="hdr"><div><h1>{t('Versus')}</h1><div className="sub">{t('You and a friend, side by side')}</div></div></div>
  if (!user) return <>{head}<div className="empty"><div className="ico"><Icon name="boxing" /></div>{t('Sign in to compare with a friend.')}</div></>

  const incoming = pairs.filter(p => p.status === 'pending' && p.dir === 'in')
  const outgoing = pairs.filter(p => p.dir === 'out' && p.status !== 'active')
  const active = pairs.filter(p => p.status === 'active')
  const current = pickPair(pairs, sel)
  const choose = id => { setSel(id); remember(id); setAdding(false) }

  return <>
    {head}

    {incoming.map(p => <div key={p.id} className="card vs-ask">
      <div className="row" style={{ gap: 10 }}>
        <span className="lrow-i" style={{ width: 34, height: 34, borderRadius: 8, fontSize: 19 }}><Icon name="boxing" /></span>
        <div className="grow"><div style={{ fontWeight: 600 }}>{t('{0} wants to compare with you', p.other.name)}</div>
          <div className="small dim">{p.other.username ? '@' + p.other.username + ' · ' : ''}{t('Only totals are shared, and either of you can stop any time.')}</div></div>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <Button variant="primary" onClick={() => act('/api/versus/respond', { id: p.id, accept: true }, () => { choose(p.id); toast(t('You are now comparing with {0}', p.other.name)) })}>{t('Accept')}</Button>
        <Button onClick={() => act('/api/versus/respond', { id: p.id, accept: false }, () => toast(t('Declined')))}>{t('Decline')}</Button>
      </div>
    </div>)}

    {active.length > 0 && <div className="chips" style={{ marginBottom: 12 }}>
      {active.map(p => <button key={p.id} className={'chip nocap' + (!adding && current?.id === p.id ? ' on' : '')} onClick={() => choose(p.id)}>{t('Me vs {0}', p.other.name)}</button>)}
      <button className={'chip nocap' + (adding ? ' on' : '')} onClick={() => setAdding(true)}>+ {t('Add')}</button>
    </div>}

    {(adding || !active.length) && <div className="card">
      <h2>{t('Compare with someone')}</h2>
      <AskForm onSent={() => setAdding(false)} />
      {outgoing.length > 0 && <div className="list" style={{ marginTop: 12 }}>{outgoing.map(p => <div key={p.id} className="item">
        <div className="grow"><div className="tt">{p.other.name}</div>
          <div className="ss">{p.status === 'declined' ? t('Declined on {0}', fmtDate(new Date(p.answered).toISOString().slice(0, 10), true)) : t('Waiting for an answer')}</div></div>
        {p.status === 'pending' && <button className="iconbtn" aria-label={t('Withdraw')} onClick={() => act('/api/versus/end', { id: p.id }, () => toast(t('Request withdrawn')))}><Icon name="xmark" /></button>}
      </div>)}</div>}
    </div>}

    {!adding && current && <Compare S={S} pair={current} />}
    {loaded && !active.length && !incoming.length && !outgoing.length && <div className="empty small">{t('Nobody to compare with yet. Ask a friend by their username above.')}</div>}
  </>
}
