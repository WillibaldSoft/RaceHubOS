import { fuelTelemetry } from './fuelTelemetry.mjs'

// Detect actual refuelling, not merely pit entry. One effect per pit visit.
export function refuellingSound(previous = {}, { sessionId, running, controllers, device, now }) {
  if (!running) return { state: {}, fire: false, active: false }
  const identity = `${sessionId}:${device.deviceAddress || ''}`
  const before = previous.identity === identity ? previous.controllers || {} : {}
  const state = { identity, controllers: {} }
  let fire = false,
    active = false
  for (const controller of controllers) {
    const fuel = fuelTelemetry({
      connected: device.connected,
      socketConnected: device.socketConnected,
      status: device.cuStatus,
      receivedAt: device.lastStatusAt,
      now,
      controller,
    })
    const old = before[controller] || {}
    if (!fuel.available || !fuel.enabled) {
      // A missing sample breaks comparison; never infer a rise across a gap.
      state.controllers[controller] = { fired: Boolean(old.fired) }
      continue
    }
    if (!fuel.inPit) {
      state.controllers[controller] = { raw: fuel.raw, at: device.lastStatusAt, fired: false }
      continue
    }
    const next = { raw: fuel.raw, at: device.lastStatusAt, fired: Boolean(old.fired), lastRise: old.lastRise }
    const continuous = Number.isFinite(old.at) && device.lastStatusAt > old.at && device.lastStatusAt - old.at <= 5000
    if (continuous && Number.isInteger(old.raw) && fuel.raw > old.raw) {
      next.lastRise = device.lastStatusAt
      if (!old.fired && fuel.raw < 15) {
        fire = true
        next.fired = true
      }
    }
    if (next.fired && fuel.raw < 15 && Number.isFinite(next.lastRise) && now - next.lastRise <= 2500) active = true
    state.controllers[controller] = next
  }
  return { state, fire, active }
}
