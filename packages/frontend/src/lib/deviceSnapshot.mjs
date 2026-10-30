export const emptyDevice = () => ({
  connected: false,
  deviceType: null,
  deviceAddress: null,
  cuStatus: null,
  lastStatusAt: null,
  revision: -1,
  serverId: null,
})

// HTTP can finish after a newer socket message. Keep the newer server revision.
export function applyDeviceSnapshot(previous, message, receivedAt) {
  if (!message || typeof message.connected !== 'boolean') return previous
  if (
    message.serverId === previous.serverId &&
    Number.isInteger(message.revision) &&
    message.revision < previous.revision
  )
    return previous
  const status =
    message.lastStatus !== undefined
      ? message.lastStatus
      : Array.isArray(message.fuel)
        ? { fuel: message.fuel, start: message.start, mode: message.mode, pit: message.pit, display: message.display }
        : null
  const age =
    Number.isFinite(message.serverTime) && Number.isFinite(message.lastStatusAt)
      ? Math.max(0, message.serverTime - message.lastStatusAt)
      : null
  return {
    connected: message.connected,
    deviceType: message.connected ? message.deviceType || null : null,
    deviceAddress: message.connected ? message.deviceAddress || null : null,
    cuStatus: message.connected ? status : null,
    // Preserve the measurement's age; fetching an old cached sample never makes it fresh.
    lastStatusAt: message.connected && status && age !== null ? receivedAt - age : null,
    revision: Number.isInteger(message.revision) ? message.revision : previous.revision,
    serverId: message.serverId || null,
  }
}
export function deviceConnectionState(device, socketConnected, now) {
  if (!socketConnected) return 'serverDisconnected'
  if (!device.connected) return 'cuDisconnected'
  if (!Number.isFinite(device.lastStatusAt)) return 'waiting'
  if (now - device.lastStatusAt > 5000) return 'stale'
  return 'live'
}
