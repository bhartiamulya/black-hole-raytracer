import { describe, it, expect } from 'vitest'
import { createRK4 } from '../src/core/integrator.js'
import { createSchwarzschildSystem, nullEnergy, StateIndex } from '../src/core/geodesic.js'
import { prepareParams, cameraFrame, pixelDirection, initialState } from '../src/render/raytracer.js'

describe('Schwarzschild null geodesics', () => {
  it('preserves null energy along integration', () => {
    const params = prepareParams({
      mass: 1,
      cameraDistance: 30,
      cameraTheta: 1.0,
      cameraPhi: 0,
      fieldOfView: 45,
      diskInnerRadius: 6,
      diskOuterRadius: 30,
      diskBrightness: 1,
      resolution: 256,
      tileSize: 64,
      maxSteps: 20000,
      stepSize: 0.04,
      exposure: 1,
      backgroundColor: [0.02, 0.02, 0.06]
    })
    const system = createSchwarzschildSystem(params.mass)
    const camera = cameraFrame(params)
    const mid = Math.floor(params.resolution / 2)
    const dir = pixelDirection(camera, mid, mid, params.resolution, params.resolution, params.fieldOfView)
    const state0 = initialState(params, system, dir)
    const energy0 = Math.abs(nullEnergy(system.mass, state0))
    const rk4 = createRK4(8)
    let state = state0
    const stepSize = params.stepSize
    for (let i = 0; i < 500; i += 1) {
      state = rk4.step(state, stepSize, system.derivative, null)
      if (state[StateIndex.r] <= 2.1 * system.mass) break
      if (state[StateIndex.r] >= params.escapeRadius) break
    }
    const energy1 = Math.abs(nullEnergy(system.mass, state))
    const tolerance = 1e-6
    expect(energy0).toBeLessThan(1e-8)
    expect(Math.abs(energy1 - energy0)).toBeLessThan(tolerance)
  })
})
