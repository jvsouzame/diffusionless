/**
 * The tiny pixel residents of the canvas: three cats and a couple.
 *
 * They are drawn on their own layer, in the palette's darkest and lightest colors,
 * so they read as part of the image without ever reaching the simulation's pixels
 * or the exports. Their layer has a finer grid than the simulation, which keeps them
 * tiny at any resolution. What does reach the simulation is where they walk: their
 * steps seed the field.
 *
 * Cats have a mind of their own: each follows the pointer only some of the time, and
 * otherwise sits still, wanders off, or plays by itself in short dashes and hops.
 * The couple ignores the pointer and strolls together, one leading, one keeping close.
 */

// '#' outline, 'o' fill, 'e' eye, '.' empty. Sprites face right.
type Sprite = string[]

const CAT_SIT: Sprite = [
  '.....#..#...',
  '....#o##o#..',
  '....#oooo#..',
  '....#eooe#..',
  '....#oooo#..',
  '.....#oo#...',
  '....#oooo#..',
  '#..#oooooo#.',
  '#o.#oooooo#.',
  '.#o#oooooo#.',
  '..########..',
]
const CAT_SIT_TAIL: Sprite = [...CAT_SIT.slice(0, 7), '...#oooooo#.', '#..#oooooo#.', '#oo#oooooo#.', '.#########..']
const CAT_WALK_A: Sprite = [
  '..........#.#.',
  '#........#o#o#',
  '#o.......#ooo#',
  '.#o######oeoo#',
  '..#ooooooooo#.',
  '..#oooooooo#..',
  '..#o##oo##o#..',
  '..#o#.#o#.#o#.',
  '..##..##..##..',
]
const CAT_WALK_B: Sprite = [...CAT_WALK_A.slice(0, 6), '..#oo####oo#..', '...#o#..#o#...', '...##...##....']
const CAT_SLEEP: Sprite = [
  '....####....',
  '..##oooo##..',
  '.#oooooooo#.',
  '#oo#oooo#oo#',
  '#oooooooooo#',
  '.##########.',
]

// The couple: one in trousers, one in a dress.
const HE_STAND: Sprite = [
  '..###..',
  '.#ooo#.',
  '.#ooe#.',
  '.#ooo#.',
  '..###..',
  '.#ooo#.',
  '#ooooo#',
  '#o#o#o#',
  '.#ooo#.',
  '.#o#o#.',
  '.#o#o#.',
  '.##.##.',
]
const HE_WALK: Sprite = [...HE_STAND.slice(0, 9), '.#o#o#.', '#o#.#o#', '##...##']
const SHE_STAND: Sprite = [
  '.####..',
  '##ooo#.',
  '##ooe#.',
  '##ooo#.',
  '.####..',
  '.#ooo#.',
  '#ooooo#',
  '#ooooo#',
  '#######',
  '..#.#..',
  '..#.#..',
  '.##.##.',
]
const SHE_WALK: Sprite = [...SHE_STAND.slice(0, 9), '..#.#..', '.#...#.', '##...##']

const ZED: Sprite = ['oo.', '.o.', '.oo']
const HEART: Sprite = ['.##.##.', '#oo#oo#', '#ooooo#', '.#ooo#.', '..#o#..', '...#...']

const blink = (rows: Sprite): Sprite => rows.map((r) => r.replace(/e/g, 'o'))

type Look = { still: Sprite; stillAlt: Sprite; walkA: Sprite; walkB: Sprite; sleep: Sprite | null }
const CAT_LOOK: Look = { still: CAT_SIT, stillAlt: CAT_SIT_TAIL, walkA: CAT_WALK_A, walkB: CAT_WALK_B, sleep: CAT_SLEEP }
const HE_LOOK: Look = { still: HE_STAND, stillAlt: HE_STAND, walkA: HE_STAND, walkB: HE_WALK, sleep: null }
const SHE_LOOK: Look = { still: SHE_STAND, stillAlt: SHE_STAND, walkA: SHE_STAND, walkB: SHE_WALK, sleep: null }

export type CritterEnv = {
  w: number
  h: number
  /** Pointer position in layer pixels, top-left origin, and seconds since it last moved. */
  cursor: { x: number; y: number; age: number } | null
  painting: boolean
  running: boolean
  /** Beats per second, for the tails. */
  beat: number
}

export type CritterEvents = { step: { x: number; y: number } | null; meow: boolean }

type State = 'still' | 'walk' | 'run' | 'sleep'
type Mood = 'follow' | 'idle' | 'wander' | 'play'
type Kind = 'cat' | 'person'

export class Critter {
  x = -1
  y = -1
  private state: State = 'still'
  private facing = 1
  private clock = Math.random() * 10
  private stillFor = 0
  private restFor = 0
  private wanderIn = Math.random() * 3
  private goal: { x: number; y: number; cursor: boolean } | null = null
  private travelled = 0
  private hop = 0
  private meowIn = 3 + Math.random() * 6
  private mood: Mood = 'idle'
  private moodFor = Math.random() * 3
  private dashIn = 0
  private beat = 1
  private readonly kind: Kind
  private readonly look: Look
  private readonly inverted: boolean
  /** A follower keeps beside its partner instead of choosing its own way. */
  private readonly partner: Critter | null

  constructor(kind: Kind, look: Look, options: { inverted?: boolean; partner?: Critter } = {}) {
    this.kind = kind
    this.look = look
    this.inverted = options.inverted ?? false
    this.partner = options.partner ?? null
  }

  get isMoving() {
    return this.state === 'walk' || this.state === 'run'
  }

  /** A short jump, used when something sudden happens. */
  startle() {
    if (this.state === 'sleep') this.state = 'still'
    this.hop = 0.4
  }

  private pickMood(hasCursor: boolean) {
    const roll = Math.random()
    if (this.kind === 'person') this.mood = roll < 0.45 ? 'idle' : 'wander'
    else if (hasCursor) this.mood = roll < 0.4 ? 'follow' : roll < 0.65 ? 'idle' : roll < 0.85 ? 'play' : 'wander'
    else this.mood = roll < 0.4 ? 'idle' : roll < 0.75 ? 'wander' : 'play'
    this.moodFor = 4 + Math.random() * 8
    this.goal = null
    this.dashIn = 0
  }

  update(dt: number, env: CritterEnv): CritterEvents {
    const events: CritterEvents = { step: null, meow: false }
    if (this.x < 0) {
      this.x = env.w * (0.1 + 0.8 * Math.random())
      this.y = env.h * (0.25 + 0.7 * Math.random())
      if (this.partner && this.partner.x >= 0) {
        this.x = this.partner.x - 10
        this.y = this.partner.y
      }
    }
    this.clock += dt
    this.hop = Math.max(0, this.hop - dt)
    this.meowIn = Math.max(0, this.meowIn - dt)
    this.beat = env.beat

    // A paused simulation is nap time for cats; people just wait.
    if (!env.running) {
      this.stillFor += dt
      if (this.stillFor > 1.5) this.state = this.look.sleep ? 'sleep' : 'still'
      if (this.stillFor > 1.5) return events
    } else {
      this.stillFor = 0
      if (this.state === 'sleep') this.state = 'still'
    }

    const cursor = this.kind === 'cat' && env.cursor && env.cursor.age < 4 ? env.cursor : null
    if (this.partner) {
      // Keep beside the partner, on the side we are already on.
      const side = this.x <= this.partner.x ? -1 : 1
      this.goal = { x: this.partner.x + side * 9, y: this.partner.y, cursor: false }
    } else {
      this.moodFor -= dt
      if (this.moodFor <= 0 || (this.mood === 'follow' && !cursor)) this.pickMood(Boolean(cursor))
      // A brush stroke is hard for a cat to resist, whatever the mood.
      if (cursor && env.painting && this.mood !== 'follow' && Math.random() < dt * 0.8) {
        this.mood = 'follow'
        this.moodFor = 3 + Math.random() * 4
      }
      if (this.mood === 'follow' && cursor) {
        this.goal = { x: cursor.x, y: cursor.y + 4, cursor: true }
      } else if (this.mood === 'idle') {
        this.goal = null
      } else if (this.mood === 'wander') {
        this.wanderIn -= dt
        if (!this.goal && this.wanderIn <= 0) {
          this.goal = { x: Math.random() * env.w, y: env.h * (0.2 + 0.75 * Math.random()), cursor: false }
          this.wanderIn = 2 + Math.random() * 4
        }
      } else {
        // Zoomies: short dashes to nearby spots, with a hop on each landing.
        this.dashIn -= dt
        if (!this.goal && this.dashIn <= 0) {
          const angle = Math.random() * Math.PI * 2
          const reachOut = 14 + Math.random() * 26
          this.goal = {
            x: Math.min(env.w - 8, Math.max(8, this.x + Math.cos(angle) * reachOut)),
            y: Math.min(env.h - 1, Math.max(14, this.y + Math.sin(angle) * reachOut * 0.6)),
            cursor: false,
          }
          this.dashIn = 0.3 + Math.random() * 0.9
        }
      }
    }

    if (this.goal) {
      const dx = this.goal.x - this.x
      const dy = this.goal.y - this.y
      const dist = Math.hypot(dx, dy)
      const reach = this.goal.cursor ? 10 : 2
      if (dist > reach) {
        const fast = this.kind === 'cat' && ((this.goal.cursor && env.painting) || this.mood === 'play')
        this.state = fast ? 'run' : 'walk'
        const pace = this.kind === 'person' ? 11 : fast ? 46 : 20
        const step = Math.min(dist - reach, pace * dt)
        this.x += (dx / dist) * step
        this.y += (dy / dist) * step
        if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1
        this.travelled += step
        this.restFor = 0
        if (this.travelled > 5) {
          this.travelled = 0
          events.step = { x: this.x, y: this.y }
        }
      } else {
        if (this.state !== 'still' && this.goal.cursor && this.meowIn <= 0) {
          events.meow = true
          this.meowIn = 12 + Math.random() * 8
        }
        this.state = 'still'
        this.restFor += dt
        if (this.partner) this.facing = this.partner.x >= this.x ? 1 : -1
        else if (!this.goal.cursor) {
          this.goal = null
          if (this.mood === 'play') this.hop = 0.4
        }
      }
    } else {
      this.state = 'still'
      this.restFor += dt
    }

    this.x = Math.min(env.w - 8, Math.max(8, this.x))
    this.y = Math.min(env.h - 1, Math.max(14, this.y))
    return events
  }

  draw(ctx: CanvasRenderingContext2D, dark: string, light: string) {
    if (this.x < 0) return
    const look = this.look
    let rows: Sprite
    if (this.state === 'sleep' && look.sleep) rows = look.sleep
    else if (this.state === 'still') {
      rows = Math.floor(this.clock * this.beat) % 2 ? look.stillAlt : look.still
      if (this.clock % 4 < 0.15) rows = blink(rows)
    } else {
      const pace = this.state === 'run' ? 0.09 : this.kind === 'person' ? 0.24 : 0.17
      rows = Math.floor(this.clock / pace) % 2 ? look.walkB : look.walkA
    }
    const fill = this.inverted ? dark : light
    const line = this.inverted ? light : dark
    const cols = rows[0].length
    const lift = this.hop > 0 ? Math.round(Math.sin((Math.PI * this.hop) / 0.4) * 6) : 0
    const left = Math.round(this.x - cols / 2)
    const top = Math.round(this.y - rows.length) - lift
    const put = (sprite: Sprite, ox: number, oy: number, flip: boolean) => {
      const n = sprite[0].length
      sprite.forEach((row, r) => {
        for (let c = 0; c < n; c++) {
          const ch = row[flip ? n - 1 - c : c]
          if (ch === '.') continue
          ctx.fillStyle = ch === 'o' ? fill : line
          ctx.fillRect(ox + c, oy + r, 1, 1)
        }
      })
    }
    put(rows, left, top, this.facing < 0)
    if (this.state === 'sleep' && Math.floor(this.clock / 0.8) % 2) put(ZED, left + cols, top - 4, false)
    // A couple standing together for a while gets a heart.
    if (this.partner && this.restFor > 2.5 && this.partner.restFor > 2.5 && Math.floor(this.clock / 0.7) % 3 !== 0) {
      put(HEART, Math.round((this.x + this.partner.x) / 2 - 3.5), top - 8, false)
    }
  }
}

/** Three cats (one of them dark) and a couple. */
export function createResidents(): Critter[] {
  const he = new Critter('person', HE_LOOK)
  const she = new Critter('person', SHE_LOOK, { partner: he })
  return [
    he,
    she,
    new Critter('cat', CAT_LOOK),
    new Critter('cat', CAT_LOOK, { inverted: true }),
    new Critter('cat', CAT_LOOK),
  ]
}
