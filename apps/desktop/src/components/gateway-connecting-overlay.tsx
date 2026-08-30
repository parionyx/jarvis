import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useTheme } from '@/themes/context'
import { cn } from '@/lib/utils'
import { $desktopBoot } from '@/store/boot'
import { $gatewaySwitching } from '@/store/gateway-switch'
import { $gatewayState } from '@/store/session'

// Exit choreography (ms)
const TEXT_OUT_MS = 360
const POST_TEXT_HOLD_MS = 300
const OVERLAY_OUT_MS = 520
const PREVIEW_CONNECT_MS = 3200
const PREVIEW_REPLAY_MS = 1100

type Phase = 'live' | 'text-out' | 'overlay-out' | 'gone'

function forcedPreview(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  try {
    return new URLSearchParams(window.location.search).get('connecting') === '1'
  } catch {
    return false
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

const BOOT_LOG_STEPS = [
  'INITIALIZING NEURAL INTERFACE',
  'CALIBRATING ARC REACTOR POWER CORE',
  'ESTABLISHING GATEWAY SECURE LINK',
  'SYNCHRONIZING MEMORY ARCHITECTURE',
  'DIAGNOSTICS VERIFIED // ALL SYSTEMS NOMINAL'
]

export function GatewayConnectingOverlay() {
  const gatewayState = useStore($gatewayState)
  const boot = useStore($desktopBoot)
  const gatewaySwitching = useStore($gatewaySwitching)
  const [previewing] = useState(forcedPreview)
  const reduce = prefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('live')
  const coldBootDoneRef = useRef(false)
  const { themeName } = useTheme()
  const isJarvis = themeName === 'jarvis'

  const [bootStep, setBootStep] = useState(0)
  const audioPlayedRef = useRef(false)

  // Must compute `connecting` before any useEffect that depends on it.
  if (!boot.running && boot.progress >= 100 && !boot.error) {
    coldBootDoneRef.current = true
  }

  const initialBootActive = boot.visible || boot.running || boot.progress < 100

  const connecting =
    !coldBootDoneRef.current && !gatewaySwitching && gatewayState !== 'open' && !boot.error && initialBootActive

  // Step through boot lines sequentially while connecting
  useEffect(() => {
    if (phase !== 'live') return

    const interval = setInterval(() => {
      setBootStep(prev => (prev < BOOT_LOG_STEPS.length - 1 ? prev + 1 : prev))
    }, 450)

    return () => clearInterval(interval)
  }, [phase])

  // Play J.A.R.V.I.S. Startup Sound when connecting boots up
  useEffect(() => {
    if (isJarvis && (previewing || connecting) && !audioPlayedRef.current) {
      audioPlayedRef.current = true
      try {
        // Use a relative path so it resolves correctly under both
        // the Vite dev server (http://) and the packaged Electron app (file://).
        // An absolute leading slash (/jarvis-startup.wav) breaks under file://
        // because there is no server root — it would map to C:\jarvis-startup.wav.
        const audio = new Audio('./jarvis-startup.wav')
        audio.volume = 0.85
        audio.play().catch(err => {
          console.warn('J.A.R.V.I.S. Startup sound playback error:', err)
        })
      } catch (e) {
        console.warn('J.A.R.V.I.S. Startup audio exception:', e)
      }
    }
  }, [isJarvis, previewing, connecting])



  const shownRef = useRef(false)

  if (previewing || connecting) {
    shownRef.current = true
  }

  // Kick off the exit when connected
  useEffect(() => {
    if (phase !== 'live') {
      return
    }

    if (previewing) {
      const id = window.setTimeout(() => setPhase('text-out'), PREVIEW_CONNECT_MS)
      return () => window.clearTimeout(id)
    }

    if (gatewayState === 'open' && shownRef.current) {
      setPhase(reduce ? 'gone' : 'text-out')
    }
  }, [phase, previewing, gatewayState, reduce])

  // Advance exit choreography
  useEffect(() => {
    if (phase === 'text-out') {
      const id = window.setTimeout(() => setPhase('overlay-out'), TEXT_OUT_MS + POST_TEXT_HOLD_MS)
      return () => window.clearTimeout(id)
    }

    if (phase === 'overlay-out') {
      const id = window.setTimeout(() => setPhase('gone'), OVERLAY_OUT_MS)
      return () => window.clearTimeout(id)
    }

    if (phase === 'gone' && previewing) {
      const id = window.setTimeout(() => setPhase('live'), PREVIEW_REPLAY_MS)
      return () => window.clearTimeout(id)
    }
  }, [phase, previewing])

  if (boot.error && !previewing) {
    return null
  }

  if (phase === 'gone' && !previewing) {
    return null
  }

  if (!previewing && !connecting && !shownRef.current) {
    return null
  }

  const leaving = phase !== 'live'
  const overlayHidden = phase === 'overlay-out' || phase === 'gone'

  if (!isJarvis) {
    return (
      <div
        className={cn(
          'fixed inset-0 z-[100] grid place-items-center bg-[#050b14] transition-opacity duration-500 ease-out select-none',
          overlayHidden ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      >
        <div
          className={cn(
            'text-[#00E5FF] font-mono tracking-widest text-sm transition duration-300',
            leaving ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
          )}
        >
          CONNECTING...
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#02060B] transition-all duration-700 ease-out select-none overflow-hidden',
        overlayHidden ? 'pointer-events-none opacity-0 scale-105' : 'opacity-100 scale-100'
      )}
    >
      {/* Background Cinematic Scanlines & Radial Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(0, 229, 255, 0.12) 0%, transparent 65%)'
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0, 229, 255, 0.08) 2px 4px)'
        }}
      />

      {/* Outer 4 Corner Tech Brackets */}
      <div className="pointer-events-none absolute top-6 left-6 h-6 w-6 border-t-2 border-l-2 border-[#00E5FF]/70" />
      <div className="pointer-events-none absolute top-6 right-6 h-6 w-6 border-t-2 border-r-2 border-[#00E5FF]/70" />
      <div className="pointer-events-none absolute bottom-6 left-6 h-6 w-6 border-b-2 border-l-2 border-[#00E5FF]/70" />
      <div className="pointer-events-none absolute bottom-6 right-6 h-6 w-6 border-b-2 border-r-2 border-[#00E5FF]/70" />

      {/* Main J.A.R.V.I.S. Boot Core Container */}
      <div
        className={cn(
          'relative z-10 flex flex-col items-center justify-center text-center transition duration-500 ease-out',
          leaving ? 'scale-95 opacity-0 -translate-y-4' : 'scale-100 opacity-100 translate-y-0'
        )}
      >
        {/* Animated Mini Arc Reactor Loader */}
        <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 120" fill="none">
            {/* Outer Tick Ring */}
            <circle cx="60" cy="60" r="54" stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" strokeDasharray="2 4" />

            {/* Fast Rotating Outer Segment Ring */}
            <g className="origin-center" style={{ animation: 'jarvis-core-rotate 6s linear infinite' }}>
              <circle
                cx="60"
                cy="60"
                r="44"
                stroke="#00E5FF"
                strokeWidth="2"
                strokeDasharray="25 15 10 15 35 15"
                strokeOpacity="0.85"
              />
            </g>

            {/* Counter Rotating Inner Segment Ring */}
            <g className="origin-center" style={{ animation: 'jarvis-core-rotate 4s linear infinite reverse' }}>
              <circle
                cx="60"
                cy="60"
                r="32"
                stroke="#19F0D8"
                strokeWidth="1.5"
                strokeDasharray="15 10 8 10"
                strokeOpacity="0.75"
              />
            </g>

            {/* Center Geometric Core */}
            <polygon
              points="60,38 78,70 42,70"
              stroke="#00E5FF"
              strokeWidth="1.2"
              fill="rgba(0, 229, 255, 0.1)"
            />
          </svg>

          {/* Central Glowing Energy Orb */}
          <div className="h-8 w-8 rounded-full bg-[#00E5FF] shadow-[0_0_20px_#00E5FF] animate-pulse opacity-90" />
        </div>

        {/* Title Header */}
        <h1 className="font-mono text-2xl md:text-3xl font-extrabold tracking-[0.35em] text-[#00E5FF] drop-shadow-[0_0_15px_rgba(0,229,255,0.7)]">
          J.A.R.V.I.S.
        </h1>
        <p className="mt-1 font-mono text-[10px] md:text-xs tracking-[0.22em] text-[#4D7D92] uppercase">
          HERMES NEURAL INTERFACE // BOOT SEQUENCE
        </p>

        {/* Real-Time Stepping Boot Diagnostics Console */}
        <div className="mt-6 flex w-[340px] md:w-[400px] flex-col space-y-1.5 rounded-lg border border-[#00E5FF]/20 bg-[#081523]/80 p-3 text-left font-mono text-[10.5px] backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between pb-1 border-b border-[#00E5FF]/15 text-[9px] text-[#4D7D92]">
            <span>SYSTEM DIAGNOSTIC</span>
            <span className="text-[#00E5FF] animate-pulse">● LIVE UPLINK</span>
          </div>

          {BOOT_LOG_STEPS.map((step, idx) => {
            const isDone = idx < bootStep
            const isCurrent = idx === bootStep
            return (
              <div
                key={step}
                className={cn(
                  'flex items-center justify-between transition-all duration-300',
                  idx > bootStep ? 'opacity-20' : 'opacity-100'
                )}
              >
                <span className={isCurrent ? 'text-[#00E5FF] font-bold' : isDone ? 'text-[#7E9AA5]' : 'text-[#4D7D92]'}>
                  ▸ {step}
                </span>
                <span className={isDone ? 'text-[#19F0D8] font-bold' : isCurrent ? 'text-[#FFB300] font-bold animate-pulse' : 'text-[#4D7D92]'}>
                  {isDone ? '[OK]' : isCurrent ? '[INIT]' : '[...]'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Bottom Status Bar */}
        <div className="mt-4 flex items-center gap-2 font-mono text-[9.5px] text-[#4D7D92] tracking-wider">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#19F0D8] animate-ping" />
          <span>INITIALIZING CORE PROTOCOLS...</span>
        </div>
      </div>
    </div>
  )
}
