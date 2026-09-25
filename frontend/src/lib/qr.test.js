import { describe, it, expect } from 'vitest'
import { normalizeFmt, canRenderFmt, barcodeFormatOf } from './qr.js'

// The QR helpers decide which scanned/typed codes the check-in feature will store: it can read
// many symbologies but only redraw QR, so canRenderFmt is the gate, and normalizeFmt is what
// folds every spelling mlkit might report into the single token everything else compares on.

describe('normalizeFmt', () => {
  it('folds every QR spelling to "qrcode"', () => {
    // mlkit's BarcodeFormat, the enum-ish casings, and the casual 'qr' all mean the same thing.
    expect(normalizeFmt('QR_CODE')).toBe('qrcode')
    expect(normalizeFmt('QrCode')).toBe('qrcode')
    expect(normalizeFmt('qrcode')).toBe('qrcode')
    expect(normalizeFmt('qr')).toBe('qrcode')
    expect(normalizeFmt('QR')).toBe('qrcode')
  })

  it('lower-cases and strips separators for other formats', () => {
    expect(normalizeFmt('EAN_13')).toBe('ean13')
    expect(normalizeFmt('Code128')).toBe('code128')
    expect(normalizeFmt('CODE_128')).toBe('code128')
  })

  it('treats empty / nullish as an empty token rather than throwing', () => {
    expect(normalizeFmt('')).toBe('')
    expect(normalizeFmt(null)).toBe('')
    expect(normalizeFmt(undefined)).toBe('')
  })
})

describe('canRenderFmt', () => {
  it('accepts only QR, in any spelling', () => {
    expect(canRenderFmt('QR_CODE')).toBe(true)
    expect(canRenderFmt('QrCode')).toBe(true)
    expect(canRenderFmt('qr')).toBe(true)
  })

  it('accepts the common 1D barcodes, whatever spelling the scanner used', () => {
    for (const fmt of ['EAN_13', 'ean_8', 'CODE_128', 'code128', 'CODE_39', 'ITF', 'UPC_A', 'upc_e', 'CODABAR']) {
      expect(canRenderFmt(fmt)).toBe(true)
    }
  })

  it('rejects the symbologies we cannot faithfully redraw', () => {
    // Readable by the scanners but not reproducible here, so a card in one of these formats must
    // never be stored — it would display as the wrong bars at the turnstile.
    for (const fmt of ['PDF_417', 'AZTEC', 'DATA_MATRIX', 'CODE_93', 'MAXICODE']) {
      expect(canRenderFmt(fmt)).toBe(false)
    }
  })

  it('rejects empty / unknown formats', () => {
    expect(canRenderFmt('')).toBe(false)
    expect(canRenderFmt(null)).toBe(false)
    expect(canRenderFmt('something-else')).toBe(false)
  })
})

describe('barcodeFormatOf', () => {
  it('draws each code in its own symbology, never a substitute', () => {
    expect(barcodeFormatOf('CODE_128')).toBe('CODE128')
    expect(barcodeFormatOf('ean_13')).toBe('EAN13')
    expect(barcodeFormatOf('UPC_A')).toBe('UPC')
    expect(barcodeFormatOf('codabar')).toBe('codabar')
    expect(barcodeFormatOf('QR_CODE')).toBe(null)
    expect(barcodeFormatOf('PDF_417')).toBe(null)
  })
  it('treats a 14-digit ITF as ITF-14', () => {
    expect(barcodeFormatOf('ITF', '12345678901231')).toBe('ITF14')
    expect(barcodeFormatOf('ITF', '123456')).toBe('ITF')
  })
})
