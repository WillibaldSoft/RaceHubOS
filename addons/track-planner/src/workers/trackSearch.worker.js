import { searchDetailedTrackVariants } from '@racehubos/shared'
self.onmessage = ({ data }) => {
  try {
    const generator = searchDetailedTrackVariants(data.room, {
      sourcePlan: data.sourcePlan,
    })
    let next
    do {
      next = generator.next()
      if (!next.done) self.postMessage({ type: 'progress', ...next.value })
    } while (!next.done)
    self.postMessage({ type: 'result', result: next.value })
  } catch {
    self.postMessage({ type: 'error' })
  }
}
