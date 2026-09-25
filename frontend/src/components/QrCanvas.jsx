import { useEffect, useRef, useState } from 'react'
import { renderQrToCanvas, renderBarcodeToCanvas, isQrFmt } from '../lib/qr.js'

// Renders a gym check-in code as a QR image on a <canvas>. lean-qr draws one module per pixel;
// CSS (.qr-canvas) scales it up with image-rendering: pixelated so it stays razor-sharp at any
// display size without re-generating. Regenerated from `value` on every change — we never store
// the picture (see lib/qr.js).
//
// The lib loads via dynamic import, so the first paint is a frame behind; a plain box holds the
// space until then. A render failure (empty value, lib load error) shows nothing rather than a
// broken canvas — the caller decides what an unusable card looks like.
// `fmt` picks the symbology: a QR (the default, and every card saved before barcodes existed)
// is drawn square at `size`; a 1D barcode keeps its own aspect, `size` wide.
export default function QrCanvas({ value, fmt, size = 240, className = '' }) {
  const ref = useRef(null)
  const [ok, setOk] = useState(false)
  const qr = !fmt || isQrFmt(fmt)

  useEffect(() => {
    let alive = true
    setOk(false)
    const draw = qr ? renderQrToCanvas(ref.current, value).then(mods => mods > 0) : renderBarcodeToCanvas(ref.current, value, fmt)
    draw
      .then(done => { if (alive) setOk(!!done) })
      .catch(() => { if (alive) setOk(false) })
    return () => { alive = false }
  }, [value, fmt, qr])

  return (
    <canvas
      ref={ref}
      className={'qr-canvas ' + className}
      style={qr ? { width: size, height: size, opacity: ok ? 1 : 0 } : { width: size, height: 'auto', maxWidth: '100%', opacity: ok ? 1 : 0 }}
      aria-label={qr ? 'QR code' : 'Barcode'}
    />
  )
}
