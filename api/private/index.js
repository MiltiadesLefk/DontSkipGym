// Registry for private (fork-only) features. Every `*-routes.js` file in this folder is a
// feature: it default-exports `feature(ctx)` returning { routes?, onUserDeleted? }. Adding a
// feature means adding a file here; server.js never changes. `ctx` is built once by server.js.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function loadPrivate(ctx) {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-routes.js')).sort();
  const routes = {}, deleted = [];
  for (const f of files) {
    const feature = (await import('./' + f)).default(ctx);
    Object.assign(routes, feature.routes);
    if (feature.onUserDeleted) deleted.push(feature.onUserDeleted);
  }
  return { routes, onUserDeleted: uid => deleted.forEach(fn => fn(uid)) };
}
