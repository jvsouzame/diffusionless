import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import { Engine, type DisplayParams, type SeedParams, type SimParams } from './engine'
import { DEFAULT_MODEL, MODELS, MODEL_KEYS, allParams, type ModelDef, type ParamDef } from './models'
import { DEFAULT_PALETTE, FALLBACK_COLORS, PALETTES, PALETTE_NAMES } from './palettes'
import { createResidents } from './cat'
import { Sound, type SoundInput } from './sound'
import { Toolbar, type CatOptions, type SoundOptions, type ExportFormat, type ExportOptions, type RecordingInfo } from './Toolbar'
import {
  rgbToHex,
  GifRecorder,
  base64ToFloats,
  buildSvg,
  download,
  exportPng,
  floatsToBase64,
  hexToRgb,
  toIndices,
  type RGB,
} from './exporters'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const ASPECTS: Record<string, [number, number]> = {
  '1:1': [1, 1],
  '16:9': [16, 9],
  '9:16': [9, 16],
  '4:5': [4, 5],
}
const SHORTCUTS: Record<string, string> = {
  space: 'toggleRun',
  '.': 'step',
  r: 'reseed',
  n: 'newSeed',
  c: 'clear',
  x: 'randomize',
  m: 'mutate',
  p: 'toggleMap',
  e: 'toggleExport',
  s: 'toggleSound',
  f: 'toggleFullscreen',
}
/** Size of one cat pixel in CSS pixels. Small on purpose: the cat is meant to be tiny. */
const CAT_PIXEL = 3
const PATTERNS = ['spots', 'shape', 'noise', 'image']
const SHAPES = ['dot', 'ring', 'lines', 'grid']

type Size = { w: number; h: number }

/** Grid cells for the chosen aspect. "fill" matches the stage, with square cells of whole device pixels. */
function gridSize(aspect: string, res: number, stage: Size): [number, number] {
  if (aspect === 'fill') {
    const dpr = window.devicePixelRatio || 1
    const cell = Math.max(1, Math.round((Math.max(stage.w, stage.h) * dpr) / res))
    return [Math.max(8, Math.ceil((stage.w * dpr) / cell)), Math.max(8, Math.ceil((stage.h * dpr) / cell))]
  }
  const [a, b] = ASPECTS[aspect] ?? [1, 1]
  const m = Math.max(a, b)
  return [Math.max(8, Math.round((res * a) / m)), Math.max(8, Math.round((res * b) / m))]
}

const stageGuess = (): Size => ({
  w: Math.max(64, window.innerWidth - 32),
  h: Math.max(64, window.innerHeight - 88),
})

const slider = (p: ParamDef): [number, number, number, number] => [p.def, p.min, p.max, p.step]
const clamp = (v: number, p: ParamDef) => Math.min(p.max, Math.max(p.min, v))

function modelFolder(m: ModelDef): Any {
  const folder: Any = {
    _collapsed: true,
    preset: { type: 'select', options: m.presets.map((p) => p.name), default: m.presets[0].name },
    [m.padKey]: {
      type: 'pad',
      x: slider(m.padX),
      y: slider(m.padY),
      labels: { x: m.padX.label[0], y: m.padY.label[0] },
    },
  }
  for (const p of m.params) folder[p.key] = slider(p)
  return folder
}

function buildConfig(modelKey: string, colorCount: number): Any {
  const m = MODELS[modelKey]
  const base = PALETTES[DEFAULT_PALETTE]
  const palette: Any = {
    _collapsed: true,
    preset: { type: 'select', options: PALETTE_NAMES, default: DEFAULT_PALETTE },
    colors: [base.length, 2, 8, 1],
  }
  for (let i = 0; i < colorCount; i++) {
    palette[`color${i + 1}`] = { type: 'color', default: base[i] ?? FALLBACK_COLORS[i] }
  }
  return {
    model: {
      type: 'select',
      options: MODEL_KEYS.map((k) => ({ value: k, label: MODELS[k].name })),
      default: DEFAULT_MODEL,
    },
    [m.key]: modelFolder(m),
    explore: {
      _collapsed: true,
      mutation: [0.03, 0.005, 0.5, 0.005],
      parameterMap: false,
    },
    simulation: {
      _collapsed: true,
      speed: [8, 1, 64, 1],
      seamless: true,
    },
    noise: {
      _collapsed: true,
      jitter: [0, 0, 1, 0.01],
      field: [0, 0, 1, 0.01],
      fieldScale: [4, 1, 16, 1],
    },
    canvas: {
      _collapsed: true,
      aspect: { type: 'select', options: ['fill', ...Object.keys(ASPECTS)], default: 'fill' },
      resolution: [192, 32, 512, 8],
    },
    seed: {
      _collapsed: true,
      pattern: { type: 'select', options: PATTERNS, default: 'spots' },
      shape: { type: 'select', options: SHAPES, default: 'ring' },
      density: [0.35, 0, 1, 0.01],
      size: [4, 1, 32, 1],
      invert: false,
      image: { type: 'image' },
      seed: [1, 1, 9999, 1],
    },
    brush: {
      _collapsed: true,
      size: [3, 1, 32, 1],
    },
    palette,
    tone: {
      _collapsed: true,
      contrast: [1, 0.2, 4, 0.01],
      offset: [0, -0.5, 0.5, 0.005],
      invert: false,
      dither: [0.5, 0, 1, 0.01],
      ditherSize: { type: 'select', options: ['2', '4', '8'], default: '4' },
      grain: [0, 0, 1, 0.01],
      animateGrain: false,
    },
  }
}

const isFolder = (c: Any) => typeof c === 'object' && c !== null && !Array.isArray(c) && !('type' in c)

/** Keeps only the values the given config can hold (drops actions and unknown keys). */
function pickValues(config: Any, values: Any): Any {
  const out: Any = {}
  if (!values) return out
  for (const key of Object.keys(config)) {
    if (key === '_collapsed') continue
    const c = config[key]
    if (c && c.type === 'action') continue
    if (values[key] === undefined) continue
    out[key] = isFolder(c) ? pickValues(c, values[key]) : values[key]
  }
  return out
}

const stored = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

type Recording =
  | { kind: 'webm'; until: number; ctx: CanvasRenderingContext2D; rec: MediaRecorder }
  | { kind: 'gif'; until: number; gif: GifRecorder; last: number }

const FORMATS: ExportFormat[] = ['png', 'svg', 'gif', 'webm']

function loadExportOptions(): ExportOptions {
  const fallback: ExportOptions = { format: 'png', scale: 4, duration: 6 }
  try {
    const o = JSON.parse(stored('dl:export') ?? 'null')
    if (!o) return fallback
    return {
      format: FORMATS.includes(o.format) ? o.format : fallback.format,
      scale: [1, 2, 4, 8].includes(o.scale) ? o.scale : fallback.scale,
      duration: o.duration >= 2 && o.duration <= 20 ? Math.round(o.duration) : fallback.duration,
    }
  } catch {
    return fallback
  }
}

type Pending = { values: Any; grid?: { w: number; h: number; data: Float32Array } }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const recRef = useRef<Recording | null>(null)
  const holdSeedRef = useRef(false)
  const lastPreset = useRef<Record<string, string>>({})

  const [modelKey, setModelKey] = useState(() => {
    const k = stored('dl:model')
    return k && MODELS[k] ? k : DEFAULT_MODEL
  })
  const [colorCount, setColorCount] = useState(() => {
    const n = Number(stored('dl:colors'))
    return n >= 2 && n <= 8 ? n : PALETTES[DEFAULT_PALETTE].length
  })
  const [imageVersion, setImageVersion] = useState(0)
  const [status, setStatus] = useState('')
  const [running, setRunning] = useState(true)
  const [recording, setRecording] = useState<RecordingInfo | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState(loadExportOptions)
  const stageRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const catCanvasRef = useRef<HTMLCanvasElement>(null)
  const residentsRef = useRef(createResidents())
  const cursorRef = useRef<{ x: number; y: number; at: number } | null>(null)
  const strokeActive = useRef(false)
  const strokeCount = useRef(0)
  const [stageSize, setStageSize] = useState<Size>(stageGuess)
  const [immersive, setImmersive] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  // The music is meant to play on its own. Browsers only allow audio after a first
  // click or key press, so until then it stays armed and starts on that gesture.
  const [soundArmed, setSoundArmed] = useState(() => stored('dl:sound') !== 'off')
  const [soundLabel, setSoundLabel] = useState('')
  const [soundOptions, setSoundOptions] = useState<SoundOptions>(() => {
    const clamp01 = (value: unknown, fallback: number) =>
      typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback
    try {
      const o = JSON.parse(stored('dl:soundopts') ?? 'null')
      return { volume: clamp01(o?.volume, 0.7), reactivity: clamp01(o?.reactivity, 0.8) }
    } catch {
      return { volume: 0.7, reactivity: 0.8 }
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('dl:soundopts', JSON.stringify(soundOptions))
    } catch {
      /* storage unavailable */
    }
  }, [soundOptions])
  const [catOptions, setCatOptions] = useState<CatOptions>(() => {
    try {
      const o = JSON.parse(stored('dl:cat') ?? 'null')
      return { visible: o?.visible !== false, paws: o?.paws !== false }
    } catch {
      return { visible: true, paws: true }
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('dl:cat', JSON.stringify(catOptions))
    } catch {
      /* storage unavailable */
    }
  }, [catOptions])
  const soundRef = useRef<Sound | null>(null)
  const metricsRef = useRef({ coverage: 0, activity: 0, last: null as Uint8Array | null })
  const [error, setError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)

  const config = useMemo(() => buildConfig(modelKey, colorCount), [modelKey, colorCount])
  const actionRef = useRef<(name: string) => void>(() => {})
  const dial = useDialKitController('Controls', config, { id: 'diffusionless', persist: true })
  const v = dial.values as Any
  const setValues = dial.setValues as (values: Any) => void

  // The config depends on two of its own values; keep it in step with them.
  useEffect(() => {
    if (MODELS[v.model] && v.model !== modelKey) setModelKey(v.model)
  }, [v.model, modelKey])
  useEffect(() => {
    const n = Math.round(v.palette?.colors ?? colorCount)
    if (n !== colorCount && n >= 2 && n <= 8) setColorCount(n)
  }, [v.palette?.colors, colorCount])
  useEffect(() => {
    try {
      localStorage.setItem('dl:model', modelKey)
      localStorage.setItem('dl:colors', String(colorCount))
    } catch {
      /* storage unavailable */
    }
  }, [modelKey, colorCount])

  const model = MODELS[modelKey]
  const mv = v[model.key] ?? {}
  const pad = mv[model.padKey] ?? { x: model.padX.def, y: model.padY.def }
  const fill = v.canvas.aspect === 'fill'
  const [W, H] = gridSize(v.canvas.aspect, v.canvas.resolution, stageSize)
  const exportScale = exportOptions.scale

  const colors: RGB[] = []
  for (let i = 0; i < colorCount; i++) {
    colors.push(hexToRgb(v.palette[`color${i + 1}`] ?? FALLBACK_COLORS[i]))
  }

  const sim: SimParams = {
    model: model.index,
    p: [pad.x, pad.y, ...model.params.map((p) => mv[p.key] ?? p.def)],
    padRange: [model.padX.min, model.padX.max, model.padY.min, model.padY.max],
    jitter: v.noise.jitter,
    field: v.noise.field,
    fieldScale: v.noise.fieldScale,
    map: v.explore.parameterMap,
    seed: v.seed.seed,
  }
  const seedParams: SeedParams = {
    pattern: Math.max(0, PATTERNS.indexOf(v.seed.pattern)),
    shape: Math.max(0, SHAPES.indexOf(v.seed.shape)),
    density: v.seed.density,
    size: v.seed.size,
    invert: v.seed.invert,
  }
  const display: Omit<DisplayParams, 'grainFrame'> = {
    colors: colors.map((c) => [c[0] / 255, c[1] / 255, c[2] / 255]),
    contrast: v.tone.contrast,
    offset: v.tone.offset,
    invert: v.tone.invert,
    dither: v.tone.dither,
    bayer: parseInt(v.tone.ditherSize, 10) || 4,
    grain: v.tone.grain,
  }

  const latest = useRef<Any>(null)
  latest.current = {
    model,
    sim,
    seedParams,
    display,
    colors,
    W,
    H,
    exportScale,
    running,
    speed: v.simulation.speed,
    animateGrain: v.tone.animateGrain,
    brush: v.brush.size,
    mutation: v.explore.mutation,
    duration: exportOptions.duration,
    config,
    fill,
    soundOn,
    cat: catOptions,
    sound: {
      model: model.index,
      padX: (pad.x - model.padX.min) / (model.padX.max - model.padX.min),
      padY: (pad.y - model.padY.min) / (model.padY.max - model.padY.min),
      speed: v.simulation.speed,
      jitter: v.noise.jitter,
      field: v.noise.field,
      resolution: Math.max(W, H),
      map: v.explore.parameterMap,
      running,
      lightness: colors.reduce((sum, c) => sum + c[0] + c[1] + c[2], 0) / (colors.length * 765),
      colorCount,
      contrast: v.tone.contrast,
      dither: v.tone.dither,
      grain: v.tone.grain,
      seed: v.seed.seed,
      volume: soundOptions.volume,
      reactivity: soundOptions.reactivity,
    },
  }
  const soundInput = (): SoundInput => ({
    ...latest.current.sound,
    coverage: metricsRef.current.coverage,
    activity: metricsRef.current.activity,
  })
  // Every render carries the current control values to the running music.
  useEffect(() => {
    if (soundOn) soundRef.current?.update(soundInput())
  })

  useEffect(() => {
    try {
      localStorage.setItem('dl:export', JSON.stringify(exportOptions))
    } catch {
      /* storage unavailable */
    }
  }, [exportOptions])

  useEffect(() => {
    if (!status) return
    const id = window.setTimeout(() => setStatus(''), 4000)
    return () => window.clearTimeout(id)
  }, [status])

  const layout = useCallback(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    const stage = stageRef.current
    const e = engineRef.current
    if (!canvas || !frame || !stage || !e || !e.w) return
    const dpr = window.devicePixelRatio || 1
    const sw = stage.clientWidth
    const sh = stage.clientHeight
    let s = Math.min((sw * dpr) / e.w, (sh * dpr) / e.h)
    if (latest.current.fill) {
      // Cover the stage; the frame clips the overflow of the last row and column.
      s = Math.max(1, Math.ceil(Math.max((sw * dpr) / e.w, (sh * dpr) / e.h) - 0.001))
      frame.style.width = `${sw}px`
      frame.style.height = `${sh}px`
    } else {
      if (s >= 1) s = Math.floor(s)
      frame.style.width = `${(e.w * s) / dpr}px`
      frame.style.height = `${(e.h * s) / dpr}px`
    }
    canvas.style.width = `${(e.w * s) / dpr}px`
    canvas.style.height = `${(e.h * s) / dpr}px`
    const overlay = catCanvasRef.current
    if (overlay) {
      // The cat's grid is finer than the simulation's: one cat pixel is CAT_PIXEL CSS pixels.
      const cw = Math.max(16, Math.round((e.w * s) / dpr / CAT_PIXEL))
      const ch = Math.max(16, Math.round((e.h * s) / dpr / CAT_PIXEL))
      if (overlay.width !== cw || overlay.height !== ch) {
        // Keep everyone at the same relative spot when the layer changes size.
        for (const resident of residentsRef.current) {
          if (resident.x < 0 || overlay.width === 0) continue
          resident.x *= cw / overlay.width
          resident.y *= ch / overlay.height
        }
        overlay.width = cw
        overlay.height = ch
      }
      overlay.style.width = canvas.style.width
      overlay.style.height = canvas.style.height
    }
  }, [])

  // Track the stage size (window resize, fullscreen), debounced so the grid is not rebuilt mid-drag.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let id = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(id)
      id = window.setTimeout(() => {
        setStageSize((prev) =>
          prev.w === stage.clientWidth && prev.h === stage.clientHeight
            ? prev
            : { w: stage.clientWidth, h: stage.clientHeight },
        )
        layout()
      }, 120)
    })
    ro.observe(stage)
    return () => {
      ro.disconnect()
      window.clearTimeout(id)
    }
  }, [layout])

  useEffect(() => {
    const onChange = () => setImmersive(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => () => soundRef.current?.stop(), [])

  // The bar wraps to more rows on narrow screens; the stage and menus follow its real height.
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const apply = () => document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`)
    const ro = new ResizeObserver(apply)
    ro.observe(bar)
    apply()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!soundArmed || soundOn) return
    if (navigator.userActivation?.hasBeenActive) {
      actionRef.current('startSound')
      return
    }
    const go = (ev: Event) => {
      if (ev instanceof KeyboardEvent && (ev.key.toLowerCase() === 's' || ev.metaKey || ev.ctrlKey || ev.altKey)) return
      // The sound button handles its own click.
      if ((ev.target as HTMLElement | null)?.closest?.('[aria-label^="Sound"]')) return
      actionRef.current('startSound')
    }
    const events = ['pointerdown', 'pointerup', 'keydown'] as const
    events.forEach((type) => window.addEventListener(type, go, true))
    return () => events.forEach((type) => window.removeEventListener(type, go, true))
  }, [soundArmed, soundOn])

  const reseed = useCallback((clear = false) => {
    const e = engineRef.current
    if (!e || holdSeedRef.current) return
    const L = latest.current
    e.seed(L.sim.model, L.sim.seed, clear ? { ...L.seedParams, pattern: 4 } : L.seedParams)
  }, [])

  // Engine and render loop.
  useEffect(() => {
    let engine: Engine
    try {
      engine = new Engine(canvasRef.current!)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }
    engineRef.current = engine
    let raf = 0
    let frameCount = 0
    let grainFrame = 0
    let lastFrame = performance.now()
    let pawCount = 0
    const frame = (now: number) => {
      const L = latest.current
      if (engine.w) {
        if (L.running) engine.step(L.speed, L.sim)
        frameCount++
        if (L.animateGrain && frameCount % 4 === 0) grainFrame++
        engine.render(L.sim.model, L.sim.seed, { ...L.display, grainFrame })
        const overlay = catCanvasRef.current
        const cctx = overlay?.getContext('2d')
        if (overlay && cctx) {
          cctx.clearRect(0, 0, overlay.width, overlay.height)
          if (L.cat.visible) {
            const dt = Math.min(0.1, (now - lastFrame) / 1000)
            const pointer = cursorRef.current
            const sound = soundRef.current
            const env = {
              w: overlay.width,
              h: overlay.height,
              cursor: pointer
                ? { x: pointer.x * overlay.width, y: pointer.y * overlay.height, age: (now - pointer.at) / 1000 }
                : null,
              painting: strokeActive.current,
              running: L.running,
              beat: sound?.isOn ? sound.cps * 4 : 1,
            }
            const byLight = [...L.colors].sort((a: RGB, b: RGB) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
            const dark = rgbToHex(byLight[0])
            const light = rgbToHex(byLight[byLight.length - 1])
            // Draw back to front, so whoever stands lower on the canvas overlaps the others.
            const residents = [...residentsRef.current]
            for (const resident of residentsRef.current) {
              const events = resident.update(dt, env)
              if (events.step && L.cat.paws && L.running && !L.sim.map) {
                const px = Math.floor((events.step.x / overlay.width) * engine.w) + 0.5
                const py = engine.h - Math.floor((events.step.y / overlay.height) * engine.h) - 0.5
                engine.brush(L.sim.model, L.sim.seed, px, py, px, py, 1, false, pawCount)
                if (++pawCount % 6 === 0) sound?.accent('paw')
              }
              if (events.meow) sound?.accent('meow')
            }
            residents.sort((a, b) => a.y - b.y).forEach((resident) => resident.draw(cctx, dark, light))
          }
        }
        lastFrame = now
        const rec = recRef.current
        if (rec) {
          if (rec.kind === 'webm') {
            rec.ctx.drawImage(engine.canvas, 0, 0, rec.ctx.canvas.width, rec.ctx.canvas.height)
          } else if (now - rec.last >= 33) {
            rec.gif.add(engine.readPixels(), engine.w, engine.h, L.colors, 33)
            rec.last = now
          }
          if (now >= rec.until) actionRef.current('stopRecording')
        }
        if (L.soundOn && frameCount % 30 === 0) {
          const px = engine.readPixels()
          const M = metricsRef.current
          const first: number[] = L.colors[0]
          let filled = 0
          let moved = 0
          const same = M.last && M.last.length === px.length
          for (let i = 0; i < px.length; i += 4) {
            if (px[i] !== first[0] || px[i + 1] !== first[1] || px[i + 2] !== first[2]) filled++
            if (same && (px[i] !== M.last![i] || px[i + 1] !== M.last![i + 1] || px[i + 2] !== M.last![i + 2])) moved++
          }
          const total = px.length / 4
          M.coverage = filled / total
          M.activity = same ? moved / total : 0
          M.last = px
          soundRef.current?.update({ ...L.sound, coverage: M.coverage, activity: M.activity })
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const e = engineRef.current
    if (!e || holdSeedRef.current) return
    const changed = e.setGrid(W, H)
    layout()
    if (changed) reseed()
  }, [W, H, fill, layout, reseed])

  useEffect(() => {
    engineRef.current?.setWrap(v.simulation.seamless)
  }, [v.simulation.seamless])

  useEffect(() => {
    const url: string = v.seed.image
    const e = engineRef.current
    if (!e) return
    if (!url) {
      e.setImage(null)
      setImageVersion((n) => n + 1)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      engineRef.current?.setImage(img)
      setImageVersion((n) => n + 1)
    }
    img.src = url
  }, [v.seed.image])

  useEffect(() => {
    reseed()
  }, [
    reseed,
    modelKey,
    v.seed.pattern,
    v.seed.shape,
    v.seed.density,
    v.seed.size,
    v.seed.invert,
    v.seed.seed,
    v.explore.parameterMap,
    imageVersion,
  ])

  const setModelParams = useCallback(
    (m: ModelDef, values: number[]) => {
      const folder: Any = { [m.padKey]: { x: clamp(values[0], m.padX), y: clamp(values[1], m.padY) } }
      m.params.forEach((p, i) => (folder[p.key] = clamp(values[i + 2], p)))
      setValues({ [m.key]: folder })
    },
    [setValues],
  )

  // Applying a model preset when the select changes (not on first load or model switch).
  const presetName: string | undefined = mv.preset
  useEffect(() => {
    if (!presetName) return
    const prev = lastPreset.current[modelKey]
    lastPreset.current[modelKey] = presetName
    if (prev === undefined || prev === presetName || holdSeedRef.current) return
    const preset = model.presets.find((p) => p.name === presetName)
    if (!preset) return
    setModelParams(model, preset.values)
    reseed()
  }, [presetName, modelKey, model, setModelParams, reseed])

  const paletteName: string = v.palette.preset
  const lastPalette = useRef<string | null>(null)
  useEffect(() => {
    const prev = lastPalette.current
    lastPalette.current = paletteName
    if (prev === null || prev === paletteName || holdSeedRef.current) return
    const list = PALETTES[paletteName]
    if (!list) return
    const palette: Any = { colors: list.length }
    list.forEach((c, i) => (palette[`color${i + 1}`] = c))
    setValues({ palette: { colors: list.length } })
    setPending({ values: { palette } })
  }, [paletteName, setValues])

  // Second phase of a value load: runs once the config matches the incoming model and color count.
  useEffect(() => {
    if (!pending) return
    const wantModel = pending.values.model ?? modelKey
    const wantColors = pending.values.palette?.colors ?? colorCount
    if (wantModel !== modelKey || wantColors !== colorCount) return
    setValues(pickValues(config, pending.values))
    const grid = pending.grid
    setPending(null)
    if (grid) {
      // Hold automatic reseeds while the loaded values settle, then restore the saved grid.
      holdSeedRef.current = true
      window.setTimeout(() => {
        holdSeedRef.current = false
        engineRef.current?.loadState(grid.w, grid.h, grid.data)
        layout()
      }, 200)
    }
  }, [pending, modelKey, colorCount, config, setValues, layout])

  const fileName = (ext: string) => {
    const L = latest.current
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    return `diffusionless-${L.model.key}-${L.sim.seed}-${stamp}.${ext}`
  }

  actionRef.current = (name: string) => {
    const e = engineRef.current
    const L = latest.current
    if (!e) return
    const m: ModelDef = L.model
    switch (name) {
      case 'randomize':
        setModelParams(m, m.randomize(Math.random))
        soundRef.current?.accent('randomize')
        residentsRef.current.forEach((resident) => resident.startle())
        if (L.sim.map) setValues({ explore: { parameterMap: false } })
        reseed()
        break
      case 'mutate': {
        const next = allParams(m).map(
          (p, i) => L.sim.p[i] + (Math.random() * 2 - 1) * L.mutation * (p.max - p.min),
        )
        setModelParams(m, next)
        soundRef.current?.accent('mutate')
        break
      }
      case 'toggleRun':
        setRunning((r) => !r)
        break
      case 'step':
        e.step(L.speed, L.sim)
        break
      case 'toggleMap':
        setValues({ explore: { parameterMap: !L.sim.map } })
        break
      case 'startSound':
      case 'toggleSound': {
        const sound = (soundRef.current ??= new Sound())
        sound.onLabel = setSoundLabel
        const remember = (on: boolean) => {
          setSoundArmed(on)
          try {
            localStorage.setItem('dl:sound', on ? 'on' : 'off')
          } catch {
            /* storage unavailable */
          }
        }
        if (sound.isOn) {
          if (name === 'startSound') break
          sound.stop()
          setSoundOn(false)
          remember(false)
        } else {
          setSoundOn(true)
          if (name === 'toggleSound') remember(true)
          sound.start(soundInput()).catch((err) => {
            setSoundOn(false)
            setStatus(err instanceof Error ? `Sound failed: ${err.message}` : 'Sound failed to start')
          })
        }
        break
      }
      case 'toggleFullscreen':
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen().catch(() => setStatus('Fullscreen is not available'))
        break
      case 'toggleExport':
        if (!recRef.current) setMenuOpen((o) => !o)
        break
      case 'stopRecording': {
        const rec = recRef.current
        if (!rec) break
        recRef.current = null
        setRecording(null)
        if (rec.kind === 'webm') rec.rec.stop()
        else if (rec.gif.frames > 0) download(rec.gif.finish(), fileName('gif'))
        break
      }
      case 'newSeed':
        setValues({ seed: { seed: 1 + Math.floor(Math.random() * 9999) } })
        break
      case 'reseed':
        reseed()
        break
      case 'clear':
        reseed(true)
        break
      case 'png':
        exportPng(e.canvas, L.exportScale, fileName('png'))
        break
      case 'svg': {
        const idx = toIndices(e.readPixels(), L.colors)
        const svg = buildSvg(idx, e.w, e.h, L.colors, L.exportScale)
        download(new Blob([svg], { type: 'image/svg+xml' }), fileName('svg'))
        break
      }
      case 'webm': {
        if (recRef.current) break
        const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(
          (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
        )
        if (!mime) {
          setStatus('Video recording is not supported in this browser')
          break
        }
        const s = Math.max(L.exportScale, Math.ceil(512 / Math.max(e.w, e.h)))
        const c = document.createElement('canvas')
        c.width = e.w * s
        c.height = e.h * s
        const ctx = c.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        const rec = new MediaRecorder(c.captureStream(60), { mimeType: mime, videoBitsPerSecond: 16_000_000 })
        const chunks: Blob[] = []
        rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data)
        rec.onstop = () => {
          download(new Blob(chunks, { type: mime }), fileName(mime.includes('mp4') ? 'mp4' : 'webm'))
        }
        rec.start()
        const until = performance.now() + L.duration * 1000
        recRef.current = { kind: 'webm', until, ctx, rec }
        setRecording({ kind: 'webm', until })
        break
      }
      case 'gif': {
        if (recRef.current) break
        const s = Math.max(1, Math.min(L.exportScale, Math.floor(1024 / Math.max(e.w, e.h))))
        const until = performance.now() + L.duration * 1000
        recRef.current = { kind: 'gif', until, gif: new GifRecorder(s), last: 0 }
        setRecording({ kind: 'gif', until })
        break
      }
      case 'savePreset': {
        const data = {
          app: 'diffusionless',
          version: 1,
          values: pickValues(L.config, dial.getValues()),
          grid: { w: e.w, h: e.h, data: floatsToBase64(e.readState()) },
        }
        download(new Blob([JSON.stringify(data)], { type: 'application/json' }), fileName('json'))
        break
      }
      case 'loadPreset':
        fileRef.current?.click()
        break
    }
  }

  const onFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!['diffusionless', 'pixeldiffusion'].includes(data.app) || !data.values || !MODELS[data.values.model]) {
        throw new Error('Not a diffusionless preset')
      }
      const grid = data.grid
        ? { w: data.grid.w, h: data.grid.h, data: base64ToFloats(data.grid.data) }
        : undefined
      if (grid && grid.data.length !== grid.w * grid.h * 4) throw new Error('Preset grid is corrupted')
      setValues({ model: data.values.model, palette: { colors: data.values.palette?.colors ?? colorCount } })
      setPending({ values: data.values, grid })
      setStatus('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not read preset')
    }
  }

  // Painting and parameter-map picking.
  const stroke = useRef<{ x: number; y: number; erase: boolean } | null>(null)
  const cellAt = (ev: React.PointerEvent) => {
    const e = engineRef.current!
    const r = canvasRef.current!.getBoundingClientRect()
    const u = (ev.clientX - r.left) / r.width
    const t = 1 - (ev.clientY - r.top) / r.height
    return { u, t, x: Math.floor(u * e.w) + 0.5, y: Math.floor(t * e.h) + 0.5 }
  }
  const onPointerDown = (ev: React.PointerEvent) => {
    const e = engineRef.current
    if (!e) return
    const L = latest.current
    const pos = cellAt(ev)
    if (L.sim.map) {
      const m: ModelDef = L.model
      const next = [...L.sim.p]
      next[0] = m.padX.min + (m.padX.max - m.padX.min) * pos.u
      next[1] = m.padY.min + (m.padY.max - m.padY.min) * pos.t
      setModelParams(m, next)
      setValues({ explore: { parameterMap: false } })
      return
    }
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const erase = ev.button === 2 || ev.shiftKey
    stroke.current = { x: pos.x, y: pos.y, erase }
    strokeActive.current = true
    strokeCount.current++
    e.brush(L.sim.model, L.sim.seed, pos.x, pos.y, pos.x, pos.y, L.brush / 2, erase, strokeCount.current)
    if (!erase) soundRef.current?.ornament(pos.t, pos.u)
  }
  const onPointerMove = (ev: React.PointerEvent) => {
    const e = engineRef.current
    if (!e) return
    const here = cellAt(ev)
    cursorRef.current = { x: here.u, y: 1 - here.t, at: performance.now() }
    const s = stroke.current
    if (!s) return
    const L = latest.current
    const pos = cellAt(ev)
    e.brush(L.sim.model, L.sim.seed, s.x, s.y, pos.x, pos.y, L.brush / 2, s.erase, strokeCount.current)
    if (!s.erase) soundRef.current?.ornament(pos.t, pos.u)
    s.x = pos.x
    s.y = pos.y
  }
  const onPointerUp = () => {
    stroke.current = null
    strokeActive.current = false
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return
      const key = ev.code === 'Space' ? 'space' : ev.key.toLowerCase()
      const action = SHORTCUTS[key]
      if (!action) return
      ev.preventDefault()
      if (action === 'clear') reseed(true)
      else if (action === 'reseed') reseed()
      else actionRef.current(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reseed])

  return (
    <>
      <main className={immersive ? 'stage immersive' : 'stage'} ref={stageRef}>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="frame" ref={frameRef}>
            <canvas
              ref={canvasRef}
              className={v.explore.parameterMap ? 'canvas picking' : 'canvas'}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => (cursorRef.current = null)}
              onContextMenu={(ev) => ev.preventDefault()}
            />
            <canvas ref={catCanvasRef} className="cat" aria-hidden="true" />
          </div>
        )}
      </main>
      <footer className="bar" ref={barRef} hidden={immersive}>
        <div className="brand">
          <h1 className="wordmark">diffusionless</h1>
          <p className="info">
            <strong>{model.name}</strong>
            {!running && ' · paused'}
            <br />
            {v.explore.parameterMap
              ? `Map: ${model.padX.label} → x, ${model.padY.label} → y · click the canvas to pick`
              : soundOn
                ? soundLabel || 'Loading sound…'
                : soundArmed
                  ? 'Sound starts with your first click or key'
                  : 'Sound off'}
          </p>
        </div>
        <div className="dock">
          {status && (
            <p className="toast" role="status">
              {status}
            </p>
          )}
          <Toolbar
            running={running}
            soundOn={soundOn}
            sound={soundOptions}
            onSound={setSoundOptions}
            cat={catOptions}
            onCat={setCatOptions}
            recording={recording}
            options={exportOptions}
            menuOpen={menuOpen}
            onOptions={setExportOptions}
            onMenu={setMenuOpen}
            onAction={(name) => actionRef.current(name)}
          />
        </div>
      </footer>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      {!immersive && (
        <DialRoot position="top-right" theme="dark" productionEnabled defaultOpen={window.innerWidth > 760} />
      )}
    </>
  )
}
