import React from 'react'

const sliders = [
  { key: 'mass', label: 'Mass', min: 0, max: 1, step: 0.01, scale: 'log', range: [0.1, 50], format: value => value.toFixed(2) },
  { key: 'cameraDistance', label: 'Camera Distance', min: 5, max: 200, step: 1, format: value => value.toFixed(0) },
  { key: 'cameraTheta', label: 'Camera Polar', min: 0.2, max: Math.PI - 0.2, step: 0.01, format: value => value.toFixed(2) },
  { key: 'cameraPhi', label: 'Camera Azimuth', min: -Math.PI, max: Math.PI, step: 0.01, format: value => value.toFixed(2) },
  { key: 'fieldOfView', label: 'Field Of View', min: 15, max: 90, step: 1, format: value => value.toFixed(0) },
  { key: 'diskInnerRadius', label: 'Disk Inner Radius', min: 3, max: 20, step: 0.5, format: value => value.toFixed(1) },
  { key: 'diskOuterRadius', label: 'Disk Outer Radius', min: 20, max: 200, step: 1, format: value => value.toFixed(0) },
  { key: 'diskBrightness', label: 'Disk Brightness', min: 0, max: 5, step: 0.05, format: value => value.toFixed(2) },
  { key: 'resolution', label: 'Resolution', min: 128, max: 1024, step: 64, format: value => value.toFixed(0) },
  { key: 'tileSize', label: 'Tile Size', min: 16, max: 128, step: 16, format: value => value.toFixed(0) },
  { key: 'maxSteps', label: 'Max Steps', min: 1000, max: 40000, step: 1000, format: value => value.toFixed(0) },
  { key: 'stepSize', label: 'Step Size', min: 0.01, max: 0.5, step: 0.01, format: value => value.toFixed(3) },
  { key: 'exposure', label: 'Exposure', min: 0.5, max: 2, step: 0.05, format: value => value.toFixed(2) }
]

function scaleValue(value, min, max, scale) {
  if (scale !== 'log') return value
  const [actualMin, actualMax] = min instanceof Array ? min : [null, null]
  const range = min instanceof Array ? min : null
  if (range) {
    const [low, high] = range
    const logMin = Math.log10(low)
    const logMax = Math.log10(high)
    const valueLog = logMin + value * (logMax - logMin)
    return Math.pow(10, valueLog)
  }
  return value
}

export default function ControlsPanel({ params, onChange }) {
  const sliderValue = (entry, value) => {
    if (entry.scale === 'log') {
      const [low, high] = entry.range
      const logMin = Math.log10(low)
      const logMax = Math.log10(high)
      const clamped = Math.max(low, Math.min(high, value))
      return (Math.log10(clamped) - logMin) / (logMax - logMin)
    }
    return value
  }

  const sliderDisplay = (entry, value) => {
    const formatter = entry.format || (v => v)
    return formatter(value)
  }

  const handleSlider = (key, entry) => event => {
    const raw = Number(event.target.value)
    if (entry.scale === 'log') {
      const [low, high] = entry.range
      const logMin = Math.log10(low)
      const logMax = Math.log10(high)
      const valueLog = logMin + raw * (logMax - logMin)
      const actual = Math.pow(10, valueLog)
      onChange({ ...params, [key]: actual })
    } else {
      onChange({ ...params, [key]: raw })
    }
  }

  const handleToggle = key => event => {
    onChange({ ...params, [key]: event.target.checked })
  }

  const handleNumeric = key => event => {
    const value = Number(event.target.value)
    if (Number.isFinite(value)) onChange({ ...params, [key]: value })
  }

  return (
    <div className="controls-panel">
      <div className="section">
        <div className="section-title">Simulation</div>
        <label className="toggle">
          <input type="checkbox" checked={Boolean(params.running)} onChange={handleToggle('running')} />
          <span>Rendering</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={Boolean(params.scientificMode)} onChange={handleToggle('scientificMode')} />
          <span>Scientific Mode</span>
        </label>
        {params.scientificMode && (
          <div className="scientific-options">
            <label className="toggle">
              <input type="checkbox" checked={Boolean(params.showHeatmap)} onChange={handleToggle('showHeatmap')} />
              <span>Heatmap Overlay</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={Boolean(params.showHitClassification)} onChange={handleToggle('showHitClassification')} />
              <span>Hit Classification</span>
            </label>
            <div className="debug-point">
              <label>Debug Pixel X</label>
              <input type="number" value={params.debugPixelX} onChange={handleNumeric('debugPixelX')} />
              <label>Y</label>
              <input type="number" value={params.debugPixelY} onChange={handleNumeric('debugPixelY')} />
            </div>
          </div>
        )}
      </div>
      <div className="section preset-section">
        <div className="section-title">Presets</div>
        <div className="preset-buttons">
          <button type="button" onClick={() => onChange({ ...params, request: 'preset', preset: 'quickLook' })}>Quick Look</button>
          <button type="button" onClick={() => onChange({ ...params, request: 'preset', preset: 'default' })}>Reset</button>
          <button type="button" onClick={() => onChange({ ...params, request: 'preset', preset: 'highQuality' })}>High Quality</button>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Parameters</div>
        {sliders.map(entry => (
          <div key={entry.key} className="slider">
            <label>{entry.label}: {sliderDisplay(entry, params[entry.key])}</label>
            <input
              type="range"
              min={entry.min}
              max={entry.max}
              step={entry.step}
              value={sliderValue(entry, params[entry.key])}
              onChange={handleSlider(entry.key, entry)}
            />
          </div>
        ))}
      </div>
      <div className="section">
        <button type="button" onClick={() => onChange({ ...params, request: 'start' })}>Start</button>
        <button type="button" onClick={() => onChange({ ...params, request: 'pause' })}>Pause</button>
        <button type="button" onClick={() => onChange({ ...params, request: 'cancel' })}>Cancel</button>
        <button type="button" onClick={() => onChange({ ...params, request: 'snapshot' })}>Snapshot</button>
        <button type="button" onClick={() => onChange({ ...params, request: 'benchmark' })}>Benchmark</button>
      </div>
    </div>
  )
}
