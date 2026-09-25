import { describe, it, expect, vi, afterEach } from 'vitest'

// brand.js is read once at import, so each case loads a fresh copy under its own env
const load = async name => {
  vi.resetModules()
  if (name) vi.stubEnv('VITE_APP_NAME', name)
  return import('./i18n-core.js')
}
afterEach(() => vi.unstubAllEnvs())

describe('rebranding', () => {
  it('leaves every string alone when no name is set', async () => {
    const { t } = await load()
    expect(t('Update to openGym v{0}', '1.3.8')).toBe('Update to openGym v1.3.8')
  })
  it('puts the configured name into the sentence', async () => {
    const { t } = await load('DontSkipGym')
    expect(t('Update to openGym v{0}', '1.3.8')).toBe('Update to DontSkipGym v1.3.8')
    expect(t('Reload openGym')).toBe('Reload DontSkipGym')
  })
  it('never touches what the user typed', async () => {
    const { t } = await load('DontSkipGym')
    expect(t('Hi {0}', 'openGym fan')).toBe('Hi openGym fan')
  })
})
