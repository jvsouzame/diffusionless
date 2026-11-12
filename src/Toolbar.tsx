import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang, Strings } from './i18n'
import {
  Code,
  Dices,
  Dna,
  Download,
  Ellipsis,
  Eraser,
  FolderOpen,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Save,
  Sprout,
  Square,
  StepForward,
  Volume2,
  VolumeX,
} from 'lucide-react'

export type ExportFormat = 'png' | 'svg' | 'gif' | 'webm'
export type ExportOptions = { format: ExportFormat; scale: number; duration: number }
export type CatOptions = { visible: boolean; paws: boolean }
export type SoundOptions = { volume: number; reactivity: number }
export type RecordingInfo = { kind: 'gif' | 'webm'; until: number }

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'svg', label: 'SVG' },
  { value: 'gif', label: 'GIF' },
  { value: 'webm', label: 'WebM' },
]
const SCALES = [1, 2, 4, 8]
/** The AGPL asks that anyone using the site can reach its source. */
const SOURCE_URL = 'https://github.com/jvsouzame/diffusionless'

type Props = {
  t: Strings
  lang: Lang
  onLang: (lang: Lang) => void
  panelOpen: boolean
  running: boolean
  soundOn: boolean
  sound: SoundOptions
  onSound: (next: SoundOptions) => void
  cat: CatOptions
  onCat: (next: CatOptions) => void
  recording: RecordingInfo | null
  options: ExportOptions
  menuOpen: boolean
  onOptions: (next: ExportOptions) => void
  onMenu: (open: boolean) => void
  onAction: (name: string) => void
}

const icon = { size: 16, strokeWidth: 1.75 }

function Tool(props: { label: string; keys?: string; tip?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="tool"
      aria-label={props.label}
      data-tip={props.tip === false ? undefined : props.keys ? `${props.label} · ${props.keys}` : props.label}
      // Keep focus off the bar on mouse use, so Space keeps meaning play/pause.
      onPointerDown={(ev) => ev.preventDefault()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/** A row of the More menu. */
function Item(props: { label: string; keys?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" className="item" onClick={props.onClick}>
      {props.children}
      <span className="item-label">{props.label}</span>
      {props.keys && <kbd>{props.keys}</kbd>}
    </button>
  )
}

function Switch(props: { label: string; hint: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={props.on} className="switch" onClick={() => props.onChange(!props.on)}>
      <span className="switch-text">
        <span className="switch-label">{props.label}</span>
        <span className="hint">{props.hint}</span>
      </span>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </button>
  )
}

function Slider(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span className="field-label">
        {props.label} <span className="tabular">{Math.round(props.value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={props.value}
        aria-label={props.label}
        onChange={(ev) => props.onChange(Number(ev.target.value))}
      />
    </label>
  )
}

function SoundSliders({ t, sound, onSound }: { t: Strings; sound: SoundOptions; onSound: (next: SoundOptions) => void }) {
  return (
    <>
      <Slider label={t.volume} value={sound.volume} onChange={(volume) => onSound({ ...sound, volume })} />
      <Slider label={t.reactivity} value={sound.reactivity} onChange={(reactivity) => onSound({ ...sound, reactivity })} />
    </>
  )
}

function Remaining({ until }: { until: number }) {
  const [left, setLeft] = useState(() => Math.max(0, until - performance.now()))
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, until - performance.now())), 200)
    return () => window.clearInterval(id)
  }, [until])
  return <span className="tabular">{Math.ceil(left / 1000)}s</span>
}

/** Closes a popover on an outside press or Escape. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (ev: PointerEvent) => {
      if (!ref.current?.contains(ev.target as Node)) close()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

/**
 * The bar shows only the main actions: play, reseed, randomize, sound, fullscreen
 * and export. Everything else lives behind the More button.
 */
export function Toolbar(props: Props) {
  const { t, lang, onLang, panelOpen, running, soundOn, sound, onSound, cat, onCat, recording, options, menuOpen, onOptions, onMenu, onAction } = props
  const exportRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const isVideo = options.format === 'gif' || options.format === 'webm'

  useDismiss(menuOpen, exportRef, () => onMenu(false))
  useDismiss(moreOpen, moreRef, () => setMoreOpen(false))

  const run = (name: string, close = false) => {
    onAction(name)
    if (close) setMoreOpen(false)
  }

  return (
    <div className="toolbar" role="toolbar" aria-label={t.actions}>
      {/* The language is always in sight, as a two-way switch showing which one is on. */}
      <div className="segmented lang" role="group" aria-label={t.language}>
        {(['en', 'pt'] as const).map((code) => (
          <button key={code} type="button" lang={code} aria-pressed={lang === code} onClick={() => onLang(code)}>
            {code === 'en' ? 'English' : 'Português'}
          </button>
        ))}
      </div>
      <span className="divider" />
      <Tool label={running ? t.pause : t.play} keys={lang === 'pt' ? 'Espaço' : 'Space'} onClick={() => onAction('toggleRun')}>
        {running ? <Pause {...icon} /> : <Play {...icon} />}
      </Tool>
      <Tool label={t.reseed} keys="R" onClick={() => onAction('reseed')}>
        <RotateCcw {...icon} />
      </Tool>
      <Tool label={t.randomize} keys="X" onClick={() => onAction('randomize')}>
        <Dices {...icon} />
      </Tool>
      <span className="divider" />
      {/* Hovering the sound button opens its sliders; clicking still toggles the music. */}
      <div className="sound">
        <Tool label={soundOn ? t.soundOff : t.soundOn} tip={false} onClick={() => onAction('toggleSound')}>
          {soundOn ? <Volume2 {...icon} /> : <VolumeX {...icon} />}
        </Tool>
        <div className="volume">
          <div className="volume-card">
            <SoundSliders t={t} sound={sound} onSound={onSound} />
            <span className="hint">{soundOn ? t.muteHint : t.playHint}</span>
          </div>
        </div>
      </div>
      <Tool label={t.fullscreen} keys="F" onClick={() => onAction('toggleFullscreen')}>
        <Maximize {...icon} />
      </Tool>
      <button
        type="button"
        className="tool"
        aria-label={t.controls}
        aria-pressed={panelOpen}
        data-tip={`${t.controls} · D`}
        onPointerDown={(ev) => ev.preventDefault()}
        onClick={() => onAction('togglePanel')}
      >
        <SlidersHorizontal {...icon} />
      </button>
      <span className="divider" />
      <div className="export" ref={moreRef}>
        <button
          type="button"
          className="tool"
          aria-label={t.more}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          data-tip={moreOpen ? undefined : t.more}
          onPointerDown={(ev) => ev.preventDefault()}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Ellipsis {...icon} />
        </button>
        {moreOpen && (
          <div className="menu more" role="menu" aria-label={t.more}>
            <Item label={t.step} keys="." onClick={() => run('step')}>
              <StepForward {...icon} />
            </Item>
            <Item label={t.newSeed} keys="N" onClick={() => run('newSeed')}>
              <Sprout {...icon} />
            </Item>
            <Item label={t.clear} keys="C" onClick={() => run('clear')}>
              <Eraser {...icon} />
            </Item>
            <Item label={t.mutate} keys="M" onClick={() => run('mutate')}>
              <Dna {...icon} />
            </Item>
            <hr />
            <Item label={t.savePreset} onClick={() => run('savePreset', true)}>
              <Save {...icon} />
            </Item>
            <Item label={t.loadPreset} onClick={() => run('loadPreset', true)}>
              <FolderOpen {...icon} />
            </Item>
            <hr />
            <div className="section">
              <span className="section-title">{t.sound}</span>
              <SoundSliders t={t} sound={sound} onSound={onSound} />
            </div>
            <hr />
            <span className="section-title">{t.residents}</span>
            <Switch label={t.visible} hint={t.visibleHint} on={cat.visible} onChange={(visible) => onCat({ ...cat, visible })} />
            <Switch label={t.paws} hint={t.pawsHint} on={cat.paws} onChange={(paws) => onCat({ ...cat, paws })} />
            <hr />
            <a className="item" role="menuitem" href={SOURCE_URL} target="_blank" rel="noreferrer">
              <Code {...icon} />
              <span className="item-label">{t.source}</span>
              <kbd>AGPL-3.0</kbd>
            </a>
          </div>
        )}
      </div>
      <div className="export" ref={exportRef}>
        {recording ? (
          <button type="button" className="tool primary recording" onClick={() => onAction('stopRecording')}>
            <Square size={12} strokeWidth={0} fill="currentColor" />
            <span>{t.stop}</span>
            <Remaining until={recording.until} />
          </button>
        ) : (
          <button
            type="button"
            className="tool primary"
            aria-label={t.export}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            data-tip={menuOpen ? undefined : `${t.export} · E`}
            onPointerDown={(ev) => ev.preventDefault()}
            onClick={() => onMenu(!menuOpen)}
          >
            <Download {...icon} />
          </button>
        )}
        {menuOpen && !recording && (
          <div className="menu" role="dialog" aria-label={t.export}>
            <div className="field">
              <span className="field-label">{t.format}</span>
              <div className="segmented">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={options.format === f.value}
                    onClick={() => onOptions({ ...options, format: f.value })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">{t.scale}</span>
              <div className="segmented">
                {SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={options.scale === s}
                    onClick={() => onOptions({ ...options, scale: s })}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
            {isVideo && (
              <label className="field">
                <span className="field-label">
                  {t.duration} <span className="tabular">{options.duration}s</span>
                </span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={options.duration}
                  onChange={(ev) => onOptions({ ...options, duration: Number(ev.target.value) })}
                />
              </label>
            )}
            <button
              type="button"
              className="confirm"
              onClick={() => {
                onMenu(false)
                onAction(options.format)
              }}
            >
              {isVideo ? t.record : t.export} {FORMATS.find((f) => f.value === options.format)?.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
