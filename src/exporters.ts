import { GIFEncoder } from 'gifenc'

export type RGB = [number, number, number]

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

let probe: CanvasRenderingContext2D | null = null
const colorCache = new Map<string, RGB>()

/** Accepts any CSS color the panel can produce (hex, rgb, hsl, oklch, display-p3). */
/**
 * Hands a finished file to the person. On touch devices this opens the system share
 * sheet, which is how an image reaches the photo library; a plain download there lands
 * in a files folder. Anywhere sharing is unavailable or refused, it downloads.
 */
export function deliver(blob: Blob, name: string) {
  const touch = window.matchMedia('(pointer: coarse)').matches
  const file = new File([blob], name, { type: blob.type })
  if (touch && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch((err: unknown) => {
      // Dismissing the sheet is a choice, not a failure.
      if (!(err instanceof DOMException && err.name === 'AbortError')) download(blob, name)
    })
    return
  }
  download(blob, name)
}

export function hexToRgb(color: string): RGB {
  const m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim())
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const hit = colorCache.get(color)
  if (hit) return hit
  if (!probe) {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    probe = c.getContext('2d', { willReadFrequently: true })
  }
  if (!probe) return [0, 0, 0]
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const d = probe.getImageData(0, 0, 1, 1).data
  const rgb: RGB = [d[0], d[1], d[2]]
  colorCache.set(color, rgb)
  return rgb
}

export const rgbToHex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

/** Maps rendered RGBA pixels back to palette indices. */
export function toIndices(pixels: Uint8Array, palette: RGB[]): Uint8Array {
  const out = new Uint8Array(pixels.length / 4)
  const cache = new Map<number, number>()
  for (let i = 0; i < out.length; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    const key = (r << 16) | (g << 8) | b
    let idx = cache.get(key)
    if (idx === undefined) {
      let best = Infinity
      idx = 0
      palette.forEach((c, j) => {
        const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2
        if (d < best) {
          best = d
          idx = j
        }
      })
      cache.set(key, idx)
    }
    out[i] = idx
  }
  return out
}

export function scaledCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width * scale
  c.height = src.height * scale
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

export function exportPng(src: HTMLCanvasElement, scale: number, name: string) {
  scaledCanvas(src, scale).toBlob((b) => b && deliver(b, name), 'image/png')
}

/**
 * One path per color, traced along region outlines so neighbouring pixels fuse
 * into single shapes. The first color is a full background rect, which keeps
 * hairline gaps from showing between shapes in vector editors.
 */
export function buildSvg(indices: Uint8Array, w: number, h: number, palette: RGB[], scale: number): string {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : indices[y * w + x])
  const stride = w + 1
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`,
  )
  parts.push(`<rect width="${w}" height="${h}" fill="${rgbToHex(palette[0])}"/>`)

  for (let color = 1; color < palette.length; color++) {
    // Directed boundary edges, clockwise around each cell of this color.
    const edges = new Map<number, number[]>()
    const add = (x0: number, y0: number, x1: number, y1: number) => {
      const from = y0 * stride + x0
      const list = edges.get(from)
      if (list) list.push(y1 * stride + x1)
      else edges.set(from, [y1 * stride + x1])
    }
    let any = false
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (indices[y * w + x] !== color) continue
        any = true
        if (at(x, y - 1) !== color) add(x, y, x + 1, y)
        if (at(x + 1, y) !== color) add(x + 1, y, x + 1, y + 1)
        if (at(x, y + 1) !== color) add(x + 1, y + 1, x, y + 1)
        if (at(x - 1, y) !== color) add(x, y + 1, x, y)
      }
    }
    if (!any) continue

    let d = ''
    for (const [start, list] of edges) {
      while (list.length) {
        let from = start
        let to = list.pop()!
        const pts: number[] = [from]
        while (to !== start) {
          pts.push(to)
          const next = edges.get(to)!
          from = to
          to = next.pop()!
        }
        // Drop collinear points.
        const xs = pts.map((p) => p % stride)
        const ys = pts.map((p) => Math.floor(p / stride))
        const n = pts.length
        const keep: number[] = []
        for (let i = 0; i < n; i++) {
          const a = (i + n - 1) % n
          const b = (i + 1) % n
          const collinear = (xs[a] === xs[i] && xs[i] === xs[b]) || (ys[a] === ys[i] && ys[i] === ys[b])
          if (!collinear) keep.push(i)
        }
        if (keep.length < 3) continue
        d += `M${xs[keep[0]]} ${ys[keep[0]]}`
        for (let i = 1; i < keep.length; i++) {
          const k = keep[i]
          const prev = keep[i - 1]
          d += xs[k] === xs[prev] ? `V${ys[k]}` : `H${xs[k]}`
        }
        d += 'Z'
      }
    }
    if (d) parts.push(`<path fill="${rgbToHex(palette[color])}" d="${d}"/>`)
  }
  parts.push('</svg>')
  return parts.join('\n')
}

export class GifRecorder {
  private gif = GIFEncoder()
  frames = 0
  private scale: number
  constructor(scale: number) {
    this.scale = scale
  }

  add(pixels: Uint8Array, w: number, h: number, palette: RGB[], delay: number) {
    const idx = toIndices(pixels, palette)
    const s = this.scale
    let frame = idx
    if (s > 1) {
      frame = new Uint8Array(w * s * h * s)
      for (let y = 0; y < h; y++) {
        const rowStart = y * s * w * s
        for (let x = 0; x < w; x++) frame.fill(idx[y * w + x], rowStart + x * s, rowStart + (x + 1) * s)
        for (let k = 1; k < s; k++) frame.copyWithin(rowStart + k * w * s, rowStart, rowStart + w * s)
      }
    }
    this.gif.writeFrame(frame, w * s, h * s, { palette, delay })
    this.frames++
  }

  finish(): Blob {
    this.gif.finish()
    return new Blob([this.gif.bytes() as BlobPart], { type: 'image/gif' })
  }
}

export function floatsToBase64(data: Float32Array): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(s)
}

export function base64ToFloats(b64: string): Float32Array {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}
