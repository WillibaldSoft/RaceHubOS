import { useEffect, useState } from 'react'
import { useDevice } from '../context/DeviceContext'
import { fuelTelemetry } from '../lib/fuelTelemetry.mjs'

export function useFuelTelemetry(controller = 0) {
  const { connected, socketConnected, cuStatus, lastStatusAt } = useDevice()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return fuelTelemetry({
    connected,
    socketConnected,
    status: cuStatus,
    receivedAt: lastStatusAt,
    now: Math.max(now, lastStatusAt || 0),
    controller,
  })
}
