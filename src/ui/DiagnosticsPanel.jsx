import React, { useRef, useEffect } from 'react'

function drawAxes(ctx, size, padding) {
  const mid = size / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, mid)
  ctx.lineTo(size - padding, mid)
  ctx.moveTo(mid, padding)
  ctx.lineTo(mid, size - padding)
  ctx.stroke()
}

function drawCircle(ctx, radius, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()
}

function drawDebugPath(ctx, debugPath, scale) {
  if (!debugPath || !debugPath.points) return
  const points = debugPath.points
  ctx.strokeStyle = 'rgba(255, 200, 80, 0.85)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i] * scale
    const y = -points[i + 1] * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

export default function DiagnosticsPanel({ state, params, canvasRef }) {
  const localRef = useRef(null)
  const targetRef = canvasRef || localRef
  const size = 320
  const padding = 20

  useEffect(() => {
    const canvas = targetRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, size, size)
    ctx.save()
    const mid = size / 2
    ctx.translate(mid, mid)
    drawAxes(ctx, size, padding)
    const theoretical = params.mass * 3 * Math.sqrt(3)
    const measured = state.shadowRadius || theoretical
    const scale = (size / 2 - padding) / Math.max(theoretical * 1.2, 1)
    ctx.save()
    drawCircle(ctx, theoretical * scale, 'rgba(120, 180, 255, 0.8)')
    drawCircle(ctx, measured * scale, 'rgba(255, 120, 120, 0.9)')
    ctx.restore()
    drawDebugPath(ctx, state.debugPath, scale / 5)
    ctx.restore()

    ctx.fillStyle = '#c8d3ff'
    ctx.font = '12px "Inter", sans-serif'
    ctx.fillText(`Mass: ${params.mass.toFixed(2)} M`, 12, size - 70)
    ctx.fillText(`Shadow (theoretical): ${theoretical.toFixed(2)}`, 12, size - 52)
    ctx.fillText(`Shadow (measured): ${state.shadowRadius ? state.shadowRadius.toFixed(2) : 'n/a'}`, 12, size - 34)
    ctx.fillText(`Rays traced: ${state.rays ?? 0}`, 12, size - 16)
  }, [state, params])

  return (
    <div className="diagnostics-panel">
      <header>
        <h3>Diagnostics Canvas</h3>
        <p>Comparing theoretical vs. measured shadow with sampled geodesic overlay.</p>
      </header>
      <canvas ref={targetRef} width={size} height={size} />
    </div>
  )
}
