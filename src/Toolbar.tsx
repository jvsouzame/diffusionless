import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Cat,
  Code,
  Dices,
  Dna,
  Download,
  Eraser,
  Maximize,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
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
  running: boolean
  soundOn: boolean
  volume: number
  onVolume: (volume: number) => void
  cat: CatOptions
  onCat: (next: CatOptions) => void
  recording: RecordingInfo | null
  options: ExportOptions
  menuOpen: boolean
  onOptions: (next: ExportOptions) => void
  onMenu: (open: boolean) => void
  onAction: (name: string) => void
}

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

function Remaining({ until }: { until: number }) {
  const [left, setLeft] = useState(() => Math.max(0, until - performance.now()))
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, until - performance.now())), 200)
    return () => window.clearInterval(id)
  }, [until])
  return <span className="tabular">{Math.ceil(left / 1000)}s</span>
}

export function Toolbar({ running, soundOn, volume, onVolume, cat, onCat, recording, options, menuOpen, onOptions, onMenu, onAction }: Props) {
  const exportRef = useRef<HTMLDivElement>(null)
  const catRef = useRef<HTMLDivElement>(null)
  const [catOpen, setCatOpen] = useState(false)

  useEffect(() => {
    if (!catOpen) return
    const onDown = (ev: PointerEvent) => {
      if (!catRef.current?.contains(ev.target as Node)) setCatOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setCatOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [catOpen])
  const isVideo = options.format === 'gif' || options.format === 'webm'

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (ev: PointerEvent) => {
      if (!exportRef.current?.contains(ev.target as Node)) onMenu(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onMenu(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, onMenu])

  const icon = { size: 16, strokeWidth: 1.75 }

  return (
    <div className="toolbar" role="toolbar" aria-label="Actions">
      <Tool label={running ? 'Pause' : 'Play'} keys="Space" onClick={() => onAction('toggleRun')}>
        {running ? <Pause {...icon} /> : <Play {...icon} />}
      </Tool>
      <Tool label="Step" keys="." onClick={() => onAction('step')}>
        <StepForward {...icon} />
      </Tool>
      <span className="divider" />
      <Tool label="Reseed" keys="R" onClick={() => onAction('reseed')}>
        <RotateCcw {...icon} />
      </Tool>
      <Tool label="New seed" keys="N" onClick={() => onAction('newSeed')}>
        <Sprout {...icon} />
      </Tool>
      <Tool label="Clear" keys="C" onClick={() => onAction('clear')}>
        <Eraser {...icon} />
      </Tool>
      <span className="divider" />
      <Tool label="Randomize" keys="X" onClick={() => onAction('randomize')}>
        <Dices {...icon} />
      </Tool>
      <Tool label="Mutate" keys="M" onClick={() => onAction('mutate')}>
        <Dna {...icon} />
      </Tool>
      <span className="divider" />
      {/* Hovering the sound button opens the volume slider; clicking still toggles the music. */}
      <div className="sound">
        <Tool label={soundOn ? 'Sound off' : 'Sound on'} tip={false} onClick={() => onAction('toggleSound')}>
          {soundOn ? <Volume2 {...icon} /> : <VolumeX {...icon} />}
        </Tool>
        <div className="volume">
          <label className="field">
            <span className="field-label">
              Volume <span className="tabular">{Math.round(volume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              aria-label="Volume"
              onChange={(ev) => onVolume(Number(ev.target.value))}
            />
          </label>
          <span className="hint">{soundOn ? 'Click or press S to mute' : 'Click or press S to play'}</span>
        </div>
      </div>
      <div className="export" ref={catRef}>
        <button
          type="button"
          className="tool"
          aria-label="Residents"
          aria-haspopup="dialog"
          aria-expanded={catOpen}
          data-tip={catOpen ? undefined : 'Residents'}
          onPointerDown={(ev) => ev.preventDefault()}
          onClick={() => setCatOpen((open) => !open)}
        >
          <Cat {...icon} />
        </button>
        {catOpen && (
          <div className="menu compact" role="dialog" aria-label="Residents">
            <Switch label="Visible" hint="Show the cats and the couple" on={cat.visible} onChange={(visible) => onCat({ ...cat, visible })} />
            <Switch label="Paws" hint="Their steps seed the pattern" on={cat.paws} onChange={(paws) => onCat({ ...cat, paws })} />
          </div>
        )}
      </div>
      <Tool label="Fullscreen" keys="F" onClick={() => onAction('toggleFullscreen')}>
        <Maximize {...icon} />
      </Tool>
      <a
        className="tool"
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Source code"
        data-tip="Source code · AGPL-3.0"
      >
        <Code {...icon} />
      </a>
      <span className="divider" />
      <Tool label="Save preset" onClick={() => onAction('savePreset')}>
        <Save {...icon} />
      </Tool>
      <Tool label="Load preset" onClick={() => onAction('loadPreset')}>
        <FolderOpen {...icon} />
      </Tool>
      <div className="export" ref={exportRef}>
        {recording ? (
          <button type="button" className="tool primary recording" onClick={() => onAction('stopRecording')}>
            <Square size={12} strokeWidth={0} fill="currentColor" />
            <span>Stop</span>
            <Remaining until={recording.until} />
          </button>
        ) : (
          <button
            type="button"
            className="tool primary"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            data-tip={menuOpen ? undefined : 'Export · E'}
            onClick={() => onMenu(!menuOpen)}
          >
            <Download {...icon} />
            <span>Export</span>
          </button>
        )}
        {menuOpen && !recording && (
          <div className="menu" role="dialog" aria-label="Export">
            <div className="field">
              <span className="field-label">Format</span>
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
              <span className="field-label">Scale</span>
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
                  Duration <span className="tabular">{options.duration}s</span>
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
              {isVideo ? 'Record' : 'Export'} {FORMATS.find((f) => f.value === options.format)?.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
