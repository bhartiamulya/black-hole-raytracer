export function schwarzschildMetric(mass) {
  const m = mass
  return {
    mass: m,
    lapse: r => 1 - (2 * m) / r,
    lapseSqrt: r => Math.sqrt(Math.max(1 - (2 * m) / r, 0)),
    horizonRadius: () => 2 * m,
    photonSphereRadius: () => 3 * m
  }
}

export function christoffelSymbols(mass, position) {
  const r = position[0]
  const theta = position[1]
  const m = mass
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const lapse = 1 - (2 * m) / r
  const invLapse = 1 / lapse
  const r2 = r * r
  return {
    gammaTtr: m / (r2 * lapse),
    gammaRtt: (m * lapse) / (r2),
    gammaRrr: m / (r * lapse),
    gammaRthetaTheta: -r * lapse,
    gammaRphiPhi: -r * lapse * sinTheta * sinTheta,
    gammaThetaRTheta: 1 / r,
    gammaThetaPhiPhi: -sinTheta * cosTheta,
    gammaPhiRPhi: 1 / r,
    gammaPhiThetaPhi: cosTheta / sinTheta
  }
}
