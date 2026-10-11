import { privateTabs } from './index.js'

// The private tabs that sit after the given built-in tab ('plan' | 'stats'). TabBar passes its
// own Tab, `on` and `nav`, so these look and behave like the built-in ones.
export default function PrivateTabs({ after, Tab, on, nav, user }) {
  return privateTabs.filter(x => x.after === after && (!x.visibleWhen || x.visibleWhen({ user }))).map(x => (
    <PrivateTab key={x.key} tab={x} Tab={Tab} active={on(x.key)} onClick={() => nav(x.path)} />
  ))
}

// Its own component so a tab's dot hook runs only while the tab is shown.
function PrivateTab({ tab, Tab, active, onClick }) {
  const dot = tab.useDot ? tab.useDot() : false
  return <Tab active={active} icon={tab.icon} label={tab.label()} dot={dot} dotLabel={tab.dotLabel?.()} onClick={onClick} />
}
