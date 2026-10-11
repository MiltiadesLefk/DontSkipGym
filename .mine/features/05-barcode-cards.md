# 05 · Gym check-in: 1D barcode cards

**Summary** Membership cards with Code 128/39, EAN, UPC, ITF or Codabar barcodes (not only QR) can
be imported (photo / camera scanner) and are redrawn in their real symbology.

**Behaviour** Reading: `BarcodeDetector` (all formats the browser supports) → jsQR → ZXing. Card
keeps its real format. Drawing: JsBarcode. Both libraries (`@zxing/library`, `jsbarcode`) load on
demand only. Formats that can't be redrawn faithfully are still refused.

**Where**
- `frontend/package.json` (+ lock): deps `@zxing/library ^0.23.0`, `jsbarcode ^3.12.3`
  (**breaks the “React + Router + Zustand only” rule upstream insists on — never PR this**).
- `lib/qr.js` (+ test), `lib/scan-web.js` (+ test), `lib/scan.js`, `components/QrCanvas.jsx`,
  `views/CheckIn.jsx`.
- `NOTICE.md`: attributions for the two libraries.

**Old commit** `fc639e34e`

**Collision hotspots** upstream may rework CheckIn/scan (native Capacitor scanner). Re-apply by
keeping upstream's flow and adding the format field + JsBarcode redraw. After re-applying run
`npm install` in `frontend/` to refresh the lockfile (don't hand-merge `package-lock.json`).

**Verify** `cd frontend && npx vitest run src/lib/qr.test.js src/lib/scan-web.test.js`.
