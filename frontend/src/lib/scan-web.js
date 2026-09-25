// Browser-side QR decoding for the gym check-in — the PWA half of lib/scan.js. The app build
// hands scanning to ML Kit; here in a browser tab (installed PWA on a phone, most often) we do
// it ourselves: draw the source — an uploaded photo or a live <video> frame — onto an offscreen
// canvas and decode the pixels.
//
// Three decoders, tried in order:
//   1. BarcodeDetector — the browser's own (Chrome/Edge on Android, Samsung Internet). Native
//      speed and quality when it exists; asked for every format it supports, since plenty of gym
//      cards carry a 1D barcode rather than a QR.
//   2. jsQR (Apache-2.0, see NOTICE.md) — pure JS QR decoding, works everywhere including iOS
//      Safari, which has no BarcodeDetector.
//   3. ZXing (@zxing/library, Apache-2.0, see NOTICE.md) — pure JS, for everything jsQR cannot
//      read: Code 128/39, EAN, UPC, ITF, Codabar. Tried only after jsQR came back empty.
// Both JS decoders load with a dynamic import, so they only ship when someone scans.
//
// decodeImageData is the pure core (pixels in, string out) and is what the unit test exercises;
// decodeSource wraps it with the canvas plumbing the browser paths need.
import { normalizeFmt } from './qr.js'

let _jsqr = null
async function loadJsQr() {
  if (!_jsqr) _jsqr = (await import('jsqr')).default
  return _jsqr
}

let _zxing = null
async function loadZxing() {
  if (!_zxing) {
    const Z = await import('@zxing/library')
    const hints = new Map([
      [Z.DecodeHintType.POSSIBLE_FORMATS, [
        Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8,
        Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODABAR,
        Z.BarcodeFormat.QR_CODE
      ]],
      [Z.DecodeHintType.TRY_HARDER, true]
    ])
    const reader = new Z.MultiFormatReader()
    reader.setHints(hints)
    _zxing = { Z, reader }
  }
  return _zxing
}

// Pixels → { value, fmt } | null with ZXing. It wants luminance, so RGBA is folded to grey first.
async function decodeWithZxing(img) {
  const { Z, reader } = await loadZxing()
  const px = img.data, n = img.width * img.height
  const grey = new Uint8ClampedArray(n)
  for (let i = 0, j = 0; i < n; i++, j += 4) grey[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000
  try {
    const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(grey, img.width, img.height)))
    const hit = reader.decodeWithState(bmp)
    const value = hit && hit.getText()
    return value ? { value, fmt: normalizeFmt(Z.BarcodeFormat[hit.getBarcodeFormat()]) } : null
  } catch (e) {
    return null          // NotFoundException and friends: nothing readable in these pixels
  } finally { reader.reset() }
}

// The browser's own detector, asked for every format it knows. getSupportedFormats is async, so
// the first call resolves it once; `false` means "no native detector here".
let _detector = null
async function nativeDetector() {
  if (_detector !== null) return _detector
  try {
    if (typeof BarcodeDetector !== 'function') return (_detector = false)
    const formats = typeof BarcodeDetector.getSupportedFormats === 'function' ? await BarcodeDetector.getSupportedFormats() : ['qr_code']
    _detector = formats && formats.length ? new BarcodeDetector({ formats }) : false
  } catch (e) { _detector = false }
  return _detector
}

// { data, width, height } (an ImageData or anything shaped like one) → { value, fmt } | null.
// jsQR first, then ZXing for barcodes; the native detector wants a drawable, not raw pixels, so
// it lives in decodeSource.
export async function decodeImageData(img) {
  if (!img || !img.data || !img.width || !img.height) return null
  const jsQR = await loadJsQr()
  const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
  if (hit && hit.data) return { value: hit.data, fmt: 'qrcode' }
  return decodeWithZxing(img)
}

// Decode from anything drawImage accepts: <video>, <img>, ImageBitmap, canvas. The source is
// scaled down to at most MAX px on its long edge — plenty for a QR, and it keeps jsQR fast enough
// to run on every few video frames on a phone. Reuses one canvas across calls.
const MAX = 800
let _canvas = null
export async function decodeSource(source, max = MAX) {
  const sw = source.videoWidth || source.naturalWidth || source.width || 0
  const sh = source.videoHeight || source.naturalHeight || source.height || 0
  if (!sw || !sh) return null
  const k = Math.min(1, max / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k))
  if (!_canvas) _canvas = document.createElement('canvas')
  _canvas.width = w; _canvas.height = h
  const ctx = _canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)

  const det = await nativeDetector()
  if (det) {
    try {
      const found = await det.detect(_canvas)
      const b = found && found.find(x => x.rawValue)
      if (b) return { value: b.rawValue, fmt: normalizeFmt(b.format) || 'qrcode' }
    } catch (e) { /* fall through to jsQR */ }
  }
  return decodeImageData(ctx.getImageData(0, 0, w, h))
}

// A picked File → { value, fmt } | null. createImageBitmap honours EXIF orientation where the
// browser supports it, which matters for photos of a card taken in portrait.
export async function importCodeFromImageWeb(file) {
  if (!file) return null
  let bmp
  if (typeof createImageBitmap === 'function') {
    bmp = await createImageBitmap(file)
  } else {
    bmp = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('bad image'))
      img.src = URL.createObjectURL(file)
    })
  }
  // A barcode's bars are thin: in a full-size photo of a whole card, 800 px can blur them
  // together, so a photo that reads as nothing gets one more look at twice the resolution.
  try { return (await decodeSource(bmp)) || (await decodeSource(bmp, MAX * 2)) } finally { if (bmp.close) bmp.close() }
}
