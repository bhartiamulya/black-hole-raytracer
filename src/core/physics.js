import { StateIndex } from './geodesic.js'
import { temperatureToRGB, toneMap } from '../utils/colors.js'

const sigma = 5.670374419e-8

export function schwarzschildEnergyAtInfinity(mass, state) {
  const r = state[StateIndex.r]
  const f = 1 - (2 * mass) / r
  const gtt = -f
  return -gtt * state[StateIndex.ut]
}

export function photonCovariant(mass, state) {
  const r = state[StateIndex.r]
  const theta = state[StateIndex.theta]
  const f = 1 - (2 * mass) / r
  const sinTheta = Math.sin(theta)
  const gtt = -f
  const grr = 1 / f
  const gtheta = r * r
  const gphi = gtheta * sinTheta * sinTheta
  return {
    t: gtt * state[StateIndex.ut],
    r: grr * state[StateIndex.ur],
    theta: gtheta * state[StateIndex.utheta],
    phi: gphi * state[StateIndex.uphi]
  }
}

export function diskAngularVelocity(mass, radius) {
  return Math.sqrt(mass / (radius * radius * radius))
}

export function diskFourVelocity(mass, radius) {
  const omega = diskAngularVelocity(mass, radius)
  const f = 1 - (2 * mass) / radius
  const denominator = Math.sqrt(1 - (3 * mass) / radius)
  const ut = 1 / denominator
  const uphi = omega * ut
  return { ut, uphi }
}

export function dopplerShiftFactor(mass, state) {
  const r = state[StateIndex.r]
  const cov = photonCovariant(mass, state)
  const u = diskFourVelocity(mass, r)
  const gtt = -(1 - (2 * mass) / r)
  const gphi = r * r * Math.sin(state[StateIndex.theta]) ** 2
  const numerator = schwarzschildEnergyAtInfinity(mass, state)
  const denominator = -(cov.t * u.ut + gphi * state[StateIndex.uphi] * u.uphi)
  if (!isFinite(denominator) || denominator <= 0) return 0
  return numerator / denominator
}

export function gravitationalRedshift(mass, radius) {
  return Math.sqrt(1 - (2 * mass) / radius)
}

export function diskTemperature(radius, params, mass) {
  const inner = Math.max(params.diskInnerRadius, 2.01 * mass)
  const outer = Math.max(params.diskOuterRadius, inner + 1)
  const clamped = Math.min(Math.max(radius, inner), outer)
  const exponent = -0.75
  const normalized = Math.pow(clamped / inner, exponent)
  const base = params.diskBrightness
  const flux = base * normalized
  const temp = Math.pow(flux / sigma, 0.25)
  return temp
}

export function diskRadiance(radius, params, mass) {
  const temp = diskTemperature(radius, params, mass)
  const rgb = temperatureToRGB(temp, 1)
  return rgb
}

export function applyRelativisticTransfer(rgb, g, exposure) {
  if (g <= 0) return [0, 0, 0]
  const scale = Math.pow(g, 4)
  const scaled = rgb.map(v => v * scale)
  const mapped = toneMap(scaled, exposure)
  return [mapped[0], mapped[1], mapped[2]]
}
