/**
 * Generative soundtrack, written in Strudel and steered by the state of the tool.
 *
 * Discrete musical choices (tonic, mode, lead timbre, chord size, arpeggio shape)
 * are baked into the Strudel code, which is re-evaluated at most once per cycle and
 * moves the mode one step at a time. Continuous ones (filter, space, layer levels)
 * are read by the running pattern through `ref`, so they glide without a restart.
 *
 * Layers follow two rules. A persistent setting keeps its own voice sounding for as
 * long as it is away from its default (noise, speed, colors, map mode). None of them
 * uses a noise source: an earlier version did, and it read as hiss.
 * A one-off action (randomize, mutate, a brush stroke, the cat) plays an accent that
 * fades by itself.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** Brightest to darkest; neighbours differ by a single note. */
export const MODES = ['lydian', 'major', 'mixolydian', 'dorian', 'aeolian', 'phrygian'] as const
const MODE_STEPS: Record<string, number[]> = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
}
/**
 * Each model has its own tonic (a fifth apart), lead voice, chord progression and,
 * above all, its own backing synth, so switching models is an audible change of scene:
 * a warm sustained saw pad, a rhythmic square organ, and a slow glassy supersaw wash.
 */
const VOICES = [
  {
    tonic: 'C',
    midi: 48,
    lead: 'sawtooth',
    roots: [0, 3, 5, 4],
    padShift: 0,
    pad: (chords: string) => `n("${chords}")
  .s("sawtooth").attack(1.1).release(2.4)
  .lpf(cut(400, 2200)).pan(sine.range(0.35, 0.65).slow(8))`,
    drone: `n("[-7,-3,0]")
  .s("sawtooth").attack(2).release(3).lpf(cut(220, 900)).pan("<0.35 0.65>/2")`,
  },
  {
    tonic: 'G',
    midi: 55,
    lead: 'triangle',
    roots: [0, 6, 5, 6],
    padShift: 0,
    pad: (chords: string) => `n("${chords}").struct("x ~ x x ~ x ~ x")
  .s("square").decay(0.16).sustain(0.2).release(0.1)
  .lpf(cut(500, 2800)).phaser(0.5).pan("<0.3 0.7>")`,
    drone: `n("-7*4")
  .s("square").decay(0.2).sustain(0.3).release(0.1).lpf(cut(160, 520))`,
  },
  {
    tonic: 'D',
    midi: 50,
    lead: 'sine',
    roots: [0, 2, 5, 3],
    padShift: 7,
    pad: (chords: string) => `n("${chords}/2")
  .s("supersaw").attack(2.2).release(3.5)
  .lpf(cut(700, 3600)).chorus(0.6).tremolo(3).pan(sine.range(0.2, 0.8).slow(5))`,
    drone: `n("[-7,-3]")
  .s("sine").attack(2.5).release(3.5)`,
  },
]
const CHORD_ORDER = [0, 4, 2, 6, 8]
const ARP_SHAPES = [
  [0, 4, 9, 4, 7, 4, 9, 4],
  [9, 7, 4, 0, 4, 7, 9, 11],
  [0, 4, 7, 9, 11, 9, 7, 4],
  [0, 9, 4, 11, 7, 9, 4, 7],
]
const BASE_CPS = 0.25
const FADE_IN = 1
const FADE_OUT = 5

export type SoundInput = {
  /** Model index, 0 to 2. */
  model: number
  /** Normalized position of the two pad parameters, 0 to 1. */
  padX: number
  padY: number
  /** Simulation speed in iterations per frame, 1 to 64. */
  speed: number
  running: boolean
  /** Share of the image that is not background, 0 to 1. */
  coverage: number
  /** Share of pixels that changed since the previous reading, 0 to 1. */
  activity: number
  /** Mean lightness of the palette, 0 to 1. */
  lightness: number
  colorCount: number
  contrast: number
  dither: number
  grain: number
  /** Simulation noise, 0 to 1 each. */
  jitter: number
  field: number
  /** Long side of the grid in cells. */
  resolution: number
  /** Parameter Map mode. */
  map: boolean
  seed: number
  volume: number
  reactivity: number
}

type Discrete = {
  model: number
  mode: number
  chord: number
  shape: number
  register: number
  cps: number
  hats: number
  /** A coarse grid swaps the lead for a short square wave, chiptune style. */
  chip: boolean
}

const sat = (v: number) => Math.min(1, Math.max(0, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

function pieceCode(d: Discrete): string {
  const voice = VOICES[d.model]
  const scale = `${voice.tonic}:${MODES[d.mode]}`
  const CHORD_ROOTS = voice.roots
  const chord = (root: number) =>
    `[${CHORD_ORDER.slice(0, d.chord)
      .map((o) => root + o + voice.padShift)
      .join(',')}]`
  const chords = `<${CHORD_ROOTS.map(chord).join(' ')}>`
  const shape = ARP_SHAPES[d.shape % ARP_SHAPES.length]
  const arp = `<${CHORD_ROOTS.map((r) => `[${shape.map((o) => r + o + d.register).join(' ')}]`).join(' ')}>`
  const bass = `<${CHORD_ROOTS.map((r) => r - 7).join(' ')}>`
  const top = 7 + d.register
  const melody = `<${[0, 2, 4, 7, 4, 2].map((o) => top + o).join(' ')}>*[0.5,1]`
  const counter = `<${CHORD_ROOTS.map((r) => r + 4).join(' ')}>`
  const answer = `<${CHORD_ROOTS.map((r) => `[${r + 9} ${r + 11}]`).join(' ')}>`
  const bell = `<${CHORD_ROOTS.map((r) => `[~ ${r + 14} ~ ${r + 11}]`).join(' ')}>`

  return `
// Single quotes are plain strings here; double quotes are mini-notation.
const live = globalThis.__diffusionless
const level = (key, amp) => ref(() => live[key] * amp)
const cut = (lo, hi) => ref(() => lo + (hi - lo) * live.cut)
const room = ref(() => live.room)
const echo = ref(() => live.delay)

// Core voices: always part of the arrangement, their level follows the canvas.
const drone = ${voice.drone}
  .scale("${scale}").gain(0.2).room(room)

const pad = ${voice.pad(chords)}
  .scale("${scale}").gain(level('pad', 0.2)).room(room)

const arp = n("${arp}").scale("${scale}")
  .s("${d.chip ? 'square' : voice.lead}").decay(${d.chip ? 0.12 : 0.24}).sustain(0).release(0.1)
  .lpf(cut(700, 3200))
  .gain(level('arp', 0.42))
  .delay(echo).delaytime(0.25).delayfeedback(0.45)
  .room(room).pan(sine.slow(6).range(0.3, 0.7))

const bass = n("${bass}").scale("${scale}")
  .s("triangle").decay(0.5).sustain(0.5).release(0.4)
  .lpf(520).gain(level('bass', 0.5))

const melody = n("${melody}").scale("${scale}")
  .s("sine").vib(2).attack(0.05).release(0.6)
  .gain(level('melody', 0.26)).room(room)
  .delay(echo).delaytime(0.375).delayfeedback(0.5)
  .pan(sine.slow(9).range(0.25, 0.75)).degradeBy(0.2)

const pulse = n("0 ~ ~ ~").scale("${scale}").s("sine").decay(0.18).sustain(0).lpf(400).gain(level('pulse', 0.45))

// Setting voices: each one sounds while its control is away from the default.
const grain = n("14 16 18 21 18 16 14 11").scale("${scale}")
  .s("sine").decay(0.06).sustain(0).release(0.05)
  .gain(level('grain', 0.16)).pan(sine.slow(5).range(0.2, 0.8)).degradeBy(0.45)

const hats = n("21*${d.hats}").scale("${scale}")
  .s("triangle").decay(0.03).sustain(0).release(0.02)
  .gain(level('hats', 0.12)).pan(sine.slow(3).range(0.3, 0.7)).degradeBy(0.25)

const counter = n("${counter}").scale("${scale}")
  .s("square").attack(0.4).release(1.2).lpf(cut(500, 1400))
  .gain(level('color3', 0.1)).room(room).pan(0.3)

const answer = n("${answer}").scale("${scale}")
  .s("triangle").decay(0.4).sustain(0.1).release(0.4)
  .gain(level('color4', 0.2)).delay(echo).delaytime(0.5).delayfeedback(0.4).room(room).pan(0.7)

const bell = n("${bell}").scale("${scale}")
  .s("sine").fm(3).fmh(2.01).decay(0.6).sustain(0).release(0.5)
  .gain(level('color5', 0.16)).room(room).delay(echo)

const shimmer = n("[14,15,18]").scale("${scale}")
  .s("sine").attack(1.5).release(2).tremolo(6)
  .gain(level('map', 0.12)).room(0.8)

const settings = stack(grain, hats, counter, answer, bell, shimmer)

stack(
  settings,
  arrange(
    [8, stack(drone, pad)],
    [8, stack(drone, pad, arp)],
    [8, stack(drone, pad, arp, bass, pulse)],
    [8, stack(drone, pad, arp, bass, pulse, melody)],
    [8, stack(drone, pad, arp.degradeBy(0.3), bass)]
  )
)
`
}

type Live = {
  cut: number
  room: number
  delay: number
  pad: number
  arp: number
  bass: number
  melody: number
  pulse: number
  grain: number
  hats: number
  color3: number
  color4: number
  color5: number
  map: number
}

/** A short silent WAV, used to move iOS audio out of the "ambient" category. */
function silentWav(): string {
  const samples = 800
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (at: number, value: string) => [...value].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true)
  view.setUint32(28, 8000, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  bytes.fill(128, 44)
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export class Sound {
  private silent: HTMLAudioElement | null = null
  private strudel: Any = null
  private repl: Any = null
  private loading: Promise<void> | null = null
  private timer = 0
  private stopTimer = 0
  private active = false
  private input: SoundInput | null = null
  private current: Discrete | null = null
  private lastCycle = -1
  private lastOrnament = 0
  /** Live values the running pattern reads through `ref`. */
  private live: Live = {
    cut: 0.4,
    room: 0.4,
    delay: 0.3,
    pad: 1,
    arp: 0,
    bass: 0,
    melody: 0,
    pulse: 0,
    grain: 0,
    hats: 0,
    color3: 0,
    color4: 0,
    color5: 0,
    map: 0,
  }
  private target: Live = { ...this.live }
  onLabel: (label: string) => void = () => {}

  get isOn() {
    return this.active
  }

  /** Cycles per second of the running piece, for anything that moves to the beat. */
  get cps() {
    return this.current?.cps ?? BASE_CPS
  }

  private async load() {
    if (this.strudel) return
    const S: Any = await import('@strudel/web')
    await S.initAudio()
    S.miniAllStrings?.()
    const repl = S.webaudioRepl({ transpiler: S.transpiler })
    await Promise.all([S.evalScope(S), S.registerSynthSounds()])
    S.setTime(() => repl.scheduler.now())
    ;(globalThis as Any).__diffusionless = this.live
    this.strudel = S
    this.repl = repl
  }

  private master(): GainNode | null {
    return this.strudel?.getSuperdoughAudioController?.()?.output?.destinationGain ?? null
  }

  private ramp(to: number, seconds: number) {
    const gain = this.master()
    const ac: AudioContext | undefined = this.strudel?.getAudioContext?.()
    if (!gain || !ac) return
    const now = ac.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(to, now + seconds)
  }

  /** Downloads and prepares Strudel ahead of time, so the first gesture can start audio at once. */
  preload() {
    this.loading ??= this.load()
    this.loading.catch(() => {
      this.loading = null
    })
  }

  /** True once the browser has actually let the audio run. */
  get isAudible() {
    return this.strudel?.getAudioContext?.().state === 'running'
  }

  /**
   * Asks the browser to let audio through. Phones only honour this from inside a tap
   * or key handler, synchronously, so it must be the first thing such a handler calls
   * and must not sit behind an `await`. Safe to call on every gesture.
   */
  unlock() {
    // iPhones route Web Audio through the ringer switch. Declaring the session as
    // playback (or, on older systems, playing a silent clip) lets it sound in silent mode.
    const session = (navigator as Any).audioSession
    if (session) {
      try {
        session.type = 'playback'
      } catch {
        /* not settable here */
      }
    } else if (isIOS()) {
      this.silent ??= Object.assign(new Audio(silentWav()), { loop: true })
      void this.silent.play().catch(() => {})
    }
    const ac: AudioContext | undefined = this.strudel?.getAudioContext?.()
    if (ac && ac.state !== 'running') void ac.resume().catch(() => {})
  }

  /** Call from a user gesture: browsers only start audio on one. */
  async start(input: SoundInput) {
    this.input = input
    this.active = true
    window.clearTimeout(this.stopTimer)
    this.unlock()
    this.loading ??= this.load()
    await this.loading
    if (!this.active) return
    // Not awaited: where the gesture has expired this would never settle. The next tap unlocks it.
    this.unlock()
    const gain = this.master()
    if (gain && !this.repl.scheduler.started) gain.gain.value = 0
    this.retarget(true)
    Object.assign(this.live, this.target)
    this.current = this.desired(null)
    await this.evaluate(this.current)
    this.ramp(input.volume, FADE_IN)
    window.clearInterval(this.timer)
    this.timer = window.setInterval(() => this.tick(), 50)
  }

  /** Fades out, then stops the scheduler. */
  stop() {
    if (!this.active) return
    this.active = false
    window.clearInterval(this.timer)
    this.ramp(0, FADE_OUT)
    this.onLabel('')
    this.silent?.pause()
    window.clearTimeout(this.stopTimer)
    this.stopTimer = window.setTimeout(() => {
      if (!this.active) this.repl?.stop()
    }, FADE_OUT * 1000 + 150)
  }

  update(input: SoundInput) {
    const volumeChanged = this.input && this.input.volume !== input.volume
    this.input = input
    if (!this.active || !this.repl) return
    if (volumeChanged) this.ramp(input.volume, 0.15)
    this.retarget(false)
  }

  private midi(degree: number): number {
    const d = this.current!
    const steps = MODE_STEPS[MODES[d.mode]]
    return VOICES[d.model].midi + steps[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7)
  }

  private shot(value: Record<string, unknown>, delay: number, duration: number) {
    const ac: AudioContext = this.strudel.getAudioContext()
    this.strudel.superdough(
      { room: this.live.room, delay: this.live.delay, delaytime: 0.25, delayfeedback: 0.4, ...value },
      ac.currentTime + 0.02 + delay,
      duration,
    )
  }

  private get ready() {
    return this.active && this.current !== null && this.strudel !== null
  }

  /**
   * The sound of touching the canvas, different in each model so the gesture itself
   * changes character: soft rising plucks, low percussive stabs, or slow glassy bells.
   * `height` and `across` are the pointer position, 0 to 1.
   */
  ornament(height: number, across = 0.5) {
    if (!this.ready) return
    const model = this.current!.model
    const now = performance.now()
    if (now - this.lastOrnament < [140, 105, 280][model]) return
    this.lastOrnament = now
    const register = this.current!.register
    const pan = 0.2 + 0.6 * sat(across)
    if (model === 0) {
      // Gray-Scott: one plucked note per step, climbing with the pointer.
      const degree = Math.floor(sat(height) * 10) + 7 + register
      this.shot({ s: 'triangle', note: this.midi(degree), gain: 0.3, decay: 0.3, sustain: 0, release: 0.2, lpf: 2600, pan }, 0, 0.3)
    } else if (model === 1) {
      // FitzHugh-Nagumo: a dry, low square stab over a sub note, like striking the medium.
      const degree = Math.floor(sat(height) * 7) + register
      this.shot({ s: 'square', note: this.midi(degree), gain: 0.24, decay: 0.09, sustain: 0, release: 0.05, lpf: 1400, room: 0.1, delay: 0, pan }, 0, 0.1)
      this.shot({ s: 'sine', note: this.midi(degree - 7), gain: 0.3, decay: 0.14, sustain: 0, release: 0.06, room: 0, delay: 0 }, 0, 0.14)
    } else {
      // Belousov-Zhabotinsky: a slow FM bell and its third, ringing into the room.
      const degree = Math.floor(sat(height) * 9) + 9 + register
      const bell = { s: 'sine', fm: 3, fmh: 2.01, decay: 1.3, sustain: 0, release: 0.9, room: 0.8, delay: 0.5, delaytime: 0.375 }
      this.shot({ ...bell, note: this.midi(degree), gain: 0.24, pan }, 0, 1.3)
      this.shot({ ...bell, note: this.midi(degree + 2), gain: 0.16, pan: 1 - pan }, 0.09, 1.3)
    }
  }

  /** One-off accents for actions; they fade by themselves. */
  accent(kind: 'randomize' | 'mutate' | 'meow' | 'paw') {
    if (!this.ready) return
    if (kind === 'randomize') {
      // A rising swell on root, fifth and octave.
      ;[0, 4, 7, 11].forEach((degree, i) =>
        this.shot(
          { s: 'sawtooth', note: this.midi(degree), gain: 0.14, attack: 0.7, release: 1.8, lpf: 900 + i * 500, room: 0.7 },
          i * 0.12,
          1.2,
        ),
      )
    } else if (kind === 'mutate') {
      this.shot({ s: 'triangle', note: this.midi(9), gain: 0.22, attack: 0.02, decay: 0.5, sustain: 0, release: 0.4 }, 0, 0.5)
      this.shot({ s: 'triangle', note: this.midi(11), gain: 0.16, attack: 0.02, decay: 0.5, sustain: 0, release: 0.4 }, 0.14, 0.5)
    } else if (kind === 'meow') {
      // Two slurred notes, high then falling.
      this.shot({ s: 'sawtooth', note: this.midi(18), gain: 0.16, attack: 0.04, release: 0.12, lpf: 1800, vib: 6, vowel: 'e' }, 0, 0.16)
      this.shot({ s: 'sawtooth', note: this.midi(16), gain: 0.16, attack: 0.03, release: 0.3, lpf: 1300, vib: 6, vowel: 'a' }, 0.15, 0.3)
    } else {
      this.shot({ s: 'sine', note: this.midi(14 + Math.floor(Math.random() * 5)), gain: 0.1, decay: 0.12, sustain: 0, release: 0.1 }, 0, 0.12)
    }
  }

  private retarget(initial: boolean) {
    const i = this.input
    if (!i) return
    const r = i.reactivity
    const t = this.target
    const energy = sat(Math.sqrt(i.activity * 8))
    const presence = i.coverage > 0.02 ? 1 : 0
    // Paused or empty canvas: fall back to the drone. With no reactivity, play the full arrangement.
    const amount = !i.running || !presence ? 0 : 0.35 + 0.65 * energy
    const layers = 4 * mix(1, amount, initial ? Math.min(r, 0.6) : r)
    t.pad = 0.3 + 0.7 * sat(layers)
    t.arp = sat(layers - 0.7)
    t.bass = sat(layers - 1.5)
    t.melody = sat(layers - 2.5)
    t.pulse = sat(layers - 3.2)
    t.cut = mix(0.45, sat(i.coverage * 1.2), r)
    t.room = mix(0.4, sat(0.2 + 0.6 * Math.max(i.dither * 0.7, i.grain)), r)
    t.delay = mix(0.3, sat(0.12 + 0.45 * sat((i.contrast - 0.2) / 3)), r)
    // Setting voices: silent at the defaults, louder the further a control is from them.
    const on = i.running ? r : 0
    t.grain = on * sat(Math.max(i.jitter, i.field) * 1.5)
    t.hats = on * sat((i.speed - 8) / 24)
    t.color3 = on * (i.colorCount >= 3 ? 1 : 0)
    t.color4 = on * (i.colorCount >= 5 ? 1 : 0)
    t.color5 = on * (i.colorCount >= 7 ? 1 : 0)
    t.map = i.map ? Math.max(r, 0.3) : 0
  }

  /** The discrete state the inputs ask for; the mode moves one step from the current one. */
  private desired(from: Discrete | null): Discrete {
    const i = this.input!
    const r = i.reactivity
    const brightness = (i.padX + i.padY) / 2
    const modeTarget = Math.round(mix(1, (1 - brightness) * (MODES.length - 1), r))
    let mode = modeTarget
    if (from && from.model === i.model) mode = from.mode + Math.sign(modeTarget - from.mode)
    const energy = sat(Math.sqrt(i.activity * 8))
    const tempo = 1 + 0.15 * r * (i.running ? 0.7 * energy + 0.3 * sat((i.speed - 1) / 63) : 0)
    return {
      model: i.model,
      mode,
      chord: Math.min(5, Math.max(2, Math.round(mix(3, i.colorCount, r)))),
      shape: Math.abs(Math.round(i.seed)) % ARP_SHAPES.length,
      register: r > 0.2 ? (i.lightness > 0.6 ? 7 : i.lightness < 0.22 ? -7 : 0) : 0,
      cps: Math.round(BASE_CPS * tempo * 200) / 200,
      hats: i.speed > 32 ? 16 : 8,
      chip: r > 0.2 && i.resolution < 96,
    }
  }

  private async evaluate(d: Discrete) {
    this.repl.setCps(d.cps)
    await this.repl.evaluate(pieceCode(d), true)
    this.onLabel(`${VOICES[d.model].tonic} ${MODES[d.mode]} · ${Math.round(d.cps * 240)} bpm`)
  }

  private tick() {
    // Glide the continuous values: about two seconds to settle.
    const k = 1 - Math.exp(-0.05 / 0.7)
    for (const key of Object.keys(this.live) as (keyof Live)[]) {
      this.live[key] += (this.target[key] - this.live[key]) * k
    }
    // Discrete changes: at most one per cycle, on the turn of the bar.
    const cycle = Math.floor(this.repl.scheduler.now())
    if (cycle === this.lastCycle || !this.current) return
    this.lastCycle = cycle
    const next = this.desired(this.current)
    const changed = (Object.keys(next) as (keyof Discrete)[]).some((key) => next[key] !== this.current![key])
    if (!changed) return
    this.current = next
    void this.evaluate(next)
  }
}
