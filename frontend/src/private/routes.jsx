// The private features' routes: each folder's `routes.jsx` default-exports an array of <Route>
// elements. App.jsx renders `{privateRoutes}` inside <Routes>.
const mods = import.meta.glob('./*/routes.jsx', { eager: true })
export const privateRoutes = Object.values(mods).flatMap(m => m.default || [])
