/**
 * Simplex 2D Noise implementation (patent expired Jan 8, 2022).
 * Zero external dependencies - uses xoshiro128** PRNG for seeded permutation table.
 *
 * References:
 * - Simplex noise: Ken Perlin, "Improving Noise" (2002)
 * - fBM / ridged multifractal: Inigo Quilez, The Book of Shaders
 * - Domain warping: Inigo Quilez (iquilezles.org/articles/warp)
 */

// --- PRNG ---

function xoshiro128(seed: number): () => number {
  let s0 = seed | 0 || 1
  let s1 = (seed ^ 0xDEADBEEF) | 0
  let s2 = (seed ^ 0x12345678) | 0
  let s3 = (seed ^ 0xCAFEBABE) | 0
  return () => {
    const t = (s1 << 9) | 0
    let r = (s0 + s3) | 0
    r = ((r << 7) | (r >>> 25)) * 9
    s2 ^= s0
    s3 ^= s1
    s1 ^= s2
    s0 ^= s3
    s2 ^= t
    s3 = (s3 << 11) | (s3 >>> 21)
    return (r >>> 0) / 0xFFFFFFFF
  }
}

// --- Simplex 2D ---

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

export class SimplexNoise2D {
  private perm: Uint8Array

  constructor(seed: number) {
    const rng = xoshiro128(seed)
    this.perm = new Uint8Array(512)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = p[i]
      p[i] = p[j]
      p[j] = tmp
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }

  sample(x: number, y: number): number {
    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const t = (i + j) * G2
    const x0 = x - (i - t)
    const y0 = y - (j - t)

    let i1: number, j1: number
    if (x0 > y0) { i1 = 1; j1 = 0 }
    else { i1 = 0; j1 = 1 }

    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255

    const gi0 = this.perm[ii + this.perm[jj]] & 7
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] & 7
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] & 7

    let n0 = 0, n1 = 0, n2 = 0

    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0) }

    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1) }

    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2) }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2)
  }
}

// --- Utility functions ---

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export interface FbmOptions {
  octaves?: number
  persistence?: number
  lacunarity?: number
  scale?: number
}

/**
 * Fractal Brownian Motion - layered noise for natural terrain.
 * Returns value in [0, 1].
 */
export function fbm(
  noise: SimplexNoise2D,
  x: number,
  y: number,
  opts: FbmOptions = {},
): number {
  const octaves = opts.octaves ?? 6
  const persistence = opts.persistence ?? 0.5
  const lacunarity = opts.lacunarity ?? 2.0
  const scale = opts.scale ?? 1.0

  let value = 0
  let amplitude = 1.0
  let frequency = scale
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise.sample(x * frequency, y * frequency)
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }

  // Normalize from [-1,1] range to [0,1]
  return (value / maxValue + 1) * 0.5
}

/**
 * Ridged multifractal noise - creates sharp mountain ridges.
 * Based on Musgrove's ridged multifractal (Texturing & Modeling, 1998).
 * Returns value in [0, 1].
 */
export function ridgedFbm(
  noise: SimplexNoise2D,
  x: number,
  y: number,
  opts: FbmOptions = {},
): number {
  const octaves = opts.octaves ?? 4
  const persistence = opts.persistence ?? 0.5
  const lacunarity = opts.lacunarity ?? 2.1
  const scale = opts.scale ?? 1.0
  const gain = 2.0

  let signal = 0
  let amplitude = 1.0
  let frequency = scale
  let weight = 1.0
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    let n = noise.sample(x * frequency, y * frequency)
    n = 1.0 - Math.abs(n) // Ridge inversion
    n = n * n             // Sharpen ridges
    signal += n * amplitude * weight
    maxValue += amplitude
    weight = clamp(n * gain, 0, 1)
    amplitude *= persistence
    frequency *= lacunarity
  }

  return clamp(signal / maxValue, 0, 1)
}

/**
 * Domain warping - distorts coordinates with noise for organic shapes.
 * Based on Inigo Quilez technique (iquilezles.org/articles/warp).
 * Returns warped coordinate offsets.
 */
export function domainWarp(
  noise: SimplexNoise2D,
  x: number,
  y: number,
  opts: { strength?: number; scale?: number } = {},
): { x: number; y: number } {
  const strength = opts.strength ?? 3.0
  const scale = opts.scale ?? 0.025

  // First level warp
  const qx = fbm(noise, x * scale + 0.0, y * scale + 0.0, { octaves: 4, scale: 1.0 })
  const qy = fbm(noise, x * scale + 5.2, y * scale + 1.3, { octaves: 4, scale: 1.0 })

  // Second level warp
  const rx = fbm(noise, (x * scale + strength * qx + 1.7), (y * scale + strength * qy + 9.2), { octaves: 4, scale: 1.0 })
  const ry = fbm(noise, (x * scale + strength * qx + 8.3), (y * scale + strength * qy + 2.8), { octaves: 4, scale: 1.0 })

  return {
    x: strength * rx,
    y: strength * ry,
  }
}

export { clamp, lerp }
