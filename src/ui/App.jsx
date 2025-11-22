import React, { useState, useRef, useEffect } from 'react'
import ControlsPanel from './ControlsPanel.jsx'
import StatsPanel from './StatsPanel.jsx'
import DiagnosticsPanel from './DiagnosticsPanel.jsx'
import { createRenderer } from '../render/renderer.js'

const defaultParams = {
  mass: 1,
  cameraDistance: 30,
  cameraTheta: 1.2,
  cameraPhi: 0,
  fieldOfView: 45,
  diskInnerRadius: 6,
  diskOuterRadius: 30,
  diskBrightness: 1,
  resolution: 384,
  tileSize: 48,
  maxSteps: 12000,
  stepSize: 0.06,
  exposure: 1,
  backgroundColor: [0.04, 0.04, 0.12],
  running: false,
  scientificMode: false,
  showHeatmap: true,
  showHitClassification: true,
  debugPixelX: 192,
  debugPixelY: 192
}

const presets = {
  quickLook: {
    resolution: 256,
    tileSize: 32,
    maxSteps: 9000,
    stepSize: 0.075,
    exposure: 1
  },
  default: {
    resolution: defaultParams.resolution,
    tileSize: defaultParams.tileSize,
    maxSteps: defaultParams.maxSteps,
    stepSize: defaultParams.stepSize,
    exposure: defaultParams.exposure,
    diskBrightness: defaultParams.diskBrightness
  },
  highQuality: {
    resolution: 768,
    tileSize: 64,
    maxSteps: 22000,
    stepSize: 0.035,
    exposure: 1.15,
    diskBrightness: 1.25
  }
}

export default function App() {
  const [params, setParams] = useState(defaultParams)
  const [renderState, setRenderState] = useState({ status: 'idle', progress: 0, eta: 0, error: null })
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const diagnosticsRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return
    rendererRef.current = createRenderer(canvas, overlay, {
      onUpdate: update => setRenderState(prev => ({ ...prev, ...update }))
    })
    rendererRef.current.configure(params)
    return () => {
      if (rendererRef.current) rendererRef.current.cancel()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!rendererRef.current) return
    rendererRef.current.configure(params)
    if (!params.scientificMode) overlayRef.current?.getContext('2d')?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)
  }, [
    params.resolution,
    params.tileSize,
    params.stepSize,
    params.mass,
    params.cameraDistance,
    params.cameraTheta,
    params.cameraPhi,
    params.fieldOfView,
    params.diskInnerRadius,
    params.diskOuterRadius,
    params.diskBrightness,
    params.exposure,
    params.showHeatmap,
    params.showHitClassification,
    params.scientificMode
  ])

  const handleParamsChange = next => {
    if (next.request === 'start') {
      const debugPixel = params.scientificMode ? {
        x: Math.max(0, Math.min(params.resolution - 1, Math.round(params.debugPixelX))),
        y: Math.max(0, Math.min(params.resolution - 1, Math.round(params.debugPixelY)))
      } : null
      rendererRef.current?.start({ ...params, running: true }, { debugPixel })
      setParams(current => ({ ...current, running: true }))
      return
    }
    if (next.request === 'pause') {
      rendererRef.current?.cancel()
      setParams(current => ({ ...current, running: false }))
      return
    }
    if (next.request === 'cancel') {
      rendererRef.current?.cancel()
      setParams(current => ({ ...current, running: false }))
      setRenderState({ status: 'idle', progress: 0, eta: 0 })
      return
    }
    if (next.request === 'snapshot') {
      const canvas = canvasRef.current
      const diagnosticsCanvas = diagnosticsRef.current
      if (canvas) {
        const url = canvas.toDataURL('image/png')
        const diagnosticsUrl = diagnosticsCanvas ? diagnosticsCanvas.toDataURL('image/png') : null
        const win = window.open()
        if (win) {
          const theoretical = params.mass * 3 * Math.sqrt(3)
          const metrics = `Mass: ${params.mass.toFixed(2)} M | Camera: r=${params.cameraDistance.toFixed(1)}, θ=${params.cameraTheta.toFixed(2)}, φ=${params.cameraPhi.toFixed(2)} | Disk: Rin=${params.diskInnerRadius.toFixed(1)}, Rout=${params.diskOuterRadius.toFixed(1)} | Shadow_theory=${theoretical.toFixed(2)} | Shadow_measured=${renderState.shadowRadius ? renderState.shadowRadius.toFixed(2) : 'n/a'} | Rays=${renderState.rays ?? 0} | Tiles=${renderState.tiles ?? 0} | MaxSteps=${renderState.maxSteps ?? 0}`
          win.document.write(`<!doctype html><html><head><title>Ray Tracer Snapshot</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#05070f;color:#d4dcff;display:flex;flex-direction:column;gap:16px;padding:16px;} .images{display:flex;gap:16px;flex-wrap:wrap;} img{max-width:48%;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:#000;} .metrics{font-size:13px;line-height:1.4;background:rgba(15,22,40,0.8);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);} </style></head><body><h2>Black Hole Ray Tracer Snapshot</h2><div class="images"><div><div>Main render</div><img src="${url}"/></div>${diagnosticsUrl ? `<div><div>Diagnostics</div><img src="${diagnosticsUrl}"/></div>` : ''}</div><div class="metrics">${metrics}</div></body></html>`)
        }
      }
      return
    }
    if (next.request === 'benchmark') {
      rendererRef.current?.benchmark(params).then(result => {
        setRenderState(current => ({ ...current, benchmark: result }))
      })
      return
    }
    if (next.request === 'preset') {
      const preset = presets[next.preset]
      if (preset) {
        const updated = { ...params, ...preset, running: false }
        setParams(updated)
        rendererRef.current?.configure(updated)
      }
      return
    }
    const { request, ...rest } = next
    setParams(rest)
  }

  return (
    <div className="app-root">
      <div className="app-main">
        <div className="canvas-column">
          <div className="canvas-layer">
            <canvas ref={canvasRef} width={params.resolution} height={params.resolution} />
            <canvas ref={overlayRef} className={params.scientificMode ? 'overlay visible' : 'overlay'} width={params.resolution} height={params.resolution} />
          </div>
        </div>
        <div className="info-column">
          <StatsPanel state={renderState} params={params} />
          <DiagnosticsPanel state={renderState} params={params} canvasRef={diagnosticsRef} />
        </div>
      </div>
      <ControlsPanel params={params} onChange={handleParamsChange} />
    </div>
  )
}
