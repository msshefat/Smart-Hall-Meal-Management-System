import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { idFromMealQr, mealQrPayload } from './qr.js'

const codes = ['24549010021', '24549010034', 'HALL-ADMIN', 'HALL-STAFF']
const payloads = new Set()

for (const code of codes) {
  const payload = mealQrPayload(code)
  assert.equal(payload, `HALLMEAL:${code}`)
  assert.equal(payloads.has(payload), false)
  payloads.add(payload)
  assert.equal(idFromMealQr(payload), code)
  assert.equal(idFromMealQr(`hallmeal:${code}`), code)
  assert.equal(idFromMealQr(code), code)

  const png = PNG.sync.read(await QRCode.toBuffer(payload, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M'
  }))
  const found = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  assert.ok(found, `QR for ${code} should decode`)
  assert.equal(found.data, payload)
  assert.equal(idFromMealQr(found.data), code)
}

assert.equal(mealQrPayload(''), '')
assert.equal(mealQrPayload('A'), '')
assert.equal(idFromMealQr(''), '')
assert.equal(idFromMealQr('https://example.com/not-a-card'), '')
assert.equal(idFromMealQr('not a card'), '')

console.log('qr checks passed')
