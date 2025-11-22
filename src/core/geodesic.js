const IDX_T = 0
const IDX_R = 1
const IDX_THETA = 2
const IDX_PHI = 3
const IDX_UT = 4
const IDX_UR = 5
const IDX_UTHETA = 6
const IDX_UPHI = 7

function lapse(mass, r) {
  return 1 - (2 * mass) / r
}

function invLapse(mass, r) {
  const f = lapse(mass, r)
  return 1 / f
}

function cot(theta) {
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  return c / s
}

export function createSchwarzschildSystem(mass) {
  const m = mass
  return {
    mass: m,
    derivative(context, state, out) {
      const r = state[IDX_R]
      const theta = state[IDX_THETA]
      const ut = state[IDX_UT]
      const ur = state[IDX_UR]
      const utheta = state[IDX_UTHETA]
      const uphi = state[IDX_UPHI]
      const f = lapse(m, r)
      const gammaTtr = m / (r * r * f)
      const gammaRtt = f * m / (r * r)
      const gammaRrr = m / (r * r * f)
      const gammaRthetaTheta = -f * r
      const gammaRphiPhi = gammaRthetaTheta * Math.sin(theta) * Math.sin(theta)
      const gammaThetaRTheta = 1 / r
      const gammaThetaPhiPhi = -Math.sin(theta) * Math.cos(theta)
      const gammaPhiRPhi = 1 / r
      const gammaPhiThetaPhi = cot(theta)
      out[IDX_T] = ut
      out[IDX_R] = ur
      out[IDX_THETA] = utheta
      out[IDX_PHI] = uphi
      const ut2 = ut * ut
      const ur2 = ur * ur
      const utheta2 = utheta * utheta
      const uphi2 = uphi * uphi
      out[IDX_UT] = -2 * gammaTtr * ut * ur
      out[IDX_UR] = -gammaRtt * ut2 + gammaRrr * ur2 - gammaRthetaTheta * utheta2 - gammaRphiPhi * uphi2
      out[IDX_UTHETA] = -2 * gammaThetaRTheta * ur * utheta - gammaThetaPhiPhi * uphi2
      out[IDX_UPHI] = -2 * gammaPhiRPhi * ur * uphi - 2 * gammaPhiThetaPhi * utheta * uphi
    }
  }
}

export function nullEnergy(mass, state) {
  const r = state[IDX_R]
  const theta = state[IDX_THETA]
  const ut = state[IDX_UT]
  const ur = state[IDX_UR]
  const utheta = state[IDX_UTHETA]
  const uphi = state[IDX_UPHI]
  const f = lapse(mass, r)
  const sinTheta = Math.sin(theta)
  const gtt = -(f)
  const grr = invLapse(mass, r)
  const gtheta = r * r
  const gphi = gtheta * sinTheta * sinTheta
  return gtt * ut * ut + grr * ur * ur + gtheta * utheta * utheta + gphi * uphi * uphi
}

export const StateIndex = {
  t: IDX_T,
  r: IDX_R,
  theta: IDX_THETA,
  phi: IDX_PHI,
  ut: IDX_UT,
  ur: IDX_UR,
  utheta: IDX_UTHETA,
  uphi: IDX_UPHI
}
