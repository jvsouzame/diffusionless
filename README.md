# diffusionless

A local tool for exploring reaction-diffusion patterns as pixel art, with a generative soundtrack that follows the pattern.

```
npm install
npm run dev
```

- **Models:** Gray-Scott, FitzHugh-Nagumo and a three-species cyclic model in the Belousov-Zhabotinsky style.
- **Explore:** Randomize (X), Mutate (M), the XY pad, and Parameter Map (P): the two pad parameters spread across the canvas; click to pick.
- **Canvas:** fills the window by default; drag to paint, Shift or right-drag to erase. F toggles fullscreen.
- **Sound:** written in [Strudel](https://strudel.cc) (`src/sound.ts`). It starts on the first click or key press and S turns it off with a fade. Model, parameters, palette, tone, seed, brush and the state of the canvas steer tonic, mode, filter, layers and tempo.
- **Residents:** three tiny pixel cats and a couple live on the canvas (`src/cat.ts`). Each cat sometimes follows the pointer and sometimes plays or sits by itself; the couple strolls together. Cats nap when the simulation is paused, and everyone's steps seed the pattern. They are never part of an export; the cat button in the bottom bar hides them or stops the steps.
- **Export:** PNG, SVG (one fused shape per color), WebM, GIF and a JSON preset that stores the parameters and the grid.

The panel is [DialKit](https://github.com/joshpuckett/dialkit).

## License

AGPL-3.0-or-later, because Strudel is. See `LICENSE`.
