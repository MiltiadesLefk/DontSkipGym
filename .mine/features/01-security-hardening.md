# 01 · Security hardening (health check, leaked-key guard, SETUP_CODE)

**Summary** Three small API hardening changes for a self-hosted instance.

**Behaviour**
- `GET /api/health` answers only `{ ok: true }` — it used to publish `users: <count>` to anyone.
- The API refuses to start if `DATA_DIR/secret` starts with `1ba7c4c5133` (a session key an early
  upstream commit published; anyone with it can forge a session). Prints FATAL and exits 1.
- `SETUP_CODE` env var: on an `INVITE_ONLY` instance with **zero users**, registering with this
  code (compared with `crypto.timingSafeEqual`) makes that first account admin. Dead once any
  user exists. Works for passkey register (`/api/register/options` + verify) and for password
  register (see feature 02).

**Where**
- `api/server.js`: `SETUP_CODE` const, `isSetupCode()`, the `SECRET.startsWith(...)` guard, the
  health route, the invite checks in `POST /api/register/options` and the register-verify route
  (`const setup = isSetupCode(c.code)`; `if (setup) user.admin = true`).
- `.env.example`: documents `SETUP_CODE`.

**Old commit** `44b2cf21a`

**Collision hotspots** upstream edits the register routes and invite logic often; re-apply the
three `isSetupCode` call-sites by searching for `INVITE_ONLY &&` in `api/server.js`.

**Verify** `cd api && npm test` (health test should expect no `users` field if upstream has one —
update it).
