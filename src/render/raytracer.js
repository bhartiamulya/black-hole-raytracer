import { createRK4 } from '../core/integrator.js'
import { createSchwarzschildSystem, StateIndex, nullEnergy } from '../core/geodesic.js'
import { vec3, normalize3, cross3, scale3, add3, sphericalFromCartesian, cartesianFromSpherical, basisVectorsAt, projectOntoBasis, clamp, length3, dot3 } from '../utils/math.js'
import { diskRadiance, applyRelativisticTransfer, dopplerShiftFactor } from '../core/physics.js'

const rk4 = createRK4(8)

const HitCode = {
  escape: 0,
  horizon: 1,
  disk: 2,
  numerical: 3,
  max: 4
}

function ensureBasis(normalizedForward) {
  const worldUp = vec3(0, 0, 1)
  const crossCandidate = vec3()
  cross3(crossCandidate, normalizedForward, worldUp)
  if (length3(crossCandidate) < 1e-6) {
    worldUp[0] = 0
    worldUp[1] = 1
    worldUp[2] = 0
  }
  const right = vec3()
  cross3(right, normalizedForward, worldUp)
  normalize3(right, right)
  const up = vec3()
  cross3(up, right, normalizedForward)
  normalize3(up, up)
  return { right, up }
}

export function cameraFrame(params) {
  const position = vec3(
    params.cameraPosition[0],
    params.cameraPosition[1],
    params.cameraPosition[2]
  )
  const forward = vec3()
  scale3(forward, position, -1)
  normalize3(forward, forward)
  const basis = ensureBasis(forward)
  return { position, forward, right: basis.right, up: basis.up }
}

export function pixelDirection(camera, x, y, width, height, fov) {
  const aspect = width / height
  const scale = Math.tan((fov * Math.PI / 180) / 2)
  const ndcX = (2 * ((x + 0.5) / width) - 1) * scale * aspect
  const ndcY = (1 - 2 * ((y + 0.5) / height)) * scale
  const dir = vec3()
  scale3(dir, camera.forward, 1)
  const horizontal = vec3()
  scale3(horizontal, camera.right, ndcX)
  add3(dir, dir, horizontal)
  const vertical = vec3()
  scale3(vertical, camera.up, ndcY)
  add3(dir, dir, vertical)
  normalize3(dir, dir)
  return dir
}

export function initialState(params, system, direction) {
  const position = vec3(
    params.cameraPosition[0],
    params.cameraPosition[1],
    params.cameraPosition[2]
  )
  const spherical = sphericalFromCartesian(position)
  const base = basisVectorsAt(position)
  const components = projectOntoBasis(direction, base)
  const r = spherical.r
  const theta = spherical.theta
  const phi = spherical.phi
  const sinTheta = Math.sin(theta)
  const f = 1 - (2 * system.mass) / r
  const invSqrtGr = Math.sqrt(f)
  const ur = components.radial * invSqrtGr
  const utheta = components.polar / r
  const uphi = components.azimuthal / (r * Math.max(sinTheta, 1e-6))
  const grr = 1 / f
  const gtheta = r * r
  const gphi = gtheta * sinTheta * sinTheta
  const spatial = grr * ur * ur + gtheta * utheta * utheta + gphi * uphi * uphi
  const ut = Math.sqrt(spatial / f)
  const state = new Float64Array(8)
  state[StateIndex.t] = 0
  state[StateIndex.r] = r
  state[StateIndex.theta] = theta
  state[StateIndex.phi] = phi
  state[StateIndex.ut] = ut
  state[StateIndex.ur] = ur
  state[StateIndex.utheta] = utheta
  state[StateIndex.uphi] = uphi
  const energy = nullEnergy(system.mass, state)
  if (Math.abs(energy) > 1e-6) {
    const scale = 1 / Math.sqrt(Math.max(Math.abs(energy), 1e-9))
    state[StateIndex.ut] *= scale
    state[StateIndex.ur] *= scale
    state[StateIndex.utheta] *= scale
    state[StateIndex.uphi] *= scale
  }
  return state
}

function integrate(params, system, state, capturePath) {
  const stepSize = params.stepSize
  const maxSteps = params.maxSteps
  const horizon = system.mass * 2 * (1 + 1e-3)
  const diskInner = params.diskInnerRadius
  const diskOuter = params.diskOuterRadius
  const background = params.backgroundColor
  const current = new Float64Array(state)
  let prevTheta = current[StateIndex.theta]
  let prevR = current[StateIndex.r]
  let prevPoint = null
  const pathPoints = []
  for (let i = 0; i < maxSteps; i += 1) {
    if (capturePath) {
      const point = cartesianFromSpherical(current[StateIndex.r], current[StateIndex.theta], current[StateIndex.phi])
      if (!prevPoint || length3(point) - length3(prevPoint) > 0.05) {
        pathPoints.push(point)
        prevPoint = point
      }
    }
    const next = rk4.step(current, stepSize, system.derivative, null)
    const r = next[StateIndex.r]
    const theta = next[StateIndex.theta]
    if (!Number.isFinite(r) || !Number.isFinite(theta)) {
      return { color: background, hit: HitCode.numerical, steps: i + 1, path: capturePath ? pathPoints : null }
    }
    if (r <= horizon) {
      return { color: [0, 0, 0], hit: HitCode.horizon, steps: i + 1, path: capturePath ? pathPoints : null }
    }
    if (r >= params.escapeRadius) {
      return { color: background, hit: HitCode.escape, steps: i + 1, path: capturePath ? pathPoints : null }
    }
    const prevDiff = prevTheta - Math.PI / 2
    const diff = theta - Math.PI / 2
    const crossed = prevDiff === 0 ? Math.abs(diff) < 1e-4 : prevDiff * diff <= 0
    if (crossed) {
      const radius = 0.5 * (prevR + r)
      if (radius >= diskInner && radius <= diskOuter) {
        const g = dopplerShiftFactor(system.mass, next)
        const base = diskRadiance(radius, params, system.mass)
        const color = applyRelativisticTransfer(base, g, params.exposure)
        return { color, hit: HitCode.disk, steps: i + 1, path: capturePath ? pathPoints : null }
      }
    }
    current.set(next)
    prevTheta = theta
    prevR = r
  }
  return { color: background, hit: HitCode.max, steps: maxSteps, path: capturePath ? pathPoints : null }
}

function writePixel(buffer, index, color) {
  buffer[index] = clamp(color[0], 0, 1) * 255
  buffer[index + 1] = clamp(color[1], 0, 1) * 255
  buffer[index + 2] = clamp(color[2], 0, 1) * 255
  buffer[index + 3] = 255
}

function impactParameter(mass, state) {
  const r = state[StateIndex.r]
  const theta = state[StateIndex.theta]
  const ut = state[StateIndex.ut]
  const utheta = state[StateIndex.utheta]
  const uphi = state[StateIndex.uphi]
  const f = 1 - (2 * mass) / r
  const energy = f * ut
  const sinTheta = Math.sin(theta)
  const lSquared = (r * r) * (r * r) * (utheta * utheta + sinTheta * sinTheta * uphi * uphi)
  if (energy <= 0) return null
  return Math.sqrt(Math.max(lSquared, 0)) / energy
}

export function renderTile(payload) {
  const { params, tile, width, height, sampleStep, debugPixel, overlays } = payload
  const system = createSchwarzschildSystem(params.mass)
  const camera = cameraFrame(params)
  const pixelsPerTile = tile.width * tile.height
  const buffer = new Uint8ClampedArray(pixelsPerTile * 4)
  const hitMap = overlays && overlays.classification ? new Uint8Array(pixelsPerTile) : null
  const stepMap = overlays && overlays.heatmap ? new Uint16Array(pixelsPerTile) : null
  let raySteps = 0
  let debugPath = null
  let shadowSum = 0
  let shadowWeight = 0
  let maxSteps = 0
  const aspect = width / height
  const filmScale = Math.tan((params.fieldOfView * Math.PI / 180) / 2)
  const lapseFactor = Math.max(1 - (2 * params.mass) / params.cameraDistance, 1e-6)
  const step = Math.max(1, sampleStep || 1)
  const measureShadow = step === 1
  for (let localY = 0; localY < tile.height; localY += step) {
    for (let localX = 0; localX < tile.width; localX += step) {
      const pixelX = tile.x + localX
      const pixelY = tile.y + localY
      if (pixelX >= width || pixelY >= height) continue
      const direction = pixelDirection(camera, pixelX, pixelY, width, height, params.fieldOfView)
      const state = initialState(params, system, direction)
      const capturePath = debugPixel && debugPixel.x === pixelX && debugPixel.y === pixelY
      const trace = integrate(params, system, state, capturePath)
      raySteps += trace.steps
      if (measureShadow && trace.hit === HitCode.horizon) {
        const impact = impactParameter(system.mass, state)
        const value = impact || 0
        const blockW = Math.min(step, tile.width - localX)
        const blockH = Math.min(step, tile.height - localY)
        const weight = blockW * blockH
        shadowSum += value * weight
        shadowWeight += weight
      }
      if (trace.steps > maxSteps) maxSteps = trace.steps
      if (trace.path) {
        const flat = new Float32Array(trace.path.length * 3)
        for (let i = 0; i < trace.path.length; i += 1) {
          const p = trace.path[i]
          flat[i * 3] = p[0]
          flat[i * 3 + 1] = p[1]
          flat[i * 3 + 2] = p[2]
        }
        debugPath = { points: flat, pixel: { x: pixelX, y: pixelY } }
      }
      for (let oy = 0; oy < step && localY + oy < tile.height; oy += 1) {
        for (let ox = 0; ox < step && localX + ox < tile.width; ox += 1) {
          const index = (localY + oy) * tile.width + (localX + ox)
          const baseIndex = index * 4
          writePixel(buffer, baseIndex, trace.color)
          if (hitMap) hitMap[index] = trace.hit
          if (stepMap) stepMap[index] = trace.steps
        }
      }
    }
  }
  return { buffer, hitMap, stepMap, rays: raySteps, debugPath, shadowSum, shadowWeight, maxSteps }
}

export function prepareParams(raw) {
  const mass = raw.mass
  const distance = raw.cameraDistance
  const theta = raw.cameraTheta
  const phi = raw.cameraPhi
  const positionVec = cartesianFromSpherical(distance, theta, phi)
  const escapeRadius = raw.escapeRadius || distance * 4
  const exposure = raw.exposure || 1
  const backgroundColor = raw.backgroundColor || [0.02, 0.02, 0.06]
  return {
    ...raw,
    mass,
    cameraPosition: [positionVec[0], positionVec[1], positionVec[2]],
    escapeRadius,
    exposure,
    backgroundColor
  }
}

export { HitCode }
