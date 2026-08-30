import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { Tip, TipKeybindLabel } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { $hapticsMuted, toggleHapticsMuted } from '@/store/haptics'
import { $fileBrowserOpen, $sidebarOpen, toggleFileBrowserOpen, toggleSidebarOpen } from '@/store/layout'
import { useTheme } from '@/themes/context'

import { TitlebarIcon } from './titlebar-icon'

export interface TitlebarTool {
  actionId?: string
  className?: string
  disabled?: boolean
  hidden?: boolean
  href?: string
  icon: React.ReactNode
  id: string
  label: string
  onSelect?: () => void
  title?: string
}

export interface TitlebarControlsProps {
  leftTools?: TitlebarTool[]
  onOpenSettings?: () => void
  tools?: TitlebarTool[]
}

const titlebarButtonClass =
  'relative inline-flex items-center justify-center text-[#7E9AA5] hover:text-[#00E5FF] transition-colors duration-150 focus-visible:outline-none'

const titlebarToolClusterClass = 'pointer-events-auto fixed z-50 flex items-center gap-1.5'

function useModifierHeld(): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const sync = (event: KeyboardEvent) => setHeld(event.metaKey || event.ctrlKey)
    const clear = () => setHeld(false)

    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', clear)

    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return held
}

export function TitlebarControls({ leftTools = [], tools = [], onOpenSettings }: TitlebarControlsProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const modHeld = useModifierHeld()
  const hapticsMuted = useStore($hapticsMuted)
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const sidebarOpen = useStore($sidebarOpen)
  const { themeName } = useTheme()
  const isJarvis = themeName === 'jarvis'

  const toggleHaptics = () => {
    if (!hapticsMuted) {
      triggerHaptic('tap')
    }

    toggleHapticsMuted()

    if (hapticsMuted) {
      window.requestAnimationFrame(() => triggerHaptic('success'))
    }
  }

  const leftEdge = { open: sidebarOpen, toggle: toggleSidebarOpen }
  const rightEdge = { open: fileBrowserOpen, toggle: toggleFileBrowserOpen }

  const leftToolbarTools: TitlebarTool[] = [
    {
      actionId: 'view.toggleSidebar',
      icon: <TitlebarIcon name="layout-sidebar-left" />,
      id: 'sidebar',
      label: leftEdge.open ? t.titlebar.hideSidebar : t.titlebar.showSidebar,
      onSelect: () => {
        if (modHeld) {
          return
        }
        leftEdge.toggle()
      }
    },
    ...leftTools
  ]

  const systemTools: TitlebarTool[] = [
    {
      actionId: 'sound.toggleMute',
      className: hapticsMuted ? 'text-[#7E9AA5]/60' : 'text-[#00E5FF]',
      icon: <TitlebarIcon name={hapticsMuted ? 'volume-x' : 'volume-2'} />,
      id: 'haptics',
      label: hapticsMuted ? t.titlebar.unmuteHaptics : t.titlebar.muteHaptics,
      onSelect: toggleHaptics
    },
    {
      actionId: 'settings.open',
      icon: <TitlebarIcon name="settings" />,
      id: 'settings',
      label: t.titlebar.openSettings,
      onSelect: () => {
        if (onOpenSettings) {
          onOpenSettings()
        } else {
          navigate('/settings')
        }
      }
    }
  ]

  const rightSidebarTool: TitlebarTool = {
    actionId: 'view.toggleRightRail',
    className: rightEdge.open ? 'text-[#00E5FF]' : undefined,
    icon: <TitlebarIcon name="layout-sidebar-right" />,
    id: 'rightRail',
    label: rightEdge.open ? t.titlebar.hideRightRail : t.titlebar.showRightRail,
    onSelect: () => rightEdge.toggle()
  }

  const visibleSystemTools = systemTools.filter(tool => !tool.hidden)
  const visiblePaneTools = tools.filter(tool => !tool.hidden)

  return (
    <>
      {isJarvis && (
        <div
          className="pointer-events-auto fixed top-0 left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center select-none h-[34px]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="relative flex items-center gap-2.5 px-5 py-0.5 rounded-full bg-gradient-to-r from-transparent via-[#00F0FF]/12 to-transparent border border-[#00F0FF]/30 shadow-[0_0_20px_rgba(0,240,255,0.18)] mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] shadow-[0_0_6px_#00FF88] animate-pulse" />
            <span className="font-mono text-sm md:text-base font-black tracking-[0.36em] text-[#00F0FF] drop-shadow-[0_0_14px_rgba(0,240,255,0.9)] uppercase">
              JARVIS
            </span>
          </div>
        </div>
      )}



      <div
        aria-label={t.shell.windowControls}
        className={cn(
          titlebarToolClusterClass,
          'left-(--titlebar-controls-left) top-(--titlebar-controls-top) translate-y-(--titlebar-controls-y-nudge)'
        )}
      >
        {leftToolbarTools
          .filter(tool => !tool.hidden)
          .map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
      </div>

      {visiblePaneTools.length > 0 && (
        <div
          aria-label={t.shell.paneControls}
          className={cn(
            titlebarToolClusterClass,
            'top-[calc(var(--titlebar-controls-top)+var(--right-rail-top-inset,0px))] right-[calc(var(--titlebar-tools-right)+var(--shell-preview-toolbar-gap,0))]'
          )}
        >
          {visiblePaneTools.map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
        </div>
      )}

      <div
        aria-label={t.shell.appControls}
        className={cn(titlebarToolClusterClass, 'right-(--titlebar-tools-right) top-(--titlebar-controls-top)')}
      >
        {visibleSystemTools.map(tool => (
          <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
        ))}
        <TitlebarToolButton navigate={navigate} tool={rightSidebarTool} />
      </div>
    </>
  )
}

function TitlebarToolButton({ navigate, tool }: { navigate: ReturnType<typeof useNavigate>; tool: TitlebarTool }) {
  const className = cn(titlebarButtonClass, 'bg-transparent select-none', tool.className)

  const tooltipLabel = tool.actionId ? (
    <TipKeybindLabel actionId={tool.actionId} text={tool.title ?? tool.label} />
  ) : (
    (tool.title ?? tool.label)
  )

  if (tool.href) {
    return (
      <Tip label={tooltipLabel}>
        <button
          aria-label={tool.label}
          className={className}
          onClick={() => {
            if (tool.onSelect) tool.onSelect()
            else if (tool.href) navigate(tool.href)
          }}
        >
          {tool.icon}
        </button>
      </Tip>
    )
  }

  return (
    <Tip label={tooltipLabel}>
      <button
        aria-label={tool.label}
        className={className}
        disabled={tool.disabled}
        onClick={tool.onSelect}
      >
        {tool.icon}
      </button>
    </Tip>
  )
}
