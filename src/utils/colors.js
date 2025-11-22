function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function linearToSrgb(x) {
  if (x <= 0.0031308) return 12.92 * x
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

export function toneMap(rgb, exposure = 1) {
  const mapped = new Float32Array(3)
  for (let i = 0; i < 3; i += 1) {
    const v = 1 - Math.exp(-rgb[i] * exposure)
    mapped[i] = clamp01(linearToSrgb(v))
  }
  return mapped
}

export function temperatureToRGB(temp, intensity) {
  const t = temp / 5778
  const r = clamp01(1.5 * Math.pow(t, 0.6))
  const g = clamp01(1.2 * Math.pow(t, 0.5))
  const b = clamp01(2.0 * Math.pow(t, 0.4))
  return [r * intensity, g * intensity, b * intensity]
}

export function mixColors(a, b, t) {
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t
  ]
}

export function toUint8Clamped(rgb) {
  const out = new Uint8ClampedArray(4)
  out[0] = Math.round(clamp01(rgb[0]) * 255)
  out[1] = Math.round(clamp01(rgb[1]) * 255)
  out[2] = Math.round(clamp01(rgb[2]) * 255)
  out[3] = 255
  return out
}
