// Arm only after observing the actual countdown. Cached racing/GO state is silent.
export function startShotTransition(previous = {}, { sessionId, active, connected, start }) {
  const state = previous.sessionId === sessionId ? { ...previous } : { sessionId, armed: false }
  if (!active || !connected || !sessionId || !Number.isInteger(start))
    return { state: { sessionId, armed: false }, fire: false }
  if (start === 1 || start >= 8) state.armed = false
  else if (start >= 2 && start <= 6) state.armed = true
  else if (start === 7 || start === 0) {
    const fire = Boolean(state.armed)
    state.armed = false
    return { state, fire }
  }
  return { state, fire: false }
}

let context, shot
export function unlockStartAudio() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!Audio) return null
    if (!context || context.state === 'closed') {
      context = new Audio()
      // Layer a sharp crack, heavier low body and a longer diffuse tail; keep peak headroom.
      shot = context.createBuffer(1, Math.round(context.sampleRate * 1.05), context.sampleRate)
      const samples = shot.getChannelData(0)
      let seed = 1234567
      let low = 0
      let peak = 0
      for (let i = 0; i < samples.length; i++) {
        seed = (1664525 * seed + 1013904223) >>> 0
        const time = i / context.sampleRate
        const noise = seed / 2147483648 - 1
        low += 0.12 * (noise - low)
        const attack = Math.min(1, time / 0.0008)
        const crack = noise * Math.exp(-time / 0.028)
        const body = 2.2 * low * Math.exp(-time / 0.16)
        const thump =
          1.05 *
          Math.sin(2 * Math.PI * (62 * time + 50 * 0.045 * (1 - Math.exp(-time / 0.045)))) *
          Math.exp(-time / 0.14)
        const tail = 0.48 * low * Math.exp(-time / 0.24)
        const fade = Math.min(1, (samples.length - 1 - i) / (context.sampleRate * 0.025))
        samples[i] = Math.tanh((crack + body + thump + tail) * 1.85) * attack * fade
        peak = Math.max(peak, Math.abs(samples[i]))
      }
      for (let i = 0; i < samples.length; i++) samples[i] *= 0.95 / (peak || 1)
    }
    if (context.state === 'suspended') void context.resume().catch(() => {})
    return context
  } catch {
    return null
  }
}
export function playStartShot() {
  const ctx = unlockStartAudio()
  if (!ctx || ctx.state !== 'running') return // Never replay a blocked shot late.
  const source = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    gain = ctx.createGain()
  source.buffer = shot
  filter.type = 'highpass'
  filter.frequency.value = 28
  filter.Q.value = 0.5
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.001)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
  source.start()
}
