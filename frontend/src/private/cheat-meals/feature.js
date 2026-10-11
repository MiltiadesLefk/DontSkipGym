import { t } from '../../lib/i18n.js'
import icons from './icons.jsx'

export default {
  id: 'cheat-meals',
  tabs: [{ key: 'cheat', path: '/cheat', icon: 'pizza', label: () => t('Cheat'), after: 'plan' }],
  syncLists: [{ field: 'cheatMeals', key: x => x?.id, time: x => Number(x?._ts) || Number(x?.t) || 0 }],
  icons,
}
