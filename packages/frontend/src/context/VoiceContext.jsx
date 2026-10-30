import { speechTimeParts, speechRate } from '../lib/speechTime.mjs'
import i18n from '../i18n'
import { createSpeechPlayer } from '../lib/piperPlayer.mjs'
import { browserVoice } from '../lib/piperSelection.mjs'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { voiceIdsFromPreference } from '../lib/voicePreferences.mjs'

const API_URL = import.meta.env.VITE_API_URL || ''

const VoiceContext = createContext(null)

export function VoiceProvider({ children }) {
  const [bestLapEnabled, setBestLapEnabled] = useState(true)
  const [podiumEnabled, setPodiumEnabled] = useState(true)
  const [minLaps, setMinLaps] = useState(3)
  // Chosen voice per interface language; a language without one uses its default voice
  const [voiceIds, setVoiceIds] = useState({})
  const {
    i18n: { resolvedLanguage },
  } = useTranslation()

  const [localVoices, setLocalVoices] = useState([])
  const localVoicesRef = useRef([])
  const [voiceState, setVoiceState] = useState('idle')
  const playerRef = useRef(null)
  if (!playerRef.current) playerRef.current = createSpeechPlayer({ api: API_URL, onState: setVoiceState })
  useEffect(() => {
    fetch(`${API_URL}/api/voice/status`)
      .then((r) => r.json())
      .then((d) => {
        localVoicesRef.current = Array.isArray(d.voices) ? d.voices : []
        setLocalVoices(localVoicesRef.current)
      })
      .catch(() => {})
    const stop = () => playerRef.current.cancel()
    i18n.on('languageChanged', stop)
    return () => {
      i18n.off('languageChanged', stop)
      stop()
    }
  }, [])

  const [gain, setGain] = useState(2)
  const gainRef = useRef(gain)
  gainRef.current = gain
  const saveGain = useCallback((value) => {
    const next = Math.min(4, Math.max(1, Number(value) || 2))
    setGain(next)
    fetch(`${API_URL}/api/preferences/voice:gain`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    }).catch(() => {})
  }, [])
  const [rate, setRate] = useState(0.95)
  const rateRef = useRef(rate)
  rateRef.current = rate

  // Refs for access from socket listeners
  const bestLapEnabledRef = useRef(bestLapEnabled)
  bestLapEnabledRef.current = bestLapEnabled
  const podiumEnabledRef = useRef(podiumEnabled)
  podiumEnabledRef.current = podiumEnabled
  const minLapsRef = useRef(minLaps)
  minLapsRef.current = minLaps
  const voiceIdsRef = useRef(voiceIds)
  voiceIdsRef.current = voiceIds

  const saveRate = useCallback((value) => {
    const next = speechRate(Number(value))
    setRate(next)
    fetch(`${API_URL}/api/preferences/voice:rate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    }).catch(() => {})
  }, [])

  // Load preferences
  useEffect(() => {
    fetch(`${API_URL}/api/preferences/voice:gain`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Number.isFinite(d.data)) setGain(Math.min(4, Math.max(1, d.data)))
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/voice:rate`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setRate(speechRate(d.data))
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:enabled`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setBestLapEnabled(d.data)
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/podiumVoice:enabled`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setPodiumEnabled(d.data)
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:minLaps`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setMinLaps(d.data)
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:voiceId`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || d.data === null) return
        // Preserve the existing local Piper/browser choice when adopting per-language settings.
        setVoiceIds(voiceIdsFromPreference(d.data, i18n.resolvedLanguage))
      })
      .catch(() => {})
  }, [])

  // Save helpers
  const saveBestLapEnabled = useCallback((value) => {
    setBestLapEnabled(value)
    fetch(`${API_URL}/api/preferences/bestLapVoice:enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  const savePodiumEnabled = useCallback((value) => {
    setPodiumEnabled(value)
    fetch(`${API_URL}/api/preferences/podiumVoice:enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  const saveMinLaps = useCallback((value) => {
    const num = Math.max(1, Math.min(20, parseInt(value) || 3))
    setMinLaps(num)
    fetch(`${API_URL}/api/preferences/bestLapVoice:minLaps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: num }),
    }).catch(() => {})
  }, [])

  // Saves the voice for the current interface language only
  const saveVoiceId = useCallback((voiceURI) => {
    const value = { ...voiceIdsRef.current, [i18n.resolvedLanguage]: voiceURI }
    if (!voiceURI) delete value[i18n.resolvedLanguage]
    setVoiceIds(value)
    fetch(`${API_URL}/api/preferences/bestLapVoice:voiceId`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  const getVoice = useCallback(
    () =>
      browserVoice(
        window.speechSynthesis?.getVoices() || [],
        voiceIdsRef.current[i18n.resolvedLanguage] || '',
        i18n.resolvedLanguage
      ),
    []
  )
  const speak = useCallback(
    (text, options = {}) =>
      playerRef.current.speak(text, {
        language: i18n.resolvedLanguage,
        selection: voiceIdsRef.current[i18n.resolvedLanguage] || '',
        voices: localVoicesRef.current,
        rate: rateRef.current,
        gain: gainRef.current,
        ...options,
      }),
    []
  )

  const formatTimeVoice = useCallback((ms) => {
    const parts = speechTimeParts(ms, i18n.resolvedLanguage || 'de')
    if (!parts) return ''
    const seconds = i18n.t('voice:seconds', { value: parts.seconds })
    return parts.minutes ? i18n.t('voice:minutes', { count: parts.minutes, seconds }) : seconds
  }, [])

  return (
    <VoiceContext.Provider
      value={{
        bestLapEnabled,
        saveBestLapEnabled,
        podiumEnabled,
        savePodiumEnabled,
        minLaps,
        saveMinLaps,
        voiceId: voiceIds[resolvedLanguage] || '',
        saveVoiceId,
        bestLapEnabledRef,
        podiumEnabledRef,
        minLapsRef,
        speak,
        getVoice,
        formatTimeVoice,
        localVoices,
        voiceState,
        rate,
        saveRate,
        gain,
        saveGain,
        localAvailable: localVoices.length > 0,
        voiceError: voiceState === 'unavailable',
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) throw new Error('useVoice must be used within VoiceProvider')
  return context
}
