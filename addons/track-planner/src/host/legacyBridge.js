import { readTrackPlan } from '@racehubos/shared'
export const LEGACY_CHANNEL = 'racehubos:track-planner:1'

// Compatibility adapter for the current experimental integration. This is not
// Anselme's future plugin API; the editor only depends on this small interface.
export function connectLegacyHost({ surface, origin, onInitialize, onStatus }) {
  function receive(event) {
    if (event.source !== surface.parent || event.origin !== origin || event.data?.channel !== LEGACY_CHANNEL) return
    const message = event.data
    if (message.type === 'init') {
      const draft = message.draft
      const plan = readTrackPlan(draft?.plan)
      if (!plan || typeof draft.name !== 'string' || draft.name.length > 150) return
      onInitialize({
        draft: { plan, name: draft.name, importAsNew: !!draft.importAsNew },
        language: ['de', 'en', 'fr'].includes(message.language) ? message.language : 'en',
        dark: message.dark === true,
      })
    }
    if (message.type === 'status' && message.status && typeof message.status === 'object')
      onStatus({
        saving: message.status.saving === true,
        error: typeof message.status.error === 'string' ? message.status.error : '',
        success: typeof message.status.success === 'string' ? message.status.success : '',
      })
  }
  surface.addEventListener('message', receive)
  surface.parent.postMessage({ channel: LEGACY_CHANNEL, type: 'ready' }, origin)
  return {
    send(type, draft) {
      if (!['change', 'save', 'cancel'].includes(type)) throw new Error('Unsupported legacy message')
      surface.parent.postMessage({ channel: LEGACY_CHANNEL, type, draft }, origin)
    },
    dispose() {
      surface.removeEventListener('message', receive)
    },
  }
}
