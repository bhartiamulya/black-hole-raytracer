import { renderTile, prepareParams } from './raytracer.js'

let active = true

function postError(error, context = {}) {
  const message = error && error.message ? error.message : String(error)
  const stack = error && error.stack ? error.stack : null
  self.postMessage({
    type: 'error',
    message,
    stack,
    context
  })
}

self.onmessage = event => {
  const { type, payload } = event.data
  if (type === 'cancel') {
    active = false
    return
  }
  if (type === 'renderTile') {
    if (!active) active = true
    try {
      const started = performance.now()
      const prepared = {
        ...payload,
        params: prepareParams(payload.params)
      }
      const { buffer, hitMap, stepMap, rays, debugPath, shadowSum, shadowWeight, maxSteps } = renderTile(prepared)
      const duration = performance.now() - started
      if (!active) return
      const transferables = [buffer.buffer]
      if (hitMap) transferables.push(hitMap.buffer)
      if (stepMap) transferables.push(stepMap.buffer)
      self.postMessage({
        type: 'tile',
        tile: payload.tile,
        pass: payload.pass,
        buffer,
        hitMap,
        stepMap,
        debugPath,
        shadowSum,
        shadowWeight,
        maxSteps,
        duration,
        rays
      }, transferables)
    } catch (error) {
      postError(error, { tile: payload.tile, pass: payload.pass })
    }
  }
}
