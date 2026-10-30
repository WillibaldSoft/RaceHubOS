import { SessionStatus } from '@racehubos/shared'
import { useEffect, useRef } from 'react'
import { useDevice } from '../../context/DeviceContext'
import { useSession } from '../../context/SessionContext'
import { playStartShot, startShotTransition, unlockStartAudio } from '../../lib/startShot.mjs'

// One global owner, shared by the normal view and the fullscreen race display.
export default function RaceStartSound() {
  const device = useDevice(),
    { session } = useSession(),
    state = useRef({})
  useEffect(() => {
    const unlock = () => {
      unlockStartAudio()
    }
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])
  useEffect(() => {
    const next = startShotTransition(state.current, {
      sessionId: session?.id,
      active: session?.status === SessionStatus.ACTIVE,
      connected: device.connectionState === 'live',
      start: device.cuStatus?.start,
    })
    state.current = next.state
    if (next.fire) playStartShot()
  }, [session?.id, session?.status, device.connectionState, device.cuStatus?.start])
  return null
}
