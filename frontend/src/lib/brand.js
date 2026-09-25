// The name the app calls itself. A build can rebrand it (VITE_APP_NAME=MyGym npm run build, or
// APP_NAME in .env for the Docker build) without touching a single string: t() swaps it into
// every translated sentence, and the few places that print the name outside t() read it here.
// Everything that is an identifier rather than a name — file formats, storage keys, URLs of the
// upstream project — stays as it is, so a rebranded build still reads openGym files and backups.
export const APP_NAME = (import.meta.env && import.meta.env.VITE_APP_NAME) || 'openGym'
export const REBRANDED = APP_NAME !== 'openGym'
