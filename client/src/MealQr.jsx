import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { mealQrPayload } from './qr'

export default function MealQr({ studentCode, name }) {
  const payload = mealQrPayload(studentCode)
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!payload) return undefined
    let cancel = false
    QRCode.toDataURL(payload, { margin: 1, width: 280, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancel) setSrc(url)
      })
      .catch(() => {
        if (!cancel) setSrc('')
      })
    return () => {
      cancel = true
    }
  }, [payload])

  if (!payload) {
    return <p className="empty">An ID is required before a meal card can be issued.</p>
  }
  if (!src) return <p className="empty">Preparing the meal card…</p>

  const fileName = `meal-card-${studentCode}.png`
  return (
    <figure className="meal-qr">
      <img src={src} width="220" height="220" alt={`Meal card QR code for ${name || studentCode}, ID ${studentCode}`} />
      <figcaption>
        <strong>{studentCode}</strong>
        <span>Show this card at Meal taken. A scan fills the search field with this ID.</span>
      </figcaption>
      <a className="btn btn-quiet" href={src} download={fileName}>Download card</a>
    </figure>
  )
}
