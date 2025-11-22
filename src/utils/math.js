export function vec3(x = 0, y = 0, z = 0) {
  return new Float64Array([x, y, z])
}

export function copy3(out, v) {
  out[0] = v[0]
  out[1] = v[1]
  out[2] = v[2]
  return out
}

export function add3(out, a, b) {
  out[0] = a[0] + b[0]
  out[1] = a[1] + b[1]
  out[2] = a[2] + b[2]
  return out
}

export function subtract3(out, a, b) {
  out[0] = a[0] - b[0]
  out[1] = a[1] - b[1]
  out[2] = a[2] - b[2]
  return out
}

export function scale3(out, v, s) {
  out[0] = v[0] * s
  out[1] = v[1] * s
  out[2] = v[2] * s
  return out
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross3(out, a, b) {
  const ax = a[0]
  const ay = a[1]
  const az = a[2]
  const bx = b[0]
  const by = b[1]
  const bz = b[2]
  out[0] = ay * bz - az * by
  out[1] = az * bx - ax * bz
  out[2] = ax * by - ay * bx
  return out
}

export function length3(v) {
  return Math.sqrt(dot3(v, v))
}

export function normalize3(out, v) {
  const len = length3(v)
  if (len === 0) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    return out
  }
  const inv = 1 / len
  out[0] = v[0] * inv
  out[1] = v[1] * inv
  out[2] = v[2] * inv
  return out
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function degToRad(deg) {
  return deg * Math.PI / 180
}

export function sphericalFromCartesian(v) {
  const x = v[0]
  const y = v[1]
  const z = v[2]
  const r = Math.sqrt(x * x + y * y + z * z)
  if (r === 0) {
    return { r: 0, theta: Math.PI / 2, phi: 0 }
  }
  const theta = Math.acos(clamp(z / r, -1, 1))
  const phi = Math.atan2(y, x)
  return { r, theta, phi }
}

export function cartesianFromSpherical(r, theta, phi) {
  const sinTheta = Math.sin(theta)
  const x = r * sinTheta * Math.cos(phi)
  const y = r * sinTheta * Math.sin(phi)
  const z = r * Math.cos(theta)
  return vec3(x, y, z)
}

export function basisVectorsAt(position) {
  const { r, theta, phi } = sphericalFromCartesian(position)
  const sinTheta = Math.max(Math.sin(theta), 1e-6)
  const radial = vec3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta))
  const polar = vec3(Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), -Math.sin(theta))
  const azimuthal = vec3(-Math.sin(phi), Math.cos(phi), 0)
  normalize3(radial, radial)
  normalize3(polar, polar)
  normalize3(azimuthal, azimuthal)
  return { r, theta, phi, radial, polar, azimuthal, sinTheta }
}

export function safeAcos(x) {
  return Math.acos(clamp(x, -1, 1))
}

export function projectOntoBasis(direction, basis) {
  return {
    radial: dot3(direction, basis.radial),
    polar: dot3(direction, basis.polar),
    azimuthal: dot3(direction, basis.azimuthal)
  }
}

export function nearlyZero(value, tolerance = 1e-9) {
  return Math.abs(value) < tolerance
}

export function square(value) {
  return value * value
}

export function hypot3(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z)
}

export function quaternionFromView(forward, up) {
  const f = vec3()
  normalize3(f, forward)
  const r = vec3()
  cross3(r, f, up)
  normalize3(r, r)
  const u = vec3()
  cross3(u, r, f)
  const m00 = r[0]
  const m01 = u[0]
  const m02 = -f[0]
  const m10 = r[1]
  const m11 = u[1]
  const m12 = -f[1]
  const m20 = r[2]
  const m21 = u[2]
  const m22 = -f[2]
  const trace = m00 + m11 + m22
  let qw, qx, qy, qz
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    qw = 0.25 * s
    qx = (m21 - m12) / s
    qy = (m02 - m20) / s
    qz = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    qw = (m21 - m12) / s
    qx = 0.25 * s
    qy = (m01 + m10) / s
    qz = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    qw = (m02 - m20) / s
    qx = (m01 + m10) / s
    qy = 0.25 * s
    qz = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    qw = (m10 - m01) / s
    qx = (m02 + m20) / s
    qy = (m12 + m21) / s
    qz = 0.25 * s
  }
  return { qw, qx, qy, qz }
}

export function rotateVectorByQuaternion(out, v, q) {
  const { qw, qx, qy, qz } = q
  const ix = qw * v[0] + qy * v[2] - qz * v[1]
  const iy = qw * v[1] + qz * v[0] - qx * v[2]
  const iz = qw * v[2] + qx * v[1] - qy * v[0]
  const iw = -qx * v[0] - qy * v[1] - qz * v[2]
  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy
  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz
  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx
  return out
}

export function polarToCartesian(direction, basis) {
  const result = vec3()
  const temp = vec3()
  scale3(result, basis.radial, direction.radial)
  scale3(temp, basis.polar, direction.polar)
  add3(result, result, temp)
  scale3(temp, basis.azimuthal, direction.azimuthal)
  add3(result, result, temp)
  return result
}
