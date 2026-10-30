import { SessionStatus, STANDARD_SESSION_TYPES } from '@racehubos/shared'
import { refuellingSound } from '../../lib/refuellingSound.mjs'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../context/SessionContext'
import { useDevice } from '../../context/DeviceContext'
import { useVoice } from '../../context/VoiceContext'
import {
  createRaceAudio,
  loadRaceSounds,
  normalizeRaceSounds,
  soundActivity,
  soundKinds,
} from '../../lib/raceSounds.mjs'

export default function RaceSounds() {
  const { session, entries } = useSession(),
    device = useDevice(),
    { voiceState } = useVoice()
  const [config, setConfig] = useState(() => normalizeRaceSounds(null))
  const [ready, setReady] = useState(false),
    [visible, setVisible] = useState(!document.hidden)
  const [now, setNow] = useState(() => Date.now())
  const pitState = useRef({}),
    pitActive = useRef(false),
    pitAudio = useRef(null)
  const audio = useRef(null),
    voice = useRef(voiceState)
  useEffect(() => {
    voice.current = voiceState
  }, [voiceState])
  useEffect(() => {
    const engine = createRaceAudio(),
      pit = createRaceAudio()
    audio.current = engine
    pitAudio.current = pit
    let active = true,
      changed = false
    loadRaceSounds()
      .then((value) => {
        if (active && !changed) setConfig(value)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true)
      })
    const unlock = () => {
      engine.unlock()
      Promise.resolve(pit.unlock())
        .then(() => pit.preload('pit'))
        .catch(() => {})
    }
    const update = (event) => {
      changed = true
      setConfig(normalizeRaceSounds(event.detail))
      setReady(true)
      engine.stop()
      pit.stop()
    }
    const visibility = () => {
      setVisible(!document.hidden)
      if (document.hidden) {
        engine.stop()
        pit.stop()
      }
    }
    const timer = setInterval(() => setNow(Date.now()), 500)
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('race:sounds-saved', update)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      clearInterval(timer)
      engine.close()
      pit.close()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('race:sounds-saved', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  const drivers = new Set(
    entries.filter((e) => Number.isInteger(e.controller) && (e.driver || e.driverId)).map((e) => e.controller)
  ).size
  const running =
    ready &&
    visible &&
    config.enabled &&
    session?.status === SessionStatus.ACTIVE &&
    !session.championshipId &&
    STANDARD_SESSION_TYPES.includes(session.type) &&
    drivers > 0 &&
    device.connectionState === 'live' &&
    [0, 7].includes(device.cuStatus?.start)
  useEffect(() => {
    const result = refuellingSound(pitState.current, {
      sessionId: session?.id,
      running,
      controllers: entries
        .filter((e) => Number.isInteger(e.controller) && (e.driver || e.driverId))
        .map((e) => e.controller),
      device,
      now: Math.max(now, device.lastStatusAt || 0),
    })
    pitState.current = result.state
    const allowed = running && config.pit && config.volume > 0 && result.active
    pitActive.current = allowed
    if (!allowed) pitAudio.current?.stop()
    if (allowed) audio.current?.stop()
    if (
      allowed &&
      result.fire &&
      !window.speechSynthesis?.speaking &&
      !['loading', 'local', 'browser', 'fallback'].includes(voice.current)
    ) {
      void pitAudio.current?.play('pit', soundActivity(config, drivers).volume).catch(() => {})
    }
  }, [running, session?.id, entries, device, now, config, drivers])
  useEffect(() => {
    if (!running || config.intensity === 0 || config.volume === 0) {
      audio.current?.stop()
      return
    }
    const kinds = Object.keys(soundKinds).filter((key) => key !== 'pit' && config[key])
    if (!kinds.length) return
    const activity = soundActivity(config, drivers)
    let timer,
      previous,
      cancelled = false
    function schedule(extra = 0) {
      if (cancelled) return
      timer = setTimeout(
        async () => {
          let duration = 0
          if (
            !pitActive.current &&
            !window.speechSynthesis?.speaking &&
            !['loading', 'local', 'browser', 'fallback'].includes(voice.current)
          ) {
            const choices = kinds.filter((key) => key !== previous)
            const pool = choices.length ? choices : kinds
            previous = pool[Math.floor(Math.random() * pool.length)]
            try {
              duration = (await audio.current?.play(previous, activity.volume)) || 0
            } catch {
              /* Retry the next local effect after the normal interval. */
            }
          }
          schedule(duration * 1000)
        },
        extra + activity.delay * (0.8 + Math.random() * 0.4)
      )
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
      audio.current?.stop()
    }
  }, [running, config, drivers])
  useEffect(() => {
    if (['loading', 'local', 'browser', 'fallback'].includes(voiceState)) {
      audio.current?.stop()
      pitAudio.current?.stop()
    }
  }, [voiceState])
  return null
}
