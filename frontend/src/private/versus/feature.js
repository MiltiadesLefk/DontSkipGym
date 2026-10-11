import { useEffect } from 'react'
import { t } from '../../lib/i18n.js'
import { useVersus, refreshVersus } from './versus.js'
import './versus.css'

// The dot on the Versus tab: asked on load, whenever the app comes back into view, and every minute
function useVersusDot() {
  const incoming = useVersus(s => s.incoming)
  useEffect(() => {
    refreshVersus()
    const onVis = () => { if (document.visibilityState === 'visible') refreshVersus() }
    document.addEventListener('visibilitychange', onVis)
    const tm = setInterval(onVis, 60000)
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(tm) }
  }, [])
  return incoming > 0
}

export default {
  id: 'versus',
  tabs: [{
    key: 'versus', path: '/versus', icon: 'boxing', label: () => t('Versus'), after: 'stats',
    visibleWhen: ({ user }) => !!user, useDot: useVersusDot, dotLabel: () => t('new request'),
  }],
  auditLabels: {
    'auth.versus.request': 'Asked to compare on Versus',
    'auth.versus.accept': 'Accepted a Versus request',
    'auth.versus.decline': 'Declined a Versus request',
    'auth.versus.end': 'Ended a Versus pairing',
  },
}
