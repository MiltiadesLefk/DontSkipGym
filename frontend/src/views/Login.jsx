import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, passwordLogin, passwordRegister, BIO } from '../lib/api.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import { askAddDeviceData } from '../sheets.jsx'
import { APP_NAME } from '../lib/brand.js'

const toast = msg => useUI.getState().toast(msg)
// A cancelled passkey prompt is the user changing their mind, not an error worth a toast
const cancelled = e => e.name === 'NotAllowedError' || e.name === 'AbortError'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState, loadConfig } = useStore()
  const config = useStore(s => s.config)
  const [method, setMethod] = useState(webauthnOK() ? 'passkey' : 'password')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const inviteOnly = !!config?.invite_only
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  // Boot already fetched this; retry here only if that attempt failed, so the invite field still
  // appears on an instance whose config arrived late rather than never.
  useEffect(() => { loadConfig() }, [loadConfig])
  const go = async e => {
    e?.preventDefault()
    const n = name.trim()
    if (!n) { toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { toast(t('An invite code is required')); return }
    if (method === 'password' && (!username.trim() || !password)) { toast(t('Pick a username and a password')); return }
    try {
      const u = method === 'password'
        ? await passwordRegister(n, username.trim(), password, code.trim())
        : await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (!cancelled(e)) toast(e.message || t('Registration failed')) }
  }
  return <>
    <h3>{t('Create your profile')}</h3>
    {webauthnOK() && <>
      <Segmented value={method} onChange={setMethod}
        options={[{ value: 'passkey', label: t('Passkey') }, { value: 'password', label: t('Password') }]} />
      <div style={{ height: 12 }} />
    </>}
    <div className="muted small" style={{ marginBottom: 14 }}>
      {method === 'passkey'
        ? t('Pick a name, then confirm with {0}. The passkey is saved in your device — no password needed.', BIO)
        : t('Pick a name, a username to sign in with, and a password of at least 10 characters.')}
    </div>
    <form onSubmit={go}>
      <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      {method === 'password' && <>
        <div style={{ height: 10 }} />
        <input className="input" placeholder={t('Username')} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false}
          value={username} onChange={e => setUsername(e.target.value.toLowerCase())} />
        <div style={{ height: 10 }} />
        <input className="input" type="password" placeholder={t('Password')} maxLength={200} autoComplete="new-password"
          value={password} onChange={e => setPassword(e.target.value)} />
      </>}
      {inviteOnly && <>
        <div style={{ height: 10 }} />
        <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
          onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
        <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
      </>}
      <div style={{ height: 12 }} />
      <Button variant="primary" type="submit">{method === 'password' ? t('Create profile') : t('Create passkey')}</Button>
    </form>
  </>
}

// Username + password, for devices without passkeys and for accounts that never made one
function PasswordSignIn() {
  const { setUser, adoptProfile } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async e => {
    e.preventDefault()
    if (!username.trim() || !password) { toast(t('Enter your username and password')); return }
    setBusy(true)
    try { const u = await passwordLogin(username.trim(), password); setUser(u); await adoptProfile(askAddDeviceData); toast(t('Welcome back, {0}', u.name)) }
    catch (err) { toast(err.message || t('Sign-in failed')) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={go} style={{ textAlign: 'left' }}>
      <input className="input" placeholder={t('Username')} autoComplete="username" autoCapitalize="none" spellCheck={false}
        value={username} onChange={e => setUsername(e.target.value.toLowerCase())} />
      <div style={{ height: 10 }} />
      <input className="input" type="password" placeholder={t('Password')} autoComplete="current-password"
        value={password} onChange={e => setPassword(e.target.value)} />
      <div style={{ height: 12 }} />
      <Button variant="primary" icon="person" type="submit" disabled={busy}>{t('Sign in')}</Button>
    </form>
  )
}

export default function Login() {
  const { setUser, adoptProfile, setGuest } = useStore()
  const config = useStore(s => s.config)
  const canGuest = guestAllowed(config)
  const signIn = async () => {
    try { const u = await passkeyLogin(); setUser(u); await adoptProfile(askAddDeviceData); toast(t('Welcome back, {0}', u.name)) }
    catch (e) { if (!cancelled(e)) toast(e.message || t('Sign-in failed')) }
  }
  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>{APP_NAME}</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
      <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="card small muted" style={{ textAlign: 'left', marginTop: 16 }}>
        {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Passkey sign-in and sync across your devices come with the openGym server, which you get by self-hosting it.')}
      </div>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 28 }}>{t('Your workouts. Your weights. Your profile.')}</div>
      <PasswordSignIn />
      <div style={{ height: 10 }} />
      {webauthnOK() && <>
        <Button icon="lock" onClick={signIn}>{t('Sign in with passkey')}</Button>
        <div style={{ height: 10 }} />
      </>}
      <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Create new profile')}</Button>
      {canGuest && <div style={{ height: 10 }} />}
      {canGuest && <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>}
      <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>{t('Sign in with a password, or with a passkey ({0}).', BIO)}<br />{t('Each profile keeps its own plan, workouts & body weight.')}</div>
    </div>
  )
}
