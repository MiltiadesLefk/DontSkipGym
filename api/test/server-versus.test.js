/* Versus end to end, real server.js in a child: ask by username, accept or decline, compare,
   end. And the part that matters most: nobody sees anyone's numbers without having agreed to. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const mint = uid => { const p = `${uid}:${Date.now() + 86400000}:0`; return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

const USERS = [
  { id: 'u_a', name: 'Anna', username: 'anna', created: 'x' },
  { id: 'u_b', name: 'Bob', username: 'bob', created: 'x' },
  { id: 'u_c', name: 'Cleo', username: 'cleo', created: 'x' },
  { id: 'u_off', name: 'Off', username: 'off', created: 'x', disabled: true }
];
const STATE = (w, bw) => ({ unit: 'kg', workouts: [{ id: 'w1', d: '2026-09-24', vol: 1000, entries: [{ id: '0025', sets: [{ w, r: 5, done: true }] }] }], bodyweight: [{ d: '2026-09-24', w: bw }], routines: [{ id: 'r', name: 'SECRET ROUTINE' }] });

async function start(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-versus-'));
  fs.writeFileSync(path.join(dir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users: USERS, creds: [], subs: [], invites: [] }));
  fs.writeFileSync(path.join(dir, 'state-u_a.json'), JSON.stringify(STATE(80, 60)));
  fs.writeFileSync(path.join(dir, 'state-u_b.json'), JSON.stringify(STATE(100, 90)));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' } });
  let log = ''; child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dir, { recursive: true, force: true }); });
  const api = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(api + '/api/health')).ok; } catch { /* */ } if (!up) await new Promise(r => setTimeout(r, 100)); }
  assert.ok(up, log);
  const call = async (uid, method, p, body) => {
    const r = await fetch(api + p, { method, headers: { Cookie: 'gymsid=' + mint(uid), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  return { get: (uid, p) => call(uid, 'GET', p), post: (uid, p, b) => call(uid, 'POST', p, b), dir };
}

test('request → accept → compare → end', async t => {
  const s = await start(t);
  // no pairing yet: nothing to compare
  assert.equal((await s.post('u_a', '/api/versus/request', { username: 'Bob ' })).status, 200);
  const inbox = (await s.get('u_b', '/api/versus')).body;
  assert.equal(inbox.incoming, 1);
  const req = inbox.pairs[0];
  assert.deepEqual([req.dir, req.status, req.other.name], ['in', 'pending', 'Anna']);
  assert.equal((await s.get('u_a', '/api/versus/compare?id=' + req.id)).status, 404, 'no numbers before an answer');
  assert.equal((await s.post('u_a', '/api/versus/respond', { id: req.id, accept: true })).status, 404, 'the asker cannot accept for the other');
  assert.equal((await s.post('u_c', '/api/versus/respond', { id: req.id, accept: true })).status, 404, 'nor can a third person');
  assert.equal((await s.post('u_b', '/api/versus/respond', { id: req.id, accept: true })).body.pair.status, 'active');

  const cmp = await s.get('u_a', `/api/versus/compare?id=${req.id}&today=2026-09-25`);
  assert.equal(cmp.status, 200);
  assert.equal(cmp.body.them.name, 'Bob');
  assert.equal(cmp.body.them.bodyweight.kg, 90);
  assert.deepEqual(cmp.body.bests.map(b => [b.id, b.you.w, b.them.w]), [['0025', 80, 100]]);
  assert.ok(!JSON.stringify(cmp.body).includes('SECRET ROUTINE'), 'no raw state crosses over');
  assert.equal((await s.get('u_c', '/api/versus/compare?id=' + req.id)).status, 404, 'an outsider sees nothing');

  // Bob stops sharing his body weight; Anna's view loses it, the rest stays
  await s.post('u_b', '/api/versus/share', { id: req.id, bodyweight: false });
  assert.equal((await s.get('u_a', `/api/versus/compare?id=${req.id}&today=2026-09-25`)).body.them.bodyweight, null);

  // either side can end it, and then it is gone for both
  assert.equal((await s.post('u_b', '/api/versus/end', { id: req.id })).status, 200);
  assert.equal((await s.get('u_a', '/api/versus/compare?id=' + req.id)).status, 404);
  assert.deepEqual((await s.get('u_a', '/api/versus')).body.pairs, []);
});

test('decline, cooldown, and the guard rails', async t => {
  const s = await start(t);
  assert.equal((await s.post('u_a', '/api/versus/request', { username: 'anna' })).status, 400, 'not yourself');
  assert.equal((await s.post('u_a', '/api/versus/request', { username: 'nobody' })).status, 404);
  assert.equal((await s.post('u_a', '/api/versus/request', { username: 'off' })).status, 404, 'disabled accounts cannot be asked');
  const id = (await s.post('u_a', '/api/versus/request', { username: 'bob' })).body.pair.id;
  assert.equal((await s.post('u_a', '/api/versus/request', { username: 'bob' })).status, 409, 'no duplicate requests');
  assert.equal((await s.post('u_b', '/api/versus/request', { username: 'anna' })).status, 409, 'answer the one you got instead');
  assert.equal((await s.post('u_b', '/api/versus/respond', { id, accept: false })).body.pair.status, 'declined');
  const mine = (await s.get('u_a', '/api/versus')).body.pairs;
  assert.deepEqual(mine.map(p => p.status), ['declined'], 'the asker sees the decline');
  assert.deepEqual((await s.get('u_b', '/api/versus')).body.pairs, [], 'the one who declined does not');
  assert.equal((await s.post('u_a', '/api/versus/request', { username: 'bob' })).status, 429, 'no asking again straight away');
  // a withdrawn request is simply gone
  const id2 = (await s.post('u_a', '/api/versus/request', { username: 'cleo' })).body.pair.id;
  assert.equal((await s.post('u_a', '/api/versus/end', { id: id2 })).status, 200);
  assert.equal((await s.get('u_c', '/api/versus')).body.incoming, 0);
  // every step is recorded for the admin
  const log = fs.readFileSync(path.join(s.dir, 'audit.log'), 'utf8');
  for (const ev of ['auth.versus.request', 'auth.versus.decline', 'auth.versus.end']) assert.ok(log.includes(ev), ev);
});
