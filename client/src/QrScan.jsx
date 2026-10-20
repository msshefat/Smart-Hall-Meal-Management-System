import { useEffect, useId, useRef, useState } from 'react'
import { idFromMealQr } from './qr'

export default function QrScan({ onCode }) {
  const regionId = `meal-qr-reader-${useId().replace(/:/g, '')}`
  const [open, setOpen] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [error, setError] = useState('')
  const scannerRef = useRef(null)
  const handled = useRef(false)
  const onCodeRef = useRef(onCode)

  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  useEffect(() => {
    if (!open) return undefined
    let scanner = null
    let cancelled = false
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled || !document.getElementById(regionId)) return
      scanner = new Html5Qrcode(regionId, { verbose: false })
      scannerRef.current = scanner
    }).catch(() => {})
    return () => {
      cancelled = true
      scannerRef.current = null
      if (!scanner) return
      const stop = scanner.isScanning ? scanner.stop() : Promise.resolve()
      stop.then(() => {
        try { scanner.clear() } catch { /* already cleared */ }
      }).catch(() => {})
    }
  }, [open, regionId])

  function accept(text) {
    if (handled.current) return true
    const id = idFromMealQr(text)
    if (!id) {
      setError('That QR code is not a hall meal card.')
      return false
    }
    handled.current = true
    setError('')
    const scanner = scannerRef.current
    const finish = () => {
      setCameraOn(false)
      setOpen(false)
      onCodeRef.current(id)
    }
    if (scanner && scanner.isScanning) scanner.stop().then(finish).catch(finish)
    else finish()
    return true
  }

  async function startCamera() {
    const scanner = scannerRef.current
    if (!scanner) {
      setError('The scanner is still loading. Try again in a moment.')
      return
    }
    if (scanner.isScanning) return
    setError('')
    const onHit = (text) => { accept(text) }
    const config = {
      fps: 8,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const size = Math.max(50, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72))
        return { width: size, height: size }
      }
    }
    try {
      try {
        await scanner.start({ facingMode: 'environment' }, config, onHit, () => {})
      } catch {
        await scanner.start({ facingMode: 'user' }, config, onHit, () => {})
      }
      const video = document.querySelector(`#${CSS.escape(regionId)} video`)
      if (video) {
        video.style.width = '100%'
        video.style.height = '100%'
        video.style.objectFit = 'cover'
      }
      setCameraOn(true)
    } catch {
      setCameraOn(false)
      setError('The camera could not be opened. Allow camera access, or choose a picture of the meal card.')
    }
  }

  async function onFile(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    const scanner = scannerRef.current
    if (!scanner) {
      setError('The scanner is still loading. Try again in a moment.')
      return
    }
    setError('')
    try {
      if (scanner.isScanning) {
        await scanner.stop()
        setCameraOn(false)
      }
      const text = await scanner.scanFile(file, false)
      accept(text)
    } catch {
      setError('No meal card could be read from that picture.')
    }
  }

  async function closeScanner() {
    const scanner = scannerRef.current
    if (scanner && scanner.isScanning) {
      try { await scanner.stop() } catch { /* already stopped */ }
    }
    setCameraOn(false)
    setOpen(false)
  }

  return (
    <div className="scan-box">
      {open ? (
        <div className="scan-panel">
          <div className="qr-frame">
            <div id={regionId} className="qr-reader" />
            {cameraOn ? null : <p className="qr-frame-label">Camera preview</p>}
          </div>
          <div className="scan-actions">
            <button className="btn btn-primary" type="button" onClick={startCamera} disabled={cameraOn}>{cameraOn ? 'Camera on' : 'Open camera'}</button>
            <label className="btn btn-quiet file-btn">
              Choose a picture
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
            </label>
            <button className="btn btn-quiet" type="button" onClick={closeScanner}>Close</button>
          </div>
          {error ? <p className="banner is-bad" role="status">{error}</p> : <p className="stat-hint">The preview stays in the box above. Hold the meal card inside it.</p>}
        </div>
      ) : (
        <button className="btn btn-quiet" type="button" onClick={() => { handled.current = false; setCameraOn(false); setError(''); setOpen(true) }}>Scan QR</button>
      )}
    </div>
  )
}
