export const soundKinds = {
  crowd: 'Zuschauer und Tribünenjubel',
  applause: 'Applaus an der Strecke',
  engine: 'Motoren und Vorbeifahrten',
  pit: 'Schlagschrauber beim Tanken',
}
export function normalizeRaceSounds(value) {
  const v = value && typeof value === 'object' ? value : {}
  const result = { enabled: v.enabled !== false, adaptive: v.adaptive !== false, volume: 0.35, intensity: 0.6 }
  for (const key of ['volume', 'intensity']) if (Number.isFinite(v[key])) result[key] = Math.max(0, Math.min(1, v[key]))
  for (const key of Object.keys(soundKinds)) result[key] = v[key] !== false
  return result
}
export function soundActivity(config, drivers) {
  const count = Math.max(1, Math.min(6, Number(drivers) || 1))
  const density = config.intensity * (config.adaptive ? 1 - (count - 1) * 0.16 : 1)
  return {
    volume: config.volume * (config.adaptive ? 1 - (count - 1) * 0.12 : 1),
    delay: 4000 + (1 - density) * 22000,
    density,
  }
}
const url = `${import.meta.env?.VITE_API_URL || ''}/api/preferences/raceSounds`
export async function loadRaceSounds() {
  const response = await fetch(url),
    data = await response.json()
  if (!response.ok || !data.success) throw new Error('Renngeräusche konnten nicht geladen werden.')
  return normalizeRaceSounds(data.data)
}
export async function saveRaceSounds(value) {
  const config = normalizeRaceSounds(value)
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: config }),
  })
  if (!response.ok || !(await response.json()).success)
    throw new Error('Renngeräusche konnten nicht gespeichert werden.')
  window.dispatchEvent(new CustomEvent('race:sounds-saved', { detail: config }))
}

// Real field recordings, bundled for offline playback. See sounds/racing/CREDITS.md.
export const raceSoundClips = {
  crowd: ['crowd-1.mp3', 'crowd-2.mp3'],
  applause: ['applause.mp3'],
  engine: ['f1-pass.mp3'],
  pit: ['impact-wrench.mp3'],
}
export function createRaceAudio() {
  let context,
    generation = 0,
    closed = false
  const playing = new Set(),
    buffers = new Map(),
    lastClip = new Map()
  const abort = new AbortController()
  function unlock() {
    try {
      if (closed) return
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
      if (!Audio) return
      if (!context || context.state === 'closed') context = new Audio()
      if (context.state === 'suspended') return context.resume().catch(() => {})
    } catch {
      /* Audio is optional on devices without Web Audio. */
    }
  }
  function stop() {
    generation++
    for (const source of playing) {
      try {
        source.stop()
      } catch {}
    }
    playing.clear()
  }
  async function load(clip) {
    if (!buffers.has(clip)) {
      const pending = (async () => {
        const base = import.meta.env?.BASE_URL || '/'
        const response = await fetch(`${base}sounds/racing/${clip}`, { signal: abort.signal })
        if (!response.ok) throw new Error('Tonaufnahme konnte nicht geladen werden.')
        return context.decodeAudioData(await response.arrayBuffer())
      })()
      buffers.set(clip, pending)
      pending.catch(() => {
        if (buffers.get(clip) === pending) buffers.delete(clip)
      })
    }
    return buffers.get(clip)
  }
  async function play(kind, volume) {
    if (
      closed ||
      !context ||
      context.state !== 'running' ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      !Object.hasOwn(raceSoundClips, kind)
    )
      return 0
    stop()
    const token = generation
    const variants = raceSoundClips[kind]
    const alternatives = variants.filter((clip) => clip !== lastClip.get(kind))
    const pool = alternatives.length ? alternatives : variants
    const clip = pool[Math.floor(Math.random() * pool.length)]
    const buffer = await load(clip)
    // Pause, mute, a new preview or navigation must cancel even pending decodes.
    if (closed || token !== generation || context.state !== 'running') return 0
    const source = context.createBufferSource(),
      gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = Math.min(1, volume) * 0.85
    source.connect(gain)
    gain.connect(context.destination)
    playing.add(source)
    source.onended = () => {
      playing.delete(source)
      source.disconnect()
      gain.disconnect()
    }
    lastClip.set(kind, clip)
    source.start()
    return buffer.duration
  }
  async function preload(kind) {
    if (closed || !context || !Object.hasOwn(raceSoundClips, kind)) return
    await Promise.all(raceSoundClips[kind].map(load))
  }
  return {
    unlock,
    play,
    stop,
    preload,
    close() {
      closed = true
      stop()
      abort.abort()
      buffers.clear()
      if (context && context.state !== 'closed') void context.close().catch(() => {})
    },
  }
}
