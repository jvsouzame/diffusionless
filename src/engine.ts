import { BRUSH_FRAG, DISPLAY_FRAG, SEED_FRAG, SIM_FRAG, VERT } from './shaders'

export type SimParams = {
  model: number
  p: number[]
  padRange: [number, number, number, number]
  jitter: number
  field: number
  fieldScale: number
  map: boolean
  seed: number
}

export type SeedParams = {
  /** 0 spots, 1 shape, 2 noise, 3 image, 4 clear */
  pattern: number
  shape: number
  density: number
  size: number
  invert: boolean
}

export type DisplayParams = {
  colors: [number, number, number][]
  contrast: number
  offset: number
  invert: boolean
  dither: number
  bayer: number
  grain: number
  grainFrame: number
}

type Program = { prog: WebGLProgram; loc: (name: string) => WebGLUniformLocation | null }

export class Engine {
  readonly gl: WebGL2RenderingContext
  readonly canvas: HTMLCanvasElement
  w = 0
  h = 0
  steps = 0
  private tex: WebGLTexture[] = []
  private fbo: WebGLFramebuffer[] = []
  private cur = 0
  private wrap = true
  private vao: WebGLVertexArrayObject
  private sim: Program
  private seedProg: Program
  private brushProg: Program
  private display: Program
  private imageTex: WebGLTexture
  private imageSize: [number, number] = [1, 1]

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 is not available in this browser.')
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('Float render targets are not supported on this device.')
    }
    this.gl = gl
    this.canvas = canvas
    this.vao = gl.createVertexArray()!
    this.sim = this.program(SIM_FRAG)
    this.seedProg = this.program(SEED_FRAG)
    this.brushProg = this.program(BRUSH_FRAG)
    this.display = this.program(DISPLAY_FRAG)
    this.imageTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
    this.imageParams()
  }

  private imageParams() {
    const gl = this.gl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private program(frag: string): Program {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(s)}`)
      }
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`)
    }
    const cache = new Map<string, WebGLUniformLocation | null>()
    return {
      prog,
      loc: (name) => {
        if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name))
        return cache.get(name)!
      },
    }
  }

  /**
   * Resizes the grid. An existing pattern is stretched onto the new grid, so a
   * window resize or a resolution change keeps it. Returns true only when there
   * was nothing to keep and the caller should seed.
   */
  setGrid(w: number, h: number): boolean {
    if (w === this.w && h === this.h) return false
    const gl = this.gl
    const oldTex = this.tex
    const oldFbo = this.fbo
    const oldCur = this.cur
    const ow = this.w
    const oh = this.h
    this.w = w
    this.h = h
    this.canvas.width = w
    this.canvas.height = h
    this.tex = []
    this.fbo = []
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      const f = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, f)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      this.tex.push(t)
      this.fbo.push(f)
    }
    this.cur = 0
    const hadState = ow > 0
    if (hadState) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, oldFbo[oldCur])
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo[0])
      gl.blitFramebuffer(0, 0, ow, oh, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    } else {
      this.steps = 0
    }
    oldTex.forEach((t) => gl.deleteTexture(t))
    oldFbo.forEach((f) => gl.deleteFramebuffer(f))
    this.applyWrap()
    return !hadState
  }

  setWrap(wrap: boolean) {
    this.wrap = wrap
    this.applyWrap()
  }

  private applyWrap() {
    const gl = this.gl
    const mode = this.wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE
    for (const t of this.tex) {
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mode)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mode)
    }
  }

  setImage(img: HTMLImageElement | null) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex)
    if (!img) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
      this.imageSize = [1, 1]
      return
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    this.imageParams()
    this.imageSize = [img.naturalWidth || 1, img.naturalHeight || 1]
  }

  private begin(p: Program, model: number, seed: number) {
    const gl = this.gl
    gl.useProgram(p.prog)
    gl.bindVertexArray(this.vao)
    gl.viewport(0, 0, this.w, this.h)
    gl.uniform1i(p.loc('uModel'), model)
    gl.uniform2f(p.loc('uRes'), this.w, this.h)
    gl.uniform1i(p.loc('uSeed'), seed)
  }

  private bindState(p: Program) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur])
    gl.uniform1i(p.loc('uState'), 0)
  }

  private pass() {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1 - this.cur])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.cur = 1 - this.cur
  }

  step(n: number, sp: SimParams) {
    if (!this.w) return
    const gl = this.gl
    const p = this.sim
    this.begin(p, sp.model, sp.seed)
    const params = new Float32Array(8)
    params.set(sp.p.slice(0, 8))
    gl.uniform1fv(p.loc('uP'), params)
    gl.uniform4f(p.loc('uPadRange'), ...sp.padRange)
    gl.uniform1f(p.loc('uJitter'), sp.jitter)
    gl.uniform1f(p.loc('uField'), sp.field)
    gl.uniform1i(p.loc('uFieldScale'), sp.fieldScale)
    gl.uniform1i(p.loc('uMap'), sp.map ? 1 : 0)
    for (let i = 0; i < n; i++) {
      gl.uniform1i(p.loc('uStep'), this.steps)
      this.bindState(p)
      this.pass()
      this.steps++
    }
  }

  seed(model: number, seed: number, s: SeedParams) {
    if (!this.w) return
    const gl = this.gl
    const p = this.seedProg
    this.begin(p, model, seed)
    gl.uniform1i(p.loc('uPattern'), s.pattern)
    gl.uniform1i(p.loc('uShape'), s.shape)
    gl.uniform1f(p.loc('uDensity'), s.density)
    gl.uniform1f(p.loc('uSize'), s.size)
    gl.uniform1i(p.loc('uInvert'), s.invert ? 1 : 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex)
    gl.uniform1i(p.loc('uImage'), 1)
    gl.uniform2f(p.loc('uImageSize'), ...this.imageSize)
    this.pass()
    this.steps = 0
  }

  brush(
    model: number,
    seed: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    radius: number,
    erase: boolean,
    phase = 0,
  ) {
    if (!this.w) return
    const gl = this.gl
    const p = this.brushProg
    this.begin(p, model, seed)
    gl.uniform2f(p.loc('uA'), ax, ay)
    gl.uniform2f(p.loc('uB'), bx, by)
    gl.uniform1f(p.loc('uRadius'), radius)
    gl.uniform1i(p.loc('uErase'), erase ? 1 : 0)
    gl.uniform1i(p.loc('uPhase'), ((phase % 3) + 3) % 3)
    gl.uniform1i(p.loc('uWrap'), this.wrap ? 1 : 0)
    this.bindState(p)
    this.pass()
  }

  render(model: number, seed: number, d: DisplayParams) {
    if (!this.w) return
    const gl = this.gl
    const p = this.display
    this.begin(p, model, seed)
    const pal = new Float32Array(24)
    d.colors.slice(0, 8).forEach((c, i) => pal.set(c, i * 3))
    gl.uniform3fv(p.loc('uPal'), pal)
    gl.uniform1i(p.loc('uCount'), Math.min(8, Math.max(1, d.colors.length)))
    gl.uniform1f(p.loc('uContrast'), d.contrast)
    gl.uniform1f(p.loc('uOffset'), d.offset)
    gl.uniform1i(p.loc('uInvert'), d.invert ? 1 : 0)
    gl.uniform1f(p.loc('uDither'), d.dither)
    gl.uniform1i(p.loc('uBayer'), d.bayer)
    gl.uniform1f(p.loc('uGrain'), d.grain)
    gl.uniform1i(p.loc('uGrainFrame'), d.grainFrame)
    this.bindState(p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** RGBA bytes of the rendered image, top row first. */
  readPixels(): Uint8Array {
    const gl = this.gl
    const { w, h } = this
    const raw = new Uint8Array(w * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw)
    const out = new Uint8Array(raw.length)
    const row = w * 4
    for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * row, (h - y) * row), y * row)
    return out
  }

  readState(): Float32Array {
    const gl = this.gl
    const data = new Float32Array(this.w * this.h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.cur])
    gl.readPixels(0, 0, this.w, this.h, gl.RGBA, gl.FLOAT, data)
    return data
  }

  loadState(w: number, h: number, data: Float32Array) {
    this.setGrid(w, h)
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur])
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.FLOAT, data)
  }
}
