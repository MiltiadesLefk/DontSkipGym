// Private feature: Versus (two consenting profiles side by side). Everything lives here so
// server.js carries no Versus code; see private/index.js for how this file is picked up.
import { summarize, commonBests } from './versus.js';

export default function versusFeature(ctx) {
  const { db, crypto, json, text, readBody, readSession, readState, nameKey, audit, saveDb } = ctx;

  // Versus pairings: { id, from, to, status: 'pending'|'active'|'declined', created, answered?, hideBw? }
  db.versus = Array.isArray(db.versus) ? db.versus : [];

  // Versus limits: open requests per person, partners per person, and how long after a decline
  // the same person cannot be asked again.
  const VERSUS_MAX_PENDING = 5, VERSUS_MAX_ACTIVE = 20, VERSUS_COOLDOWN = 7 * 86400000;
  // A pairing counts only while both accounts exist and neither is disabled.
  const versusLive = v => [v.from, v.to].every(id => { const u = db.users.find(x => x.id === id); return u && !u.disabled; });
  function versusView(v, me) {
    const other = db.users.find(u => u.id === (v.from === me ? v.to : v.from));
    return {
      id: v.id, status: v.status, dir: v.from === me ? 'out' : 'in', created: v.created, answered: v.answered || null,
      other: other ? { id: other.id, name: other.name } : null,
      shareBw: !(v.hideBw || {})[me]
    };
  }

  const routes = {
    /* ---------- Versus: two people side by side, by mutual consent ----------
       One asks by username, the other accepts or declines; either can end it. While a pairing is
       active each side may read the other's AGGREGATES (versus.js) and nothing else. */
    'GET /api/versus': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const now = Date.now();
      const pairs = db.versus.filter(v => (v.from === user.id || v.to === user.id) && versusLive(v))
        // A decline is shown to the one who asked, for as long as they cannot ask again
        .filter(v => v.status !== 'declined' || (v.from === user.id && now - (v.answered || 0) < VERSUS_COOLDOWN))
        .map(v => versusView(v, user.id));
      json(res, 200, { pairs, incoming: pairs.filter(p => p.status === 'pending' && p.dir === 'in').length });
    },

    'POST /api/versus/request': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const body = await readBody(req);
      // Asked for by the name they sign in with (their profile name, folded like the password
      // sign-in does); two profiles sharing a name cannot be told apart, so that is refused.
      const key = nameKey(text(body.name ?? body.username).slice(0, 80));
      const named = key ? db.users.filter(u => !u.disabled && nameKey(u.name) === key) : [];
      if (named.length > 1) return json(res, 409, { error: 'more than one profile has that name' });
      const other = named[0];
      if (!other) return json(res, 404, { error: 'no one with that name' });
      if (other.id === user.id) return json(res, 400, { error: 'that is you' });
      const between = db.versus.filter(v => (v.from === user.id && v.to === other.id) || (v.from === other.id && v.to === user.id));
      if (between.some(v => v.status === 'active')) return json(res, 409, { error: 'you are already comparing with them' });
      if (between.some(v => v.status === 'pending' && v.from === other.id)) return json(res, 409, { error: 'they already asked you — accept it on this screen' });
      if (between.some(v => v.status === 'pending')) return json(res, 409, { error: 'request already sent' });
      const declined = between.find(v => v.status === 'declined' && v.from === user.id && Date.now() - (v.answered || 0) < VERSUS_COOLDOWN);
      if (declined) return json(res, 429, { error: 'they declined recently — you can ask again after ' + new Date(declined.answered + VERSUS_COOLDOWN).toISOString().slice(0, 10) });
      if (db.versus.filter(v => v.from === user.id && v.status === 'pending').length >= VERSUS_MAX_PENDING)
        return json(res, 429, { error: `at most ${VERSUS_MAX_PENDING} open requests at a time` });
      if (db.versus.filter(v => v.status === 'active' && (v.from === user.id || v.to === user.id)).length >= VERSUS_MAX_ACTIVE)
        return json(res, 429, { error: `at most ${VERSUS_MAX_ACTIVE} people at a time` });
      // An old decline between the two is replaced, not stacked
      db.versus = db.versus.filter(v => !between.includes(v));
      const v = { id: crypto.randomBytes(9).toString('base64url'), from: user.id, to: other.id, status: 'pending', created: Date.now() };
      db.versus.push(v);
      saveDb();
      audit(req, 'auth.versus.request', { user, target: other });
      json(res, 200, { pair: versusView(v, user.id) });
    },

    'POST /api/versus/respond': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const body = await readBody(req);
      const v = db.versus.find(x => x.id === text(body.id) && x.to === user.id && x.status === 'pending' && versusLive(x));
      if (!v) return json(res, 404, { error: 'no such request' });
      v.status = body.accept === true ? 'active' : 'declined';
      v.answered = Date.now();
      saveDb();
      const asker = db.users.find(u => u.id === v.from);
      if (v.status === 'active') audit(req, 'auth.versus.accept', { user, target: asker });
      else audit(req, 'auth.versus.decline', { user, target: asker });
      json(res, 200, { pair: versusView(v, user.id) });
    },

    // Ends an active pairing, or withdraws a request not yet answered. Either person may.
    'POST /api/versus/end': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const body = await readBody(req);
      const v = db.versus.find(x => x.id === text(body.id) && (x.from === user.id || x.to === user.id));
      if (!v) return json(res, 404, { error: 'no such pairing' });
      db.versus = db.versus.filter(x => x !== v);
      saveDb();
      audit(req, 'auth.versus.end', { user, target: db.users.find(u => u.id === (v.from === user.id ? v.to : v.from)) });
      json(res, 200, { ok: true });
    },

    // Whether the other person sees your body weight in this pairing (the most personal number)
    'POST /api/versus/share': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const body = await readBody(req);
      const v = db.versus.find(x => x.id === text(body.id) && x.status === 'active' && (x.from === user.id || x.to === user.id));
      if (!v) return json(res, 404, { error: 'no such pairing' });
      v.hideBw = { ...(v.hideBw || {}), [user.id]: body.bodyweight === false };
      saveDb();
      json(res, 200, { pair: versusView(v, user.id) });
    },

    'GET /api/versus/compare': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const q = new URL(req.url, 'http://x').searchParams;
      const v = db.versus.find(x => x.id === q.get('id') && x.status === 'active' && (x.from === user.id || x.to === user.id) && versusLive(x));
      if (!v) return json(res, 404, { error: 'no such pairing' });
      const other = db.users.find(u => u.id === (v.from === user.id ? v.to : v.from));
      const today = /^\d{4}-\d{2}-\d{2}$/.test(q.get('today') || '') ? q.get('today') : new Date().toISOString().slice(0, 10);
      const month = /^\d{4}-\d{2}$/.test(q.get('month') || '') ? q.get('month') : undefined;
      const mine = readState(user.id) || {}, theirs = readState(other.id) || {};
      json(res, 200, {
        pair: versusView(v, user.id),
        you: { name: user.name, ...summarize(mine, { today, month, shareBodyweight: true }) },
        them: { name: other.name, ...summarize(theirs, { today, month, shareBodyweight: !(v.hideBw || {})[other.id] }) },
        bests: commonBests(mine, theirs)
      });
    },
  };

  return {
    routes,
    onUserDeleted: uid => { db.versus = db.versus.filter(v => v.from !== uid && v.to !== uid); }
  };
}
