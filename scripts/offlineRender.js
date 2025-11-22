import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { renderTile, prepareParams, HitCode } from '../src/render/raytracer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const defaults = {
  mass: 1,
  cameraDistance: 30,
  cameraTheta: 1.2,
  cameraPhi: 0,
  fieldOfView: 45,
  diskInnerRadius: 6,
  diskOuterRadius: 30,
  diskBrightness: 1,
  resolution: 800,
  tileSize: 128,
  maxSteps: 24000,
  stepSize: 0.04,
  exposure: 1.15,
  backgroundColor: [0.04, 0.04, 0.12],
  scientificMode: true,
  showHeatmap: false,
  showHitClassification: true
}

const args = process.argv.slice(2)
const overrides = {}
for (const entry of args) {
  const [key, value] = entry.split('=')
  if (key && value && key in defaults) {
    try {
      const numeric = Number(value)
      overrides[key] = Number.isNaN(numeric) ? value : numeric
    } catch (err) {
      continue
    }
  }
}

async function ensureDir(target) {
  await mkdir(target, { recursive: true })
}

function buildFilename(label) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  return `${label}_${stamp}`
}

function classifyHits(hitMap) {
  const counts = {
    escape: 0,
    horizon: 0,
    disk: 0,
    numerical: 0,
    max: 0
  }
  if (!hitMap) return counts
  for (const code of hitMap) {
    if (code === HitCode.horizon) counts.horizon += 1
    else if (code === HitCode.disk) counts.disk += 1
    else if (code === HitCode.escape) counts.escape += 1
    else if (code === HitCode.numerical) counts.numerical += 1
    else if (code === HitCode.max) counts.max += 1
  }
  return counts
}

async function renderFrame() {
  const params = { ...defaults, ...overrides }
  const prepared = prepareParams(params)
  const resolution = prepared.resolution
  const tile = { x: 0, y: 0, width: resolution, height: resolution }
  const { buffer, hitMap, stepMap, rays, shadowSum, shadowWeight } = renderTile({
    params: prepared,
    tile,
    width: resolution,
    height: resolution,
    sampleStep: 1,
    debugPixel: null,
    overlays: prepared.scientificMode ? { classification: prepared.showHitClassification, heatmap: prepared.showHeatmap } : null
  })
  const png = new PNG({ width: resolution, height: resolution })
  png.data = Buffer.from(buffer)
  const pngBuffer = PNG.sync.write(png)
  const outputDir = path.resolve(__dirname, '../examples/renders')
  await ensureDir(outputDir)
  const basename = buildFilename('schwarzschild')
  const imagePath = path.join(outputDir, `${basename}.png`)
  await writeFile(imagePath, pngBuffer)
  const counts = classifyHits(hitMap)
  const measurement = shadowWeight > 0 ? shadowSum / shadowWeight : null
  let minSteps = null
  let maxSteps = null
  let sumSteps = 0
  if (stepMap) {
    const length = stepMap.length
    for (let i = 0; i < length; i += 1) {
      const value = stepMap[i]
      if (minSteps === null || value < minSteps) minSteps = value
      if (maxSteps === null || value > maxSteps) maxSteps = value
      sumSteps += value
    }
    if (length > 0) {
      sumSteps /= length
    } else {
      sumSteps = null
      minSteps = null
      maxSteps = null
    }
  }
  const metadata = {
    params: prepared,
    resolution,
    rays,
    shadowRadius: measurement,
    histogram: counts,
    timestamp: new Date().toISOString(),
    stepSummary: {
      min: minSteps,
      max: maxSteps,
      mean: stepMap ? sumSteps : null
    }
  }
  const metaPath = path.join(outputDir, `${basename}.json`)
  await writeFile(metaPath, JSON.stringify(metadata, null, 2))
  console.log(`Saved render -> ${imagePath}`)
  console.log(`Metadata -> ${metaPath}`)
  if (measurement) {
    console.log(`Measured shadow radius: ${measurement.toFixed(3)} (theoretical ${ (params.mass * 3 * Math.sqrt(3)).toFixed(3) })`)
  }
}

renderFrame().catch(error => {
  console.error('Offline render failed', error)
  process.exitCode = 1
})
