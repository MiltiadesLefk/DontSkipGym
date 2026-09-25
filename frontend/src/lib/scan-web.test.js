import { describe, it, expect } from 'vitest'
import { generate } from 'lean-qr'
import JsBarcode from 'jsbarcode'
import { decodeImageData } from './scan-web.js'

// Round trip through the two libraries the browser path relies on: lean-qr draws a code (the
// same renderer the card view uses), jsQR reads it back. Pixels are built by hand from
// code.get(x, y) — no canvas in this environment — scaled 4× with a 4-module quiet zone, which
// is what a phone camera would roughly see.
function rasterize(code, scale = 4, quiet = 4) {
  const n = code.size + quiet * 2
  const w = n * scale
  const data = new Uint8ClampedArray(w * w * 4)
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const mx = Math.floor(x / scale) - quiet, my = Math.floor(y / scale) - quiet
      const dark = mx >= 0 && my >= 0 && mx < code.size && my < code.size && code.get(mx, my)
      const v = dark ? 0 : 255
      const i = (y * w + x) * 4
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255
    }
  }
  return { data, width: w, height: w }
}

describe('decodeImageData', () => {
  it('reads back a code lean-qr generated', async () => {
    const value = 'MEMBER-0042-FITZONE'
    const hit = await decodeImageData(rasterize(generate(value)))
    expect(hit).toEqual({ value, fmt: 'qrcode' })
  })

  it('reads a URL-shaped code, the other common gym format', async () => {
    const value = 'https://checkin.example.com/m/8f3a1c?v=2'
    const hit = await decodeImageData(rasterize(generate(value)))
    expect(hit?.value).toBe(value)
  })

  it('returns null for blank pixels and for junk input', async () => {
    const blank = { data: new Uint8ClampedArray(64 * 64 * 4).fill(255), width: 64, height: 64 }
    expect(await decodeImageData(blank)).toBeNull()
    expect(await decodeImageData(null)).toBeNull()
    expect(await decodeImageData({ data: null, width: 1, height: 1 })).toBeNull()
  })
})

// The barcode half of the round trip: JsBarcode (the renderer the card view uses for 1D codes)
// encodes, its bar pattern is painted into pixels by hand — no canvas here either — and the
// decoder has to read the same value back and name the same symbology.
function barcodePixels(value, format, module = 3, height = 60, quiet = 12) {
  const out = {}
  JsBarcode(out, value, { format })
  const bits = out.encodings.map(e => e.data).join('')
  const w = (bits.length + quiet * 2) * module
  const data = new Uint8ClampedArray(w * height * 4).fill(255)
  for (let y = 0; y < height; y++) {
    for (let b = 0; b < bits.length; b++) {
      if (bits[b] !== '1') continue
      for (let k = 0; k < module; k++) {
        const i = (y * w + (quiet + b) * module + k) * 4
        data[i] = data[i + 1] = data[i + 2] = 0
      }
    }
  }
  return { data, width: w, height }
}

describe('decodeImageData: barcodes', () => {
  it('reads a Code 128 membership number', async () => {
    expect(await decodeImageData(barcodePixels('GYM-004211', 'CODE128'))).toEqual({ value: 'GYM-004211', fmt: 'code128' })
  })
  it('reads an EAN-13 and a Code 39', async () => {
    expect(await decodeImageData(barcodePixels('4006381333931', 'EAN13'))).toEqual({ value: '4006381333931', fmt: 'ean13' })
    expect(await decodeImageData(barcodePixels('MEMBER42', 'CODE39'))).toEqual({ value: 'MEMBER42', fmt: 'code39' })
  })
})
