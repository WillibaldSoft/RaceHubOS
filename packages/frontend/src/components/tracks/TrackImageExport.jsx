import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'

export default function TrackImageExport({ children, name = 'Streckenplan' }) {
  const { t } = useTranslation('tracks')
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function download(format) {
    setBusy(true)
    setError(false)
    let url
    try {
      const original = ref.current.querySelector('svg')
      if (!original) throw new Error('No drawing')
      const svg = original.cloneNode(true)
      svg.querySelectorAll('[data-testid=track-connector]').forEach((node) => node.remove())
      const color = getComputedStyle(original).backgroundColor
      const backgroundColor = color && color !== 'rgba(0, 0, 0, 0)' ? color : '#020617'
      const box = original.viewBox.baseVal
      const scale = 2400 / Math.max(box.width, box.height)
      const width = Math.max(1, Math.ceil(box.width * scale)),
        height = Math.max(1, Math.ceil(box.height * scale))
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svg.setAttribute('width', width)
      svg.setAttribute('height', height)
      svg.removeAttribute('class')
      svg.removeAttribute('style')
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      for (const [key, value] of Object.entries({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: backgroundColor,
      }))
        background.setAttribute(key, value)
      svg.insertBefore(background, svg.firstChild)
      url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' })
      )
      if (format === 'svg') {
        const a = document.createElement('a')
        a.href = url
        a.download = `${name}.svg`
        a.click()
      } else {
        const image = new Image()
        await new Promise((resolve, reject) => {
          image.onload = resolve
          image.onerror = reject
          image.src = url
        })
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0)
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95)
        )
        if (!blob) throw new Error('Image export failed')
        const output = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = output
        a.download = `${name}.${format}`
        a.click()
        setTimeout(() => URL.revokeObjectURL(output), 1000)
      }
    } catch {
      setError(true)
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <div ref={ref}>{children}</div>
      <div className="flex flex-wrap gap-2">
        {['png', 'jpg', 'svg'].map((format) => (
          <Button
            key={format}
            data-testid={`export-image-${format}`}
            disabled={busy}
            type="button"
            variant="outline"
            onClick={() => download(format)}
          >
            {t('images.export', { format: format.toUpperCase() })}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{t('images.error')}</p>}
    </div>
  )
}
