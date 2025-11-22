import React from 'react'

const physicsNotes = [
  { title: 'Photon Sphere', text: 'Unstable orbit at radius 3M setting the photon ring scale.' },
  { title: 'Event Horizon', text: 'Surface at 2M where null geodesics terminate.' },
  { title: 'Redshift', text: 'Combined gravitational and Doppler shift from orbiting plasma.' }
]

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a'
  return Number(value).toFixed(digits)
}

export default function StatsPanel({ state, params }) {
  const progress = Math.max(0, Math.min(1, state.progress || 0))
  const theoreticalShadow = params.mass * 3 * Math.sqrt(3)
  const measuredShadow = state.shadowRadius
  const shadowError = measuredShadow ? ((measuredShadow - theoreticalShadow) / theoreticalShadow) * 100 : null
  const benchmarkLabel = state.benchmark ? `${formatNumber(state.benchmark.duration, 2)}s • ${state.benchmark.rays} rays` : 'Tap benchmark to measure'
  const paletteNote = 'Disk palette is a single temperature-to-RGB gradient with Doppler/g-factor amplification; colours shift smoothly rather than discrete bands.'

  return (
    <aside className="stats-panel">
      <div className="stats-header">
        <div className="stats-title">Render Status</div>
        <div className={`status-pill ${state.status || 'idle'}`}>{state.status || 'idle'}</div>
      </div>
      {state.status === 'error' && state.error && (
        <div className="error-banner">
          <div className="error-title">Worker error</div>
          <div className="error-message">{state.error}</div>
        </div>
      )}
      <div className="progress-row">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="stats-grid">
        <div>
          <div className="stat-title">ETA</div>
          <div className="stat-value">{state.eta ? `${state.eta.toFixed(1)}s` : '—'}</div>
        </div>
        <div>
          <div className="stat-title">Tiles</div>
          <div className="stat-value">{state.tiles ?? 0}</div>
        </div>
        <div>
          <div className="stat-title">Rays Traced</div>
          <div className="stat-value">{state.rays ?? 0}</div>
        </div>
        <div>
          <div className="stat-title">Max Steps</div>
          <div className="stat-value">{state.maxSteps ?? 0}</div>
        </div>
      </div>
      <div className="shadow-metrics">
        <div>
          <div className="metric-label">Theoretical Shadow</div>
          <div className="metric-value">{formatNumber(theoreticalShadow)}</div>
        </div>
        <div>
          <div className="metric-label">Measured Shadow</div>
          <div className="metric-value">{measuredShadow ? formatNumber(measuredShadow) : 'n/a'}</div>
        </div>
        <div>
          <div className="metric-label">Error</div>
          <div className="metric-value error">{shadowError === null ? 'n/a' : `${formatNumber(shadowError)}%`}</div>
        </div>
      </div>
      <div className="benchmark-row">
        <div className="metric-label">Benchmark</div>
        <div className="metric-value">{benchmarkLabel}</div>
      </div>
      <div className="mode-row">
        <div className="metric-label">Mode</div>
        <div className="metric-value">{params.scientificMode ? 'Scientific' : 'Standard'}</div>
      </div>
      <div className="palette-note">{paletteNote}</div>
      <div className="stats-notes">
        {physicsNotes.map(note => (
          <div key={note.title} className="note">
            <div className="note-title">{note.title}</div>
            <div className="note-text">{note.text}</div>
          </div>
        ))}
      </div>
    </aside>
  )
}
