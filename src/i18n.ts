/**
 * English and Portuguese for the whole interface.
 *
 * The interface strings are a plain dictionary. The parameter panel is different:
 * DialKit derives each label from its config key and each folder from its nesting,
 * so the panel is its own arrangement of the app's values. The app keeps a canonical
 * config (nine small groups, English keys); the panel shows four folders, in the
 * chosen language. This file converts between the two, in both directions.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export type Lang = 'en' | 'pt'

const en = {
  actions: 'Actions',
  language: 'Language',
  close: 'Close',
  play: 'Play',
  pause: 'Pause',
  reseed: 'Restart',
  randomize: 'Randomize',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  fullscreen: 'Fullscreen',
  controls: 'Controls',
  more: 'More',
  export: 'Export',
  step: 'Step',
  newSeed: 'New variation',
  clear: 'Clear',
  mutate: 'Mutate',
  savePreset: 'Save preset',
  loadPreset: 'Load preset',
  sound: 'Sound',
  volume: 'Volume',
  reactivity: 'Reactivity',
  residents: 'Residents',
  visible: 'Visible',
  visibleHint: 'Show the cats and the couple',
  paws: 'Paws',
  pawsHint: 'Their steps seed the pattern',
  source: 'Source code',
  format: 'Format',
  scale: 'Scale',
  duration: 'Duration',
  record: 'Record',
  stop: 'Stop',
  muteHint: 'Click or press S to mute',
  playHint: 'Click or press S to play',
  paused: 'Paused',
  soundArmed: 'Sound starts with your first click or key',
  soundOffInfo: 'Sound off',
  soundLoading: 'Loading sound…',
  mapHint: 'Map: {x} → x, {y} → y · click the canvas to pick',
  notPreset: 'Not a diffusionless preset',
  corruptPreset: 'Preset grid is corrupted',
  unreadablePreset: 'Could not read preset',
  noVideo: 'Video recording is not supported in this browser',
  soundFailed: 'Sound failed to start',
  noFullscreen: 'Fullscreen is not available',
}

const pt: typeof en = {
  actions: 'Ações',
  language: 'Idioma',
  close: 'Fechar',
  play: 'Reproduzir',
  pause: 'Pausar',
  reseed: 'Recomeçar',
  randomize: 'Sortear',
  soundOn: 'Ligar som',
  soundOff: 'Desligar som',
  fullscreen: 'Tela inteira',
  controls: 'Controles',
  more: 'Mais',
  export: 'Exportar',
  step: 'Avançar um passo',
  newSeed: 'Nova variação',
  clear: 'Limpar',
  mutate: 'Mutar',
  savePreset: 'Salvar preset',
  loadPreset: 'Carregar preset',
  sound: 'Som',
  volume: 'Volume',
  reactivity: 'Reatividade',
  residents: 'Moradores',
  visible: 'Visíveis',
  visibleHint: 'Mostrar os gatos e o casal',
  paws: 'Patas',
  pawsHint: 'Os passos semeiam o padrão',
  source: 'Código-fonte',
  format: 'Formato',
  scale: 'Escala',
  duration: 'Duração',
  record: 'Gravar',
  stop: 'Parar',
  muteHint: 'Clique ou tecle S para silenciar',
  playHint: 'Clique ou tecle S para tocar',
  paused: 'Pausado',
  soundArmed: 'O som começa no seu primeiro clique ou tecla',
  soundOffInfo: 'Som desligado',
  soundLoading: 'Carregando som…',
  mapHint: 'Mapa: {x} → x, {y} → y · clique na tela para escolher',
  notPreset: 'Não é um preset do diffusionless',
  corruptPreset: 'A grade do preset está corrompida',
  unreadablePreset: 'Não foi possível ler o preset',
  noVideo: 'Este navegador não grava vídeo',
  soundFailed: 'O som não pôde iniciar',
  noFullscreen: 'Tela inteira indisponível',
}

export type Strings = typeof en
export const STRINGS: Record<Lang, Strings> = { en, pt }

const MODES: Record<Lang, Record<string, string>> = {
  en: {
    lydian: 'Lydian',
    major: 'Major',
    mixolydian: 'Mixolydian',
    dorian: 'Dorian',
    aeolian: 'Aeolian',
    phrygian: 'Phrygian',
  },
  pt: {
    lydian: 'Lídio',
    major: 'Maior',
    mixolydian: 'Mixolídio',
    dorian: 'Dórico',
    aeolian: 'Eólio',
    phrygian: 'Frígio',
  },
}

/** "G Dorian · 62 bpm" in the chosen language. */
export function soundLabel(label: string, lang: Lang): string {
  return label.replace(/\b(lydian|major|mixolydian|dorian|aeolian|phrygian)\b/, (mode) => MODES[lang][mode])
}

/** Canonical panel key to Portuguese key. */
const PANEL_PT: Record<string, string> = {
  model: 'Modelo',
  preset: 'Predefinição',
  killFeed: 'Kill e feed',
  biasGain: 'Viés e ganho',
  rates: 'Taxas',
  diffusionA: 'Difusão A',
  diffusionB: 'Difusão B',
  epsilon: 'Épsilon',
  diffusionU: 'Difusão U',
  diffusionV: 'Difusão V',
  diffusion: 'Difusão',
  rate: 'Ritmo',
  explore: 'Explorar',
  mutation: 'Mutação',
  parameterMap: 'Mapa de parâmetros',
  simulation: 'Simulação',
  speed: 'Velocidade',
  seamless: 'Sem emenda',
  noise: 'Ruído',
  jitter: 'Tremor',
  field: 'Campo',
  fieldScale: 'Escala do campo',
  canvas: 'Tela',
  aspect: 'Proporção',
  resolution: 'Resolução',
  start: 'Início',
  variation: 'Variação',
  pattern: 'Padrão',
  shape: 'Forma',
  density: 'Densidade',
  size: 'Tamanho',
  invert: 'Inverter',
  image: 'Imagem',
  brush: 'Pincel',
  palette: 'Paleta',
  colors: 'Cores',
  tone: 'Tom',
  contrast: 'Contraste',
  offset: 'Deslocamento',
  dither: 'Dithering',
  ditherSize: 'Tamanho do dithering',
  grain: 'Ruído',
  animateGrain: 'Animar ruído',
  color: 'Cor',
  brushSize: 'Tamanho do pincel',
}
for (let i = 1; i <= 8; i++) PANEL_PT[`color${i}`] = `Cor ${i}`

/**
 * The three model folders are all titled "Model". DialKit trims the key to make the
 * label, so their keys differ only by trailing spaces, which keeps one model's
 * parameters from being read as another's.
 */
const MODEL_FOLDERS = ['grayScott', 'fitzhughNagumo', 'belousovZhabotinsky']
const tables = (lang: Lang) => {
  const forward: Record<string, string> = lang === 'pt' ? { ...PANEL_PT } : {}
  MODEL_FOLDERS.forEach((key, i) => (forward[key] = (lang === 'pt' ? 'Modelo' : 'Model') + ' '.repeat(i + 1)))
  const back = Object.fromEntries(Object.entries(forward).map(([k, v]) => [v, k]))
  return { forward, back }
}
const TABLES: Record<Lang, ReturnType<typeof tables>> = { en: tables('en'), pt: tables('pt') }

/** Display labels for select options; the stored values stay lowercase and language-neutral. */
const OPTIONS: Record<Lang, Record<string, string>> = {
  en: {
    spots: 'Spots',
    shape: 'Shape',
    noise: 'Noise',
    image: 'Image',
    dot: 'Dot',
    ring: 'Ring',
    lines: 'Lines',
    grid: 'Grid',
    fill: 'Fill',
  },
  pt: {
    spots: 'Pontos',
    shape: 'Forma',
    noise: 'Ruído',
    image: 'Imagem',
    dot: 'Ponto',
    ring: 'Anel',
    lines: 'Linhas',
    grid: 'Grade',
    fill: 'Preencher',
  },
}

/*
 * Folders. The panel merges the canonical groups that belong together:
 *   Model       model parameters + explore (mutation, parameter map)
 *   Simulation  simulation + canvas + noise
 *   Start       seed + brush. "Seed" is jargon, so the panel says what it is: how the
 *               pattern starts. The seed number is shown as "Variation".
 *   Color       palette + tone
 */
const EXPLORE_KEYS = ['mutation', 'parameterMap']
const CANVAS_KEYS = ['aspect', 'resolution']
const NOISE_KEYS = ['jitter', 'field', 'fieldScale']
const isPaletteKey = (key: string) => key === 'preset' || key === 'colors' || /^color\d$/.test(key)

const body = (group: Any): Any => {
  const { _collapsed: _, ...rest } = group ?? {}
  return rest
}
const pick = (group: Any, keys: string[]): Any => {
  const out: Any = {}
  for (const key of keys) if (group && group[key] !== undefined) out[key] = group[key]
  return out
}
const omit = (group: Any, drop: (key: string) => boolean): Any => {
  const out: Any = {}
  for (const key of Object.keys(group ?? {})) if (!drop(key)) out[key] = group[key]
  return out
}

/** Canonical groups (config or values, whole or partial) arranged into the panel's folders. */
function toFolders(source: Any, modelKey: string, isConfig: boolean): Any {
  const out: Any = {}
  const into = (folder: string, entries: Any) => {
    if (!Object.keys(entries).length && !isConfig) return
    out[folder] = { ...(out[folder] ?? (isConfig ? { _collapsed: true } : {})), ...entries }
  }
  if (source.model !== undefined) out.model = source.model
  for (const key of MODEL_FOLDERS) if (source[key]) into(key, body(source[key]))
  if (source.explore) into(modelKey, body(source.explore))
  if (source.simulation) into('simulation', pick(source.simulation, ['speed']))
  if (source.canvas) into('simulation', body(source.canvas))
  if (source.simulation) into('simulation', pick(source.simulation, ['seamless']))
  if (source.noise) into('simulation', body(source.noise))
  if (source.seed) {
    const { seed: variation, ...rest } = body(source.seed)
    into('start', variation === undefined ? rest : { ...rest, variation })
  }
  if (source.brush && source.brush.size !== undefined) into('start', { brushSize: source.brush.size })
  if (source.palette) into('color', body(source.palette))
  if (source.tone) into('color', body(source.tone))
  return out
}

/** The panel's folders back to the canonical groups. */
function fromFolders(panel: Any): Any {
  const out: Any = { explore: { mutation: 0.03, parameterMap: false } }
  for (const key of Object.keys(panel ?? {})) {
    const group = panel[key]
    if (MODEL_FOLDERS.includes(key)) {
      out[key] = omit(group, (k) => EXPLORE_KEYS.includes(k))
      out.explore = { ...out.explore, ...pick(group, EXPLORE_KEYS) }
    } else if (key === 'simulation') {
      out.simulation = pick(group, ['speed', 'seamless'])
      out.canvas = pick(group, CANVAS_KEYS)
      out.noise = pick(group, NOISE_KEYS)
    } else if (key === 'start') {
      out.seed = { ...omit(group, (k) => k === 'brushSize' || k === 'variation'), seed: group.variation }
      out.brush = { size: group.brushSize }
    } else if (key === 'color') {
      out.palette = omit(group, (k) => !isPaletteKey(k))
      out.tone = omit(group, isPaletteKey)
    } else out[key] = group
  }
  return out
}

const isGroup = (c: Any) => typeof c === 'object' && c !== null && !Array.isArray(c) && !('type' in c)

function translateConfig(config: Any, lang: Lang): Any {
  const names = TABLES[lang].forward
  const out: Any = {}
  for (const key of Object.keys(config)) {
    const c = config[key]
    const name = key === '_collapsed' ? key : (names[key] ?? key)
    if (isGroup(c)) out[name] = translateConfig(c, lang)
    else if (c && c.type === 'select') {
      out[name] = {
        ...c,
        options: c.options.map((o: Any) =>
          typeof o === 'string' && OPTIONS[lang][o] ? { value: o, label: OPTIONS[lang][o] } : o,
        ),
      }
    } else out[name] = c
  }
  return out
}

/** Pad values and other leaf objects carry `x`/`y`; only panel groups are renamed. */
const isValueGroup = (v: Any) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !('x' in v && 'y' in v) && !('type' in v)

function rename(values: Any, table: Record<string, string>): Any {
  const out: Any = {}
  for (const key of Object.keys(values ?? {})) {
    const v = values[key]
    out[table[key] ?? key] = isValueGroup(v) ? rename(v, table) : v
  }
  return out
}

/** The panel config: four folders, labelled in the chosen language. */
export function localizeConfig(config: Any, lang: Lang): Any {
  const modelKey = MODEL_FOLDERS.find((key) => key in config) ?? MODEL_FOLDERS[0]
  return translateConfig(toFolders(config, modelKey, true), lang)
}

/** Canonical values (whole or partial) to the panel's keys. `modelKey` is the model on screen. */
export const localizeValues = (values: Any, lang: Lang, modelKey: string): Any =>
  rename(toFolders(values, modelKey, false), TABLES[lang].forward)

/** The panel's values back to canonical groups and keys. */
export const canonicalValues = (values: Any, lang: Lang): Any => fromFolders(rename(values, TABLES[lang].back))
