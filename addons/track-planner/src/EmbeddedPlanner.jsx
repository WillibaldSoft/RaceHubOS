import { useEffect, useState } from 'react'
import i18n from '@core/i18n'
import TrackPlanEditor from './components/TrackPlanEditor'
const targetOrigin = new URLSearchParams(window.location.hash.slice(1)).get('host') || window.location.origin
export default function EmbeddedPlanner() {
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState({})
  useEffect(() => {
    function receive(event) {
      if (
        event.source !== window.parent ||
        event.origin !== targetOrigin ||
        event.data?.channel !== 'racehubos:track-planner:1'
      )
        return
      if (event.data.type === 'init') {
        i18n.changeLanguage(event.data.language)
        document.documentElement.classList.toggle('dark', !!event.data.dark)
        setDraft(event.data.draft)
      }
      if (event.data.type === 'status') setStatus(event.data.status)
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ channel: 'racehubos:track-planner:1', type: 'ready' }, targetOrigin)
    return () => window.removeEventListener('message', receive)
  }, [])
  function send(type, next = draft) {
    window.parent.postMessage({ channel: 'racehubos:track-planner:1', type, draft: next }, targetOrigin)
  }
  function update(patch) {
    const next = { ...draft, ...patch }
    setDraft(next)
    send('change', next)
  }
  if (!draft) return null
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        send('save')
      }}
    >
      <TrackPlanEditor
        value={draft.plan}
        trackName={draft.name}
        onChange={(plan) => update({ plan })}
        onNameChange={(name) => update({ name })}
        onImportNew={(name) => {
          setDraft((previous) => {
            const next = { ...previous, name, importAsNew: true }
            send('change', next)
            return next
          })
        }}
        expanded
        onExpandedChange={() => {}}
        onCancel={() => send('cancel')}
        saving={status.saving}
        statusError={status.error}
        statusSuccess={status.success}
      />
    </form>
  )
}
