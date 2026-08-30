import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $activeArtifactProject, $artifactSelection, setArtifactSelection } from '@/store/artifact-studio'
import type { ArtifactProject } from '@/types/artifact-studio'

import type { FlightTelemetry } from './engine/artifact-scene'

interface SceneInstance {
  dispose: () => void
  setPickHandler: (cb: (id: null | string) => void) => void
  update: (project: ArtifactProject, selectedComponentId: null | string) => void
  startFlight: () => void
  pauseFlight: () => void
  stopFlight: () => void
  setThrottle: (pct: number) => void
  getTelemetry: () => FlightTelemetry
}

/**
 * Viewport host — Three.js LAZY load hota hai (pane ke pehle mount par),
 * taaki Hermes ka initial bundle 3D engine se bhaari na ho.
 *
 * SIMULATE mode me flight controls + live telemetry overlay render hote
 * hain (ESTIMATED model — har chip par tag).
 */
export function ViewportCanvas({ mode }: { mode: string }) {
  const { t } = useI18n()
  const a = t.artifactStudio
  const containerRef = useRef<HTMLDivElement>(null)
  // Stable imperative handle (useMemo([]) — never changes): holds the engine
  // instance; deliberately NOT reactive state and NOT a mirrored ref.
  const sceneHolder = useMemo<{ scene: SceneInstance | null }>(() => ({ scene: null }), [])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [playing, setPlaying] = useState(false)
  const [throttle, setThrottle] = useState(55)
  const [tele, setTele] = useState<FlightTelemetry | null>(null)

  const project = useStore($activeArtifactProject)
  const selectionId = useStore($artifactSelection).componentIds[0] ?? null

  // Engine load (once)
  useEffect(() => {
    let cancelled = false
    let instance: SceneInstance | null = null
    const container = containerRef.current

    if (!container) {return}

    import('./engine/artifact-scene')
      .then(({ ArtifactScene }) => {
        if (cancelled || !containerRef.current) {return}
        const scene = new ArtifactScene(containerRef.current)
        scene.setPickHandler(id => setArtifactSelection(id ? [id] : []))
        instance = scene as unknown as SceneInstance
        sceneHolder.scene = instance
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) {setStatus('failed')}
      })

    return () => {
      cancelled = true
      instance?.dispose()
      sceneHolder.scene = null
    }
  }, [sceneHolder])

  // Project/selection → scene
  useEffect(() => {
    if (status !== 'ready' || !project) {return}

    sceneHolder.scene?.update(project, selectionId)
  }, [project, selectionId, status, sceneHolder])

  // Telemetry poll @10Hz sirf jab playing ho (idle CPU ~0 rehta hai).
  useEffect(() => {
    if (!playing) {
      setTele(null)

      return
    }

    const iv = setInterval(() => {
      setTele(sceneHolder.scene?.getTelemetry() ?? null)
    }, 100)

    return () => {clearInterval(iv)}
  }, [playing, sceneHolder])

  const onPlay = (): void => {
    sceneHolder.scene?.startFlight()
    setPlaying(true)
  }

  const onPause = (): void => {
    sceneHolder.scene?.pauseFlight()
    setPlaying(false)
  }

  const onStop = (): void => {
    sceneHolder.scene?.stopFlight()
    setPlaying(false)
    setThrottle(55)
    sceneHolder.scene?.setThrottle(55)
  }

  return (
    <div className="relative h-full w-full" data-testid="artifact-viewport">
      <div className="absolute inset-0" ref={containerRef} />

      {/* SIMULATE mode: flight controls + telemetry */}
      {mode === 'SIMULATE' && project ? (
        <>
          <div className="absolute left-2 top-2 flex flex-col gap-1 rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-secondary)/90 p-2 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              {!playing ? (
                <button
                  aria-label={a.simPlay}
                  className="grid size-7 place-items-center rounded-[5px] bg-emerald-600/90 text-white hover:bg-emerald-500"
                  onClick={onPlay}
                  title={a.simPlay}
                  type="button"
                >
                  ▶
                </button>
              ) : (
                <button
                  aria-label={a.simPause}
                  className="grid size-7 place-items-center rounded-[5px] bg-amber-600/90 text-white hover:bg-amber-500"
                  onClick={onPause}
                  title={a.simPause}
                  type="button"
                >
                  ⏸
                </button>
              )}
              <button
                aria-label={a.simStop}
                className="grid size-7 place-items-center rounded-[5px] bg-(--ui-bg-quaternary, var(--ui-bg-tertiary)) text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)"
                onClick={onStop}
                title={a.simStop}
                type="button"
              >
                ■
              </button>
              <span className="ml-1 font-mono text-[0.5625rem] tracking-[0.1em] text-(--ui-text-tertiary) uppercase">
                {a.simLabel} · EST
              </span>
            </div>

            <label className="mt-0.5 flex items-center gap-1.5">
              <span className="w-14 text-[0.5625rem] tracking-wide text-(--ui-text-tertiary) uppercase">
                {a.throttle}
              </span>
              <input
                className="h-1 w-32 accent-cyan-600 dark:accent-cyan-400"
                max={100}
                min={0}
                onChange={e => {
                  const v = Number(e.target.value)
                  setThrottle(v)
                  sceneHolder.scene?.setThrottle(v)
                }}
                type="range"
                value={throttle}
              />
              <span className="w-8 font-mono text-[0.625rem] text-(--ui-text-secondary)">
                {throttle}%
              </span>
            </label>
          </div>

          {tele ? (
            <div
              className="absolute right-2 top-2 grid grid-cols-2 gap-x-3 gap-y-[2px] rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-secondary)/90 p-2 font-mono text-[0.625rem] backdrop-blur-sm"
              data-testid="artifact-telemetry"
            >
              <TeleChip label={a.teleTime} value={`${tele.tSec}s`} />
              <TeleChip label={a.teleAlt} value={`${tele.altitudeM} m`} />
              <TeleChip label={a.teleRpm} value={tele.rpm.toLocaleString()} />
              <TeleChip label={a.teleCurrent} value={`${tele.currentA} A`} />
              <TeleChip label={a.telePower} value={`${tele.powerW} W`} />
              <TeleChip label={a.teleVy} value={`${tele.vyMps} m/s`} />
              <TeleChip label={a.teleSoc} value={`${tele.socPct}%`} warn={tele.socPct < 20} />
              <TeleChip label={a.teleThrottle} value={`${tele.throttlePct}%`} />
            </div>
          ) : null}
        </>
      ) : null}

      {status === 'loading' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="font-mono text-[0.625rem] tracking-[0.14em] text-(--ui-text-tertiary) uppercase">
            {a.viewportLoading}
          </p>
        </div>
      ) : null}
      {status === 'failed' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
          <p className="text-xs text-(--ui-text-tertiary)">{a.viewportFailed}</p>
        </div>
      ) : null}
      {!project && status === 'ready' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-xs text-(--ui-text-tertiary)">{a.noProjectDesc}</p>
        </div>
      ) : null}
    </div>
  )
}

function TeleChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[0.5625rem] tracking-wide text-(--ui-text-tertiary) uppercase">{label}</span>
      <span className={cn(warn ? 'text-red-500' : 'text-cyan-700 dark:text-cyan-300')}>{value}</span>
    </div>
  )
}

