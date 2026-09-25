import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { useEffect } from 'react'
import { useVersus, refreshVersus } from '../lib/versus.js'
import '../versus.css'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const versusIn = useVersus(s => s.incoming)
  // The dot on Versus: asked on load, whenever the app comes back into view, and every minute
  useEffect(() => {
    if (!user) return
    refreshVersus()
    const onVis = () => { if (document.visibilityState === 'visible') refreshVersus() }
    document.addEventListener('visibilitychange', onVis)
    const tm = setInterval(onVis, 60000)
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(tm) }
  }, [user])
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home') || (cur === 'muscles' && k === 'library')

  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/workout')
  }
  const Tab = ({ k, icon, to, label, dot }) => (
    <button className={on(k) ? 'on' : ''} onClick={() => nav(to)} aria-label={dot ? label + ' — ' + t('new request') : undefined}>
      <span className="tab-ic"><Icon name={icon} />{dot && <span className="tab-dot" />}</span><span>{label}</span>
    </button>
  )

  return (
    <nav id="tabbar">
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
      <Tab k="cheat" icon="pizza" to="/cheat" label={t('Cheat')} />
      {/* On the workout screen itself there is nothing to resume, so the button reads as the
          tab it is and stays lit (#29); anywhere else it brings you back to the exercise you
          were on — the marker is kept in S.active.cur and never moves on its own (#21). */}
      <button className={'start' + (S.active ? ' rec' : '') + (S.active && cur === 'workout' ? ' on' : '')} onClick={startWorkout}>
        <span className="cir"><Icon name={S.active ? (cur === 'workout' ? 'dumbbell' : 'play') : 'dumbbell'} /></span>
        <span>{S.active ? (cur === 'workout' ? t('Workout') : t('Resume')) : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      {user && <Tab k="versus" icon="boxing" to="/versus" label={t('Versus')} dot={versusIn > 0} />}
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
    </nav>
  )
}
