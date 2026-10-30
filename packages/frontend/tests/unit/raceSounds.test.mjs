import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRaceSounds, soundActivity, soundKinds, createRaceAudio } from '../../src/lib/raceSounds.mjs'

test('settings clamp invalid values and retain individually disabled sounds', () => {
  const config = normalizeRaceSounds({ volume: 20, intensity: -1, crowd: false, pit: false, enabled: false })
  assert.equal(config.volume, 1)
  assert.equal(config.intensity, 0)
  assert.equal(config.crowd, false)
  assert.equal(config.pit, false)
  assert.equal(config.enabled, false)
  assert.equal(config.engine, true)
  assert.equal(normalizeRaceSounds({ volume: NaN }).volume, 0.35)
})
test('more drivers reduce both volume and effect frequency; automatic adaptation can be disabled', () => {
  const config = normalizeRaceSounds(null)
  let previous = soundActivity(config, 1)
  for (let drivers = 2; drivers <= 6; drivers++) {
    const next = soundActivity(config, drivers)
    assert.ok(next.volume < previous.volume)
    assert.ok(next.delay > previous.delay)
    previous = next
  }
  assert.deepEqual(soundActivity({ ...config, adaptive: false }, 1), soundActivity({ ...config, adaptive: false }, 6))
})
function audioHarness() {
  const sources = [],
    requests = []
  const oldAudio = globalThis.AudioContext,
    oldFetch = globalThis.fetch
  let decode = async () => ({ duration: 8 })
  class AudioContext {
    state = 'running'
    destination = {}
    decodeAudioData(data) {
      return decode(data)
    }
    createBufferSource() {
      const source = {
        connect() {},
        disconnect() {},
        start() {
          this.started = true
        },
        stop() {
          this.stopped = true
        },
      }
      sources.push(source)
      return source
    }
    createGain() {
      return { gain: { value: 0 }, connect() {}, disconnect() {} }
    }
    close() {
      this.state = 'closed'
      return Promise.resolve()
    }
  }
  globalThis.AudioContext = AudioContext
  globalThis.fetch = async (url) => {
    requests.push(url)
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
  }
  return {
    sources,
    requests,
    setDecode(fn) {
      decode = fn
    },
    restore() {
      globalThis.fetch = oldFetch
      if (oldAudio) globalThis.AudioContext = oldAudio
      else delete globalThis.AudioContext
    },
  }
}

test('real clips load locally, cache decoding, alternate crowd recordings and stop on cleanup', async () => {
  const h = audioHarness()
  try {
    const engine = createRaceAudio()
    assert.equal(await engine.play('crowd', 1), 0, 'no playback before unlock')
    assert.equal(h.requests.length, 0)
    engine.unlock()
    for (const kind of Object.keys(soundKinds)) assert.equal(await engine.play(kind, 0.5), 8)
    assert.equal(h.requests.length, 4)
    await engine.play('engine', 0.5)
    assert.equal(h.requests.length, 4, 'decoded recording reused')
    await engine.play('crowd', 0.5)
    assert.equal(h.requests.length, 5, 'second crowd excerpt')
    assert.ok(h.requests.every((url) => url.startsWith('/sounds/racing/') && url.endsWith('.mp3')))
    assert.equal(await engine.play('engine', NaN), 0)
    assert.equal(await engine.play('engine', 0), 0)
    engine.close()
    assert.ok(h.sources.every((source) => source.started && source.stopped))
    assert.equal(await engine.play('crowd', 1), 0)
  } finally {
    h.restore()
  }
})

test('pause or close during a pending decode cannot cause delayed playback', async () => {
  const h = audioHarness()
  try {
    for (const action of ['stop', 'close']) {
      let resolve, began
      const decoding = new Promise((r) => {
        began = r
      })
      h.setDecode(() => {
        began()
        return new Promise((r) => {
          resolve = r
        })
      })
      const engine = createRaceAudio()
      engine.unlock()
      const pending = engine.play('engine', 0.5)
      await decoding
      engine[action]()
      resolve({ duration: 13 })
      assert.equal(await pending, 0)
      assert.equal(h.sources.length, 0)
      engine.close()
    }
  } finally {
    h.restore()
  }
})

test('failed loads can retry and all declared recordings ship with source credits', async () => {
  const h = audioHarness()
  try {
    const engine = createRaceAudio()
    engine.unlock()
    globalThis.fetch = async () => ({ ok: false })
    await assert.rejects(engine.play('engine', 0.5), /Tonaufnahme/)
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    assert.equal(await engine.play('engine', 0.5), 8)
    engine.close()
  } finally {
    h.restore()
  }
  const { readFile } = await import('node:fs/promises')
  const { raceSoundClips } = await import('../../src/lib/raceSounds.mjs')
  const root = new URL('../../public/sounds/racing/', import.meta.url)
  const credits = await readFile(new URL('CREDITS.md', root), 'utf8')
  for (const clip of Object.values(raceSoundClips).flat()) {
    const data = await readFile(new URL(clip, root))
    assert.ok(data.length > 10000, clip)
    assert.equal(data.subarray(0, 3).toString(), 'ID3', clip)
    assert.ok(credits.includes(clip))
  }
})
