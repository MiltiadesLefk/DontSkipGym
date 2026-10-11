# 02 · Username + password login — SUPERSEDED (2026-10-11)

> Upstream v1.4.x ships its own, more complete password sign-in (`PASSWORD_LOGIN=1` in `.env`:
> sign in by profile name or e-mail, set/change/remove in Settings, admin one-time reset codes,
> rate limiting). The private commit `4485bf1d4` was therefore **dropped**, not ported. Enable
> upstream's with `PASSWORD_LOGIN=1`. Consequence: there is no separate `username`; Versus (09) now
> asks for a person by profile name (`nameKey`). The text below describes the old private version
> for reference only.

# 02 · Username + password login (alongside passkeys)

**Summary** Sign up / sign in with a username and password as well as a passkey. Needed because
passkeys need HTTPS + exact RP_ID, and friends/other devices want a simple login. Versus (feature
09) depends on usernames existing.

**Behaviour**
- scrypt from `node:crypto` (no new dependency), stored as `user.pw = {alg,N,r,p,salt,hash}`; `user.username`
  is lowercase `[a-z0-9._-]{3,32}`; password 10–200 chars, tiny blocklist.
- Per-username brute-force brake (`loginBlocked`/`loginFailed`, 8 tries / 15 min with growing
  back-off, capped map); unknown usernames burn a dummy scrypt so timing is equal.
- Same invite rules as passkeys (incl. `SETUP_CODE`).
- Changing a password bumps `user.sv` → every other session ends. Admin can reset a password.
- All events audit-logged (`auth.password.set|change|fail`, `admin.user.password`).
- `publicUser(user)` is what every auth route now returns: `{id,name,admin,username,hasPassword,hasPasskey}`.

**Routes added (api/server.js)** `POST /api/login/password`, `POST /api/register/password`,
`POST /api/password` (set/change), `POST /api/admin/user/password`. Admin user list/detail also
return `username`, `hasPassword`. Helper block `/* passwords */` sits above `/* live presence */`.

**Frontend**
- `lib/api.js`: `passwordLogin`, `passwordRegister`, `setPassword`.
- `lib/audit.js`: labels + reasons for the new events.
- `views/Login.jsx`: `PasswordSignIn` form on top, passkey button beneath (only if `webauthnOK()`),
  `RegisterSheet` with a Passkey/Password `Segmented` switch; guest/“no passkey support” card removed
  because password sign-in always works.
- `views/Settings.jsx`: “Set/Change a password” row + `PasswordSheet`; subtitle shows `Signed in as {username}`.
- `views/Admin.jsx`: `ResetPassword` form in `UserDetail`.
- New i18n keys are used with `t()` but only exist as English fallbacks (add to locales if wanted):
  'Pick a username and a password', 'Username', 'Password', 'Create profile', 'Change password',
  'Set a password', 'Enter your username and password', etc.

**Old commit** `4485bf1d4`

**Collision hotspots** `Login.jsx` and `Settings.jsx` are touched by upstream constantly; the
`api/server.js` register/login routes too. Re-apply from the doc: server block is self-contained.

**Verify** manual: register with password, log out, log in, wrong password ×9 → 429; `cd api && npm test`.
