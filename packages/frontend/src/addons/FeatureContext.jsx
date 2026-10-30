import { useEffect, useState, useCallback } from 'react'
import {
  SPEED_DEFAULTS,
  SPEED_DISPLAY_KEY,
  validateSpeedDisplay,
  SPEED_SCALE_SOURCE_KEY,
  SPEED_SCALE_SOURCES,
  validateSpeedScaleSource,
  normalizedSpeedScaleSource,
} from '@racehubos/shared'
const api = import.meta.env.VITE_API_URL || ''
import { FeatureContext as Context } from './FeatureState'
export function FeatureProvider({ children }) {
  const [planner, setPlanner] = useState({
    installed: false,
    compatible: false,
    enabled: false,
    loading: true,
  })
  const [speed, setSpeed] = useState(SPEED_DEFAULTS)
  const [speedReady, setSpeedReady] = useState(false)
  const [scaleSource, setScaleSource] = useState(SPEED_SCALE_SOURCES.CAR)
  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      fetch(`${api}/api/addons/track-planner`).then(async (r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
      fetch(`${api}/api/preferences/${SPEED_DISPLAY_KEY}`).then(async (r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
      fetch(api + '/api/preferences/' + SPEED_SCALE_SOURCE_KEY).then(async (r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
    ])
    const [addonResult, speedResult, sourceResult] = results
    if (addonResult.status === 'fulfilled' && addonResult.value.success)
      setPlanner({ ...addonResult.value.data, loading: false })
    else
      setPlanner({
        installed: false,
        compatible: false,
        enabled: false,
        loading: false,
        error: true,
      })
    if (
      speedResult.status === 'fulfilled' &&
      speedResult.value.success &&
      sourceResult.status === 'fulfilled' &&
      sourceResult.value.success
    ) {
      try {
        setSpeed(speedResult.value.data === null ? SPEED_DEFAULTS : validateSpeedDisplay(speedResult.value.data))
        setScaleSource(normalizedSpeedScaleSource(sourceResult.value.data))
        setSpeedReady(true)
      } catch {
        setSpeedReady(false)
      }
    } else setSpeedReady(false)
  }, [])
  useEffect(() => {
    queueMicrotask(refresh)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  async function activate(enabled) {
    const r = await fetch(`${api}/api/addons/track-planner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (!r.ok) throw new Error('activation')
    await refresh()
  }
  async function saveSpeed(next) {
    const value = validateSpeedDisplay(next)
    const r = await fetch(`${api}/api/preferences/${SPEED_DISPLAY_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!r.ok) throw new Error('speed settings')
    setSpeed(value)
  }
  async function saveScaleSource(next) {
    const value = validateSpeedScaleSource(next)
    const response = await fetch(api + '/api/preferences/' + SPEED_SCALE_SOURCE_KEY, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!response.ok || !(await response.json()).success) throw new Error('speed scale source')
    setScaleSource(value)
  }
  return (
    <Context.Provider
      value={{ planner, activate, refresh, speed: { ...speed, scaleSource }, speedReady, saveSpeed, saveScaleSource }}
    >
      {children}
    </Context.Provider>
  )
}
