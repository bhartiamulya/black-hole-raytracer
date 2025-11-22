export function createRK4(dim) {
  const k1 = new Float64Array(dim)
  const k2 = new Float64Array(dim)
  const k3 = new Float64Array(dim)
  const k4 = new Float64Array(dim)
  const temp = new Float64Array(dim)
  const next = new Float64Array(dim)
  return {
    step(state, h, derivative, context) {
      derivative(context, state, k1)
      for (let i = 0; i < dim; i += 1) temp[i] = state[i] + 0.5 * h * k1[i]
      derivative(context, temp, k2)
      for (let i = 0; i < dim; i += 1) temp[i] = state[i] + 0.5 * h * k2[i]
      derivative(context, temp, k3)
      for (let i = 0; i < dim; i += 1) temp[i] = state[i] + h * k3[i]
      derivative(context, temp, k4)
      for (let i = 0; i < dim; i += 1) next[i] = state[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
      return next
    }
  }
}
