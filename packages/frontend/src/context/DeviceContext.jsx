import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { emptyDevice, applyDeviceSnapshot, deviceConnectionState } from '../lib/deviceSnapshot.mjs'
import i18n from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || ''
const WS_URL = import.meta.env.VITE_WS_URL || ''

export const SIMULATOR_ADDRESS = 'SIMULATOR'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [device, setDevice] = useState(emptyDevice)
  const [devices, setDevices] = useState([])
  const [scanResults, setScanResults] = useState([])
  const [lastTimer, setLastTimer] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [diagnosis, setDiagnosis] = useState(null)
  const socketRef = useRef(null)
  const inFlightRef = useRef(null)
  const generationRef = useRef(0)
  const lastEventRef = useRef(0)
  const lastRefreshRef = useRef(0)

  const applyStatus = useCallback((message) => {
    if (message?.diagnosis) setDiagnosis(message.diagnosis)
    const receivedAt = Date.now()
    lastEventRef.current = receivedAt
    setNow(receivedAt)
    setDevice((previous) => applyDeviceSnapshot(previous, message, receivedAt))
  }, [])

  const loadStatus = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current.promise
    const controller = new AbortController()
    const generation = generationRef.current
    const job = { controller, promise: null }
    const timeout = setTimeout(() => controller.abort(), 4000)
    lastRefreshRef.current = Date.now()
    job.promise = (async () => {
      try {
        const response = await fetch(`${API_URL}/api/bluetooth/status`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Status HTTP ${response.status}`)
        const data = await response.json()
        if (generation === generationRef.current) applyStatus(data)
        return data
      } catch (error) {
        if (error.name !== 'AbortError') console.warn('[DeviceContext] Status refresh failed:', error.message)
        return null
      } finally {
        clearTimeout(timeout)
        if (inFlightRef.current === job) inFlightRef.current = null
      }
    })()
    inFlightRef.current = job
    return job.promise
  }, [applyStatus])

  const loadDevices = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/devices`, { cache: 'no-store' })
      const data = await response.json()
      if (data.success) setDevices(data.data || [])
    } catch (error) {
      console.warn('[DeviceContext] Devices refresh failed:', error.message)
    }
  }, [])

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket
    const invalidateRequest = () => {
      generationRef.current++
      inFlightRef.current?.controller.abort()
      inFlightRef.current = null
    }
    socket.on('connect', () => {
      invalidateRequest()
      setSocketConnected(true)
      void loadStatus()
      void loadDevices()
    })
    socket.on('disconnect', () => {
      invalidateRequest()
      setSocketConnected(false)
      setLastTimer(null)
    })
    socket.on('cu:device', applyStatus)
    socket.on('cu:diagnosis', setDiagnosis)
    socket.on('cu:status', applyStatus)
    // Legacy connection hints trigger reconciliation, never optimistic flags.
    socket.on('cu:connected', () => void loadStatus())
    socket.on('cu:disconnected', () => void loadStatus())
    socket.on('cu:connection', () => void loadStatus())
    socket.on('cu:timer', setLastTimer)
    const refresh = () => {
      if (!document.hidden) void loadStatus()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('pageshow', refresh)
    const watchdog = setInterval(() => {
      const time = Date.now()
      setNow(time)
      // Quiet/broken event stream: reconcile via HTTP, without continuous polling.
      if (
        !document.hidden &&
        socket.connected &&
        time - lastEventRef.current > 3000 &&
        time - lastRefreshRef.current >= 5000
      )
        void loadStatus()
    }, 1000)
    void loadStatus()
    void loadDevices()
    return () => {
      clearInterval(watchdog)
      invalidateRequest()
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('pageshow', refresh)
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [applyStatus, loadStatus, loadDevices])

  const connectionState = deviceConnectionState(device, socketConnected, now)
  const connected = connectionState === 'live'
  const { deviceType, deviceAddress, cuStatus, lastStatusAt } = device

  // Scan for BLE devices (returns temporary list, not persisted)
  const scan = useCallback(async (timeout = 10000) => {
    setScanning(true)
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout }),
      })
      const data = await response.json()

      if (data.success) {
        setScanResults(data.devices || [])
        return data.devices
      }
      return []
    } catch (error) {
      console.error('[DeviceContext] Scan error:', error)
      return []
    } finally {
      setScanning(false)
    }
  }, [])

  // Connect to a device (persisted to DB on success by backend)
  const connect = useCallback(
    async (address) => {
      setConnecting(true)
      try {
        const response = await fetch(`${API_URL}/api/bluetooth/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        const data = await response.json()

        if (data.success) {
          const actual = await loadStatus()
          await loadDevices()
          return actual?.connected
            ? { success: true, deviceType: actual.deviceType }
            : { success: false, pending: true, error: i18n.t('settings:connection.pending') }
        }

        return { success: false, error: data.error }
      } catch (error) {
        console.error('[DeviceContext] Connect error:', error)
        return { success: false, error: error.message }
      } finally {
        setConnecting(false)
      }
    },
    [loadDevices, loadStatus]
  )

  // Disconnect current device
  const disconnect = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/disconnect`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setDevice(emptyDevice())
        setLastTimer(null)
        await loadStatus()
      }

      return data
    } catch (error) {
      console.error('[DeviceContext] Disconnect error:', error)
      return { success: false, error: error.message }
    }
  }, [loadStatus])

  // Remove a device from DB
  const removeDevice = useCallback(
    async (deviceId) => {
      try {
        const response = await fetch(`${API_URL}/api/devices/${deviceId}`, {
          method: 'DELETE',
        })
        const data = await response.json()
        if (data.success) {
          await loadDevices()
        }
        return data
      } catch (error) {
        console.error('[DeviceContext] Remove device error:', error)
        return { success: false, error: error.message }
      }
    },
    [loadDevices]
  )

  // Start race
  const startRace = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/start-race`, {
        method: 'POST',
      })
      return await response.json()
    } catch (error) {
      console.error('[DeviceContext] Start race error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Press ESC
  const pressEsc = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/esc`, {
        method: 'POST',
      })
      return await response.json()
    } catch (error) {
      console.error('[DeviceContext] ESC error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Press button
  const pressButton = useCallback(async (buttonId) => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/button/${buttonId}`, {
        method: 'POST',
      })
      return await response.json()
    } catch (error) {
      console.error('[DeviceContext] Button error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Derived state
  const isInLightsSequence = cuStatus?.start >= 1 && cuStatus?.start <= 7
  const isRacing = cuStatus?.start === 0

  const value = {
    // State
    connected,
    deviceType,
    deviceAddress,
    devices,
    scanResults,
    cuStatus,
    lastStatusAt,
    lastTimer,
    socketConnected,
    connectionState,
    diagnosis,

    // Derived state
    isInLightsSequence,
    isRacing,

    // Loading states
    scanning,
    connecting,

    // Actions
    scan,
    connect,
    disconnect,
    removeDevice,
    startRace,
    pressEsc,
    pressButton,
    loadStatus,
    loadDevices,
  }

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider')
  }
  return context
}

export default DeviceContext
