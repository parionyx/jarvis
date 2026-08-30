import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $studioConsole } from '@/store/artifact-studio'

const LEVEL_CLASS: Record<string, string> = {
  info: 'text-(--ui-text-secondary)',
  success: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400'
}

export function StudioConsole() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const lines = useStore($studioConsole)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current

    if (el) {el.scrollTop = el.scrollHeight}
  }, [lines.length])

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-(--ui-stroke-tertiary)" data-testid="artifact-console">
      <div className="flex h-6 shrink-0 items-center border-b border-(--ui-stroke-quaternary) px-2 text-[0.5625rem] tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {a.consoleTitle}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[0.6875rem] leading-relaxed" ref={scrollRef}>
        {lines.length === 0 ? (
          <div className="py-1 text-(--ui-text-tertiary)">{a.consoleEmpty}</div>
        ) : (
          lines.map(line => (
            <div className={cn('flex gap-2', LEVEL_CLASS[line.level] ?? LEVEL_CLASS.info)} key={line.id}>
              <span className="shrink-0 text-(--ui-text-quaternary, var(--ui-text-tertiary)) opacity-60">
                {new Date(line.ts).toLocaleTimeString()}
              </span>
              <span className="min-w-0">{line.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
