import { HitCode, prepareParams } from './raytracer.js'

function createWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
}

function createTileQueue(width, height, tileSize) {
  const tiles = []
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      tiles.push({ x, y, width: Math.min(tileSize, width - x), height: Math.min(tileSize, height - y) })
    }
  }
  return tiles
}

function passesForResolution(resolution) {
  if (resolution <= 256) return [8, 4, 2, 1]
  if (resolution <= 512) return [8, 4, 2, 1]
  return [10, 6, 3, 2, 1]
}

function createCanvasContext(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('Failed to acquire canvas context')
  return ctx
}

export class RendererController {
  constructor(canvas, overlay, callbacks) {
    this.canvas = canvas
    this.overlay = overlay
    this.callbacks = callbacks
    this.state = {
      workers: [],
      params: null,
      tiles: [],
      active: false,
      tileSize: 64,
      passIndex: 0,
      passes: [],
      tileCursor: 0,
      startTime: 0,
      processedTiles: 0,
      totalTiles: 0,
      rays: 0,
      durations: [],
      hitMap: null,
      stepMap: null,
      debugPath: null
    }
    this.context = createCanvasContext(canvas)
    this.overlayContext = overlay.getContext('2d')
    this.maxWorkers = Math.max(1, Math.min(4, navigator.hardwareConcurrency ? navigator.hardwareConcurrency - 1 : 2))
  }

  configure(params) {
    const prepared = prepareParams(params)
    this.state.params = prepared
    this.resizeCanvas(prepared.resolution)
    this.sendUpdate({ params: prepared })
  }

  resizeCanvas(size) {
    if (this.canvas.width !== size) this.canvas.width = size
    if (this.canvas.height !== size) this.canvas.height = size
    if (this.overlay.width !== size) this.overlay.width = size
    if (this.overlay.height !== size) this.overlay.height = size
  }

  start(params, options = {}) {
    if (this.state.active) this.cancel()
    const prepared = prepareParams(params)
    this.state.params = prepared
    this.resizeCanvas(prepared.resolution)
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.overlayContext.clearRect(0, 0, this.overlay.width, this.overlay.height)
    this.state.tileSize = prepared.tileSize
    this.state.passes = passesForResolution(prepared.resolution)
    this.state.passIndex = 0
    this.state.rays = 0
    this.state.durations = []
    this.state.debugPath = null
    this.state.shadowSum = 0
    this.state.shadowWeight = 0
    this.state.maxSteps = 0
    this.state.active = true
    console.log('[Renderer] start', { resolution: prepared.resolution, tileSize: prepared.tileSize, passes: this.state.passes, workers: this.maxWorkers })
    if (prepared.scientificMode) {
      this.state.hitMap = new Uint8Array(prepared.resolution * prepared.resolution)
      this.state.stepMap = new Uint32Array(prepared.resolution * prepared.resolution)
    } else {
      this.state.hitMap = null
      this.state.stepMap = null
    }
    this.initWorkers()
    this.enqueuePass(options.debugPixel)
    this.state.startTime = performance.now()
    this.sendUpdate({ status: 'running', progress: 0 })
  }

  enqueuePass(debugPixel) {
    const params = { ...this.state.params }
    const resolution = params.resolution
    const sampleStep = this.state.passes[this.state.passIndex]
    const cadence = Math.max(1, sampleStep)
    params.stepSize = this.state.params.stepSize * cadence
    params.maxSteps = Math.max(400, Math.ceil(this.state.params.maxSteps / cadence))
    const tiles = createTileQueue(resolution, resolution, params.tileSize)
    this.state.tiles = tiles
    this.state.tileCursor = 0
    this.state.totalTiles = tiles.length * (this.state.passes.length - this.state.passIndex)
    this.state.processedTiles = 0
    this.dispatchWork(params, sampleStep, debugPixel)
  }

  dispatchWork(params, sampleStep, debugPixel) {
    const workers = this.state.workers
    for (let i = 0; i < workers.length; i += 1) {
      this.assignTile(workers[i], params, sampleStep, debugPixel)
    }
  }

  assignTile(worker, params, sampleStep, debugPixel) {
    if (!this.state.active) return
    if (this.state.tileCursor >= this.state.tiles.length) {
      if (this.state.passIndex < this.state.passes.length - 1) {
        this.state.passIndex += 1
        this.enqueuePass(debugPixel)
      } else {
        this.finish()
      }
      return
    }
    const tile = this.state.tiles[this.state.tileCursor]
    this.state.tileCursor += 1
    console.log('[Renderer] dispatch tile', { pass: this.state.passIndex, sampleStep, tile })
    worker.postMessage({
      type: 'renderTile',
      payload: {
        params,
        tile,
        width: params.resolution,
        height: params.resolution,
        sampleStep,
        pass: this.state.passIndex,
        debugPixel,
        overlays: params.scientificMode ? {
          heatmap: params.showHeatmap,
          classification: params.showHitClassification
        } : null
      }
    })
  }

  initWorkers() {
    this.terminateWorkers()
    this.state.workers = new Array(this.maxWorkers).fill(null).map(() => {
      const worker = createWorker()
      worker.onmessage = event => this.handleWorkerMessage(worker, event.data)
      worker.onerror = error => this.handleWorkerError(error)
      return worker
    })
  }

  terminateWorkers() {
    this.state.workers.forEach(worker => worker.terminate())
    this.state.workers = []
  }

  handleWorkerMessage(worker, data) {
    if (!this.state.active) return
    if (data.type === 'error') {
      console.error('Worker reported error:', data.message)
      this.sendUpdate({ status: 'error', error: data.message })
      this.cancel()
      return
    }
    if (data.type === 'tile') {
      console.log('[Renderer] tile complete', { tile: data.tile, pass: data.pass, duration: data.duration })
      this.state.rays += data.rays
      this.state.durations.push(data.duration)
      this.state.processedTiles += 1
      this.writeTile(data.tile, data.buffer)
      if (data.hitMap && data.stepMap && this.state.params.scientificMode) this.writeOverlay(data.tile, data.hitMap, data.stepMap)
      if (data.debugPath) this.state.debugPath = data.debugPath
      if (typeof data.shadowSum === 'number' && typeof data.shadowWeight === 'number') {
        if (!this.state.shadowSum) this.state.shadowSum = 0
        if (!this.state.shadowWeight) this.state.shadowWeight = 0
        this.state.shadowSum += data.shadowSum
        this.state.shadowWeight += data.shadowWeight
      }
      if (typeof data.maxSteps === 'number') {
        if (!this.state.maxSteps || data.maxSteps > this.state.maxSteps) this.state.maxSteps = data.maxSteps
      }
      const remaining = this.state.totalTiles - this.state.processedTiles
      const progress = Math.min(1, this.state.processedTiles / Math.max(1, this.state.totalTiles))
      const shadowRadius = this.computeShadowRadius()
      this.sendUpdate({ status: 'running', progress, tiles: this.state.processedTiles, rays: this.state.rays, eta: this.estimateEta(remaining), shadowRadius, maxSteps: this.state.maxSteps })
      this.assignTile(worker, this.state.params, this.state.passes[this.state.passIndex], null)
    }
  }

  handleWorkerError(error) {
    console.error('Worker error', error)
    this.sendUpdate({ status: 'error', error: error.message })
    this.cancel()
  }

  estimateEta(remaining) {
    if (this.state.durations.length === 0) return 0
    const avg = this.state.durations.reduce((a, b) => a + b, 0) / this.state.durations.length
    return (remaining * avg) / 1000
  }

  writeTile(tile, buffer) {
    const image = new ImageData(buffer, tile.width, tile.height)
    this.context.putImageData(image, tile.x, tile.y)
  }

  writeOverlay(tile, hitMap, stepMap) {
    const resolution = this.state.params.resolution
    for (let y = 0; y < tile.height; y += 1) {
      for (let x = 0; x < tile.width; x += 1) {
        const localIndex = y * tile.width + x
        const globalIndex = (tile.y + y) * resolution + (tile.x + x)
        this.state.hitMap[globalIndex] = hitMap[localIndex]
        this.state.stepMap[globalIndex] = stepMap[localIndex]
      }
    }
    if (this.state.params.scientificMode) this.drawOverlay()
  }

  drawOverlay() {
    const resolution = this.state.params.resolution
    const image = this.overlayContext.getImageData(0, 0, resolution, resolution)
    const data = image.data
    const maxSteps = this.state.params.showHeatmap ? this.state.stepMap.reduce((m, v) => Math.max(m, v), 0) : 0
    for (let i = 0; i < this.state.hitMap.length; i += 1) {
      const hit = this.state.hitMap[i]
      const steps = this.state.stepMap[i]
      let r = 0
      let g = 0
      let b = 0
      if (this.state.params.showHitClassification) {
        if (hit === HitCode.disk) {
          r = 255
          g = 120
          b = 40
        } else if (hit === HitCode.horizon) {
          r = 20
          g = 20
          b = 20
        } else if (hit === HitCode.escape) {
          r = 30
          g = 60
          b = 120
        }
      }
      if (this.state.params.showHeatmap && maxSteps > 0) {
        const intensity = steps / maxSteps
        r *= intensity
        g *= intensity
        b *= intensity
      }
      data[i * 4] = r
      data[i * 4 + 1] = g
      data[i * 4 + 2] = b
      data[i * 4 + 3] = hit === 0 ? 0 : 90
    }
    this.overlayContext.putImageData(image, 0, 0)
    if (this.state.debugPath && this.state.debugPath.points && this.state.debugPath.points.length > 0) this.drawDebugPath()
  }

  drawDebugPath() {
    const context = this.overlayContext
    const resolution = this.state.params.resolution
    const pixel = this.state.debugPath.pixel
    context.save()
    context.lineWidth = 1.5
    context.strokeStyle = 'rgba(255, 200, 80, 0.8)'
    context.beginPath()
    const scale = resolution / (this.state.params.cameraDistance * 2)
    const points = this.state.debugPath.points
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i]
      const y = points[i + 1]
      const screenX = resolution / 2 + x * scale
      const screenY = resolution / 2 - y * scale
      if (i === 0) context.moveTo(screenX, screenY)
      else context.lineTo(screenX, screenY)
    }
    context.stroke()
    context.fillStyle = 'rgba(255, 100, 50, 0.9)'
    context.beginPath()
    context.arc(pixel.x + 0.5, pixel.y + 0.5, 4, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  computeShadowRadius() {
    if (!this.state.shadowWeight || this.state.shadowWeight === 0) return null
    const measurement = this.state.shadowSum / this.state.shadowWeight
    return measurement
  }

  finish() {
    const duration = (performance.now() - this.state.startTime) / 1000
    this.state.active = false
    this.terminateWorkers()
    this.sendUpdate({ status: 'completed', duration, rays: this.state.rays, shadowRadius: this.computeShadowRadius(), maxSteps: this.state.maxSteps })
  }

  cancel() {
    this.state.active = false
    this.terminateWorkers()
    this.sendUpdate({ status: 'idle' })
  }

  benchmark(params) {
    const prepared = { ...prepareParams(params), tileSize: params.tileSize }
    const tile = { x: 0, y: 0, width: prepared.tileSize, height: prepared.tileSize }
    const worker = createWorker()
    const started = performance.now()
    return new Promise(resolve => {
      worker.onmessage = event => {
        if (event.data.type === 'tile') {
          const elapsed = performance.now() - started
          worker.terminate()
          resolve({ duration: elapsed / 1000, rays: event.data.rays })
        }
      }
      worker.postMessage({
        type: 'renderTile',
        payload: {
          params: prepared,
          tile,
          width: prepared.resolution,
          height: prepared.resolution,
          sampleStep: this.passesForBenchmark(prepared.resolution),
          pass: 0
        }
      })
    })
  }

  passesForBenchmark(resolution) {
    if (resolution <= 256) return 1
    if (resolution <= 512) return 2
    return 4
  }

  sendUpdate(extra) {
    if (this.callbacks && this.callbacks.onUpdate) this.callbacks.onUpdate({ debugPath: this.state.debugPath, ...extra })
  }
}

export function createRenderer(canvas, overlay, callbacks) {
  return new RendererController(canvas, overlay, callbacks)
}
