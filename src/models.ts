export type ParamDef = {
  key: string
  label: string
  def: number
  min: number
  max: number
  step: number
}

export type ModelPreset = { name: string; values: number[] }

export type ModelDef = {
  key: string
  name: string
  index: number
  padKey: string
  /** Uniform order is [padX, padY, ...params]. */
  padX: ParamDef
  padY: ParamDef
  params: ParamDef[]
  presets: ModelPreset[]
  /** Picks a parameter set from regions known to form patterns. */
  randomize: (rnd: () => number) => number[]
}

const range = (rnd: () => number, a: number, b: number) => a + (b - a) * rnd()

export const MODELS: Record<string, ModelDef> = {
  grayScott: {
    key: 'grayScott',
    name: 'Gray-Scott',
    index: 0,
    padKey: 'killFeed',
    padX: { key: 'kill', label: 'kill', def: 0.062, min: 0.03, max: 0.075, step: 0.0001 },
    padY: { key: 'feed', label: 'feed', def: 0.0545, min: 0.005, max: 0.11, step: 0.0001 },
    params: [
      { key: 'diffusionA', label: 'Diffusion A', def: 1.0, min: 0.2, max: 1.2, step: 0.01 },
      { key: 'diffusionB', label: 'Diffusion B', def: 0.5, min: 0.1, max: 0.8, step: 0.01 },
    ],
    presets: [
      { name: 'Coral', values: [0.062, 0.0545, 1, 0.5] },
      { name: 'Mitosis', values: [0.0649, 0.0367, 1, 0.5] },
      { name: 'Maze', values: [0.057, 0.029, 1, 0.5] },
      { name: 'Solitons', values: [0.062, 0.03, 1, 0.5] },
      { name: 'Worms', values: [0.061, 0.078, 1, 0.5] },
      { name: 'Holes', values: [0.058, 0.039, 1, 0.5] },
      { name: 'Waves', values: [0.045, 0.014, 1, 0.5] },
      { name: 'U-Skate', values: [0.0609, 0.062, 1, 0.5] },
    ],
    randomize: (rnd) => {
      // Patterns live in a thin band around the saddle-node curve k = sqrt(f)/2 - f.
      const feed = range(rnd, 0.012, 0.085)
      const kill = Math.sqrt(feed) / 2 - feed + range(rnd, -0.003, 0.006)
      return [kill, feed, 1, range(rnd, 0.35, 0.55)]
    },
  },
  fitzhughNagumo: {
    key: 'fitzhughNagumo',
    name: 'FitzHugh-Nagumo',
    index: 1,
    padKey: 'biasGain',
    padX: { key: 'bias', label: 'bias', def: -0.02, min: -1, max: 1, step: 0.005 },
    padY: { key: 'gain', label: 'gain', def: 1, min: 0, max: 2, step: 0.005 },
    params: [
      { key: 'epsilon', label: 'Epsilon', def: 0.9, min: 0.005, max: 1, step: 0.005 },
      { key: 'diffusionU', label: 'Diffusion U', def: 0.25, min: 0.05, max: 1, step: 0.01 },
      { key: 'diffusionV', label: 'Diffusion V', def: 5, min: 0, max: 8, step: 0.05 },
    ],
    presets: [
      { name: 'Maze', values: [-0.02, 1, 0.9, 0.25, 5] },
      { name: 'Lattice', values: [-0.1, 1, 0.5, 0.25, 5] },
      { name: 'Spots', values: [-0.17, 1, 0.5, 0.25, 5] },
      { name: 'Pulse', values: [-0.1, 0.5, 0.2, 0.25, 5] },
      { name: 'Spirals', values: [0, 0, 0.03, 0.5, 0] },
      { name: 'Waves', values: [-0.5, 0, 0.05, 0.6, 0] },
      { name: 'Fine Maze', values: [-0.08, 1, 0.6, 0.1, 2.5] },
    ],
    randomize: (rnd) => {
      if (rnd() < 0.6) {
        const sign = rnd() < 0.5 ? -1 : 1
        return [
          sign * range(rnd, 0.07, 0.2),
          range(rnd, 0.8, 1.2),
          range(rnd, 0.35, 0.8),
          range(rnd, 0.1, 0.3),
          range(rnd, 3, 7),
        ]
      }
      return [
        range(rnd, -0.5, 0.5),
        range(rnd, 0, 0.5),
        range(rnd, 0.01, 0.1),
        range(rnd, 0.3, 1),
        range(rnd, 0, 0.3),
      ]
    },
  },
  belousovZhabotinsky: {
    key: 'belousovZhabotinsky',
    name: 'Belousov-Zhabotinsky',
    index: 2,
    padKey: 'rates',
    padX: { key: 'alpha', label: 'alpha', def: 0.5, min: 0, max: 1.2, step: 0.005 },
    padY: { key: 'beta', label: 'beta', def: 2, min: 0.8, max: 3, step: 0.005 },
    params: [
      { key: 'diffusion', label: 'Diffusion', def: 0.6, min: 0.05, max: 1, step: 0.01 },
      { key: 'rate', label: 'Rate', def: 0.4, min: 0.05, max: 0.5, step: 0.01 },
    ],
    presets: [
      { name: 'Spirals', values: [0.5, 2, 0.6, 0.4] },
      { name: 'Tight', values: [0.2, 3, 0.25, 0.4] },
      { name: 'Loose', values: [0.8, 1.5, 1, 0.4] },
      { name: 'Drift', values: [0.7, 1.8, 0.8, 0.4] },
      { name: 'Sharp', values: [0, 2, 0.4, 0.4] },
    ],
    randomize: (rnd) => [range(rnd, 0.1, 0.9), range(rnd, 1.3, 2.8), range(rnd, 0.3, 1), range(rnd, 0.25, 0.5)],
  },
}

export const MODEL_KEYS = Object.keys(MODELS)
export const DEFAULT_MODEL = 'grayScott'

export const allParams = (m: ModelDef): ParamDef[] => [m.padX, m.padY, ...m.params]
