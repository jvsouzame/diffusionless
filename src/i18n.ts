/**
 * English and Portuguese for the whole interface.
 *
 * The interface strings are a plain dictionary. The parameter panel is different:
 * DialKit derives each label from its config key, so the Portuguese panel is built
 * by renaming the keys. The app keeps working with the canonical (English) keys and
 * converts at the boundary, in both directions.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export type Lang = 'en' | 'pt'

const en = {
  actions: 'Actions',
  language: 'Language',
  play: 'Play',
  pause: 'Pause',
  reseed: 'Reseed',
  randomize: 'Randomize',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  fullscreen: 'Fullscreen',
  controls: 'Controls',
  more: 'More',
  export: 'Export',
  step: 'Step',
  newSeed: 'New seed',
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
  paused: 'paused',
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
  play: 'Reproduzir',
  pause: 'Pausar',
  reseed: 'Semear de novo',
  randomize: 'Sortear',
  soundOn: 'Ligar som',
  soundOff: 'Desligar som',
  fullscreen: 'Tela inteira',
  controls: 'Controles',
  more: 'Mais',
  export: 'Exportar',
  step: 'Avançar um passo',
  newSeed: 'Nova semente',
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
  paused: 'pausado',
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

const MODES_PT: Record<string, string> = {
  lydian: 'lídio',
  major: 'maior',
  mixolydian: 'mixolídio',
  dorian: 'dórico',
  aeolian: 'eólio',
  phrygian: 'frígio',
}

/** "G dorian · 62 bpm" in the chosen language. */
export function soundLabel(label: string, lang: Lang): string {
  if (lang === 'en') return label
  return label.replace(/\b(lydian|major|mixolydian|dorian|aeolian|phrygian)\b/, (mode) => MODES_PT[mode])
}

/** Canonical panel key to Portuguese key. Model folders keep their proper names. */
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
  seed: 'Semente',
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
  grain: 'Grão',
  animateGrain: 'Animar grão',
}
for (let i = 1; i <= 8; i++) PANEL_PT[`color${i}`] = `Cor ${i}`
const PANEL_EN: Record<string, string> = Object.fromEntries(Object.entries(PANEL_PT).map(([k, v]) => [v, k]))

const OPTIONS_PT: Record<string, string> = {
  spots: 'pontos',
  shape: 'forma',
  noise: 'ruído',
  image: 'imagem',
  dot: 'ponto',
  ring: 'anel',
  lines: 'linhas',
  grid: 'grade',
  fill: 'preencher',
}

const isGroup = (c: Any) => typeof c === 'object' && c !== null && !Array.isArray(c) && !('type' in c)

/** The panel config with its keys (and so its labels) in the chosen language. */
export function localizeConfig(config: Any, lang: Lang): Any {
  if (lang === 'en') return config
  const out: Any = {}
  for (const key of Object.keys(config)) {
    const c = config[key]
    const name = key === '_collapsed' ? key : (PANEL_PT[key] ?? key)
    if (isGroup(c)) out[name] = localizeConfig(c, lang)
    else if (c && c.type === 'select') {
      out[name] = {
        ...c,
        options: c.options.map((o: Any) =>
          typeof o === 'string' && OPTIONS_PT[o] ? { value: o, label: OPTIONS_PT[o] } : o,
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

/** Canonical values to the panel's keys. */
export const localizeValues = (values: Any, lang: Lang): Any => (lang === 'en' ? values : rename(values, PANEL_PT))
/** The panel's values back to canonical keys. */
export const canonicalValues = (values: Any, lang: Lang): Any => (lang === 'en' ? values : rename(values, PANEL_EN))
