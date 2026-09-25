// QR rendering for the gym check-in cards (see views/CheckIn.jsx).
//
// We never store a photo of a membership card, only its decoded value (+ its symbology in
// `fmt`). The picture a turnstile scanner reads is regenerated from that value every time the
// card is shown, here.
//
// lean-qr (MIT, see NOTICE.md) is loaded with a dynamic import so its ~4kB only loads when a
// card is actually shown, on every platform — the PWA renders the same code as the app.
//
// Scope: QR codes through lean-qr, and the common 1D barcodes (Code 128/39, EAN-13/8, UPC-A/E,
// ITF, Codabar) through JsBarcode (MIT, see NOTICE.md), also dynamic-imported. Plenty of gyms
// print a plain barcode on the membership card, not a QR. The capture flow (lib/scan.js) refuses
// any symbology we cannot faithfully reproduce (PDF417, Data Matrix, Aztec, Code 93…), so a
// stored card is guaranteed renderable here — canRenderFmt() is the single source of that truth,
// shared by both sides.

let _leanqr = null

// Cached loader for lean-qr. Resolves once; every card after the first reuses the same module.
async function loadLeanQr() {
  if (!_leanqr) _leanqr = await import('lean-qr')
  return _leanqr
}

// Stored `fmt` (normalized) → the JsBarcode format that draws the same symbology. A code is only
// redrawn in its own symbology: a turnstile set up for EAN-13 need not read Code 128, so drawing
// the value as "some other barcode" would look scannable and fail at the gate.
const BARCODE_FORMATS = {
  code128: 'CODE128', code39: 'CODE39', ean13: 'EAN13', ean8: 'EAN8',
  upca: 'UPC', upce: 'UPCE', itf: 'ITF', itf14: 'ITF14', codabar: 'codabar'
}
// ITF of exactly 14 digits is the ITF-14 variant, which JsBarcode draws with its own rules.
export function barcodeFormatOf(fmt, value = '') {
  const f = normalizeFmt(fmt)
  if (f === 'itf' && /^\d{14}$/.test(String(value))) return 'ITF14'
  return BARCODE_FORMATS[f] || null
}
export const isQrFmt = fmt => normalizeFmt(fmt) === 'qrcode'

// The symbologies we can both read (mlkit, BarcodeDetector, jsQR/ZXing) AND redraw faithfully.
// A code we can't redraw faithfully is worse than not storing it — it would look scannable but
// carry the wrong bars.
export function canRenderFmt(fmt) {
  return isQrFmt(fmt) || !!BARCODE_FORMATS[normalizeFmt(fmt)]
}

let _jsbarcode = null
async function loadJsBarcode() {
  if (!_jsbarcode) _jsbarcode = (await import('jsbarcode')).default
  return _jsbarcode
}

// Draw a 1D barcode onto `canvas`, black on white with a quiet zone, no human-readable text (the
// card shows the value underneath already). Returns true on success; a value the symbology
// cannot encode (a bad EAN check digit, letters in an EAN) returns false rather than throwing.
export async function renderBarcodeToCanvas(canvas, value, fmt) {
  const format = barcodeFormatOf(fmt, value)
  if (!canvas || !value || !format) return false
  const JsBarcode = await loadJsBarcode()
  let valid = true
  JsBarcode(canvas, String(value), {
    format, displayValue: false, margin: 14, width: 2, height: 90,
    background: '#ffffff', lineColor: '#000000', valid: v => { valid = v }
  })
  return valid
}

// mlkit reports BarcodeFormat as e.g. 'QR_CODE' | 'QrCode'; older callers may pass 'qr'. Fold
// them all to a stable lower-case token we store and compare on.
export function normalizeFmt(fmt) {
  const s = String(fmt || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (s === 'qr' || s === 'qrcode') return 'qrcode'
  return s
}

// Draw `value` as a QR code onto `canvas` at 1 module per pixel; CSS scales it up with
// image-rendering: pixelated (see .qr-canvas in index.css) so it stays crisp at any size.
// `on`/`off` default to solid black on white — turnstile scanners want maximum contrast, not
// the app's theme colours, and a themed (e.g. lime-on-black) code fails to read on many
// readers. Returns the module count (QR size) so the caller can react if it wants.
export async function renderQrToCanvas(canvas, value, { on = '#000000', off = '#ffffff' } = {}) {
  if (!canvas || !value) return 0
  const { generate, correction } = await loadLeanQr()
  // Medium error correction: a good default that survives a scratched or partly-obscured phone
  // screen without inflating the code so much it gets dense on small screens.
  const code = generate(value, { minCorrectionLevel: correction.M })
  code.toCanvas(canvas, {
    on: hexToRgba(on),
    off: hexToRgba(off),
    padX: 2,
    padY: 2,
  })
  return code.size
}

// lean-qr wants colours as [r,g,b,a]. Accept a #rrggbb (or #rgb) string; anything else is
// treated as opaque black/white by the caller's defaults, so this only has to handle hex.
function hexToRgba(hex) {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}
