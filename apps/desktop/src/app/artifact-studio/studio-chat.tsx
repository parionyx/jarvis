import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { useI18n } from '@/i18n'
import { chatMessageText } from '@/lib/chat-messages'
import { cn } from '@/lib/utils'
import { $messages } from '@/store/session'

const MAX_BUBBLES = 12

interface Bubble {
  id: string
  role: 'assistant' | 'user' | 'system' | 'other'
  text: string
}

/**
 * Compact live transcript of the SAME session this studio's command bar
 * submits into — JARVIS ke jawab yahin dikhte hain, main chat khole bina.
 * Read-only by design: typing sirf CommandBar se (one submit path).
 */
export function StudioChat() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const messages = useStore($messages)
  const scrollRef = useRef<HTMLDivElement>(null)

  const bubbles: Bubble[] = []

  for (let i = messages.length - 1; i >= 0 && bubbles.length < MAX_BUBBLES; i -= 1) {
    const m = messages[i]
    const role = m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'other'

    if (role === 'other') {continue}
    const text = chatMessageText(m).trim()

    if (!text) {continue}
    bubbles.unshift({ id: m.id, role, text })
  }

  useEffect(() => {
    const el = scrollRef.current

    if (el) {el.scrollTop = el.scrollHeight}
  }, [bubbles.length, messages])

  return (
    <div className="flex min-h-0 flex-col border-t border-(--ui-stroke-tertiary)" data-testid="artifact-studio-chat">
      <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-(--ui-stroke-quaternary) px-2">
        <span className="size-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
        <span className="text-[0.5625rem] tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
          {a.chatTitle}
        </span>
      </div>
      <div className="flex max-h-44 min-h-24 flex-col gap-1.5 overflow-y-auto px-2 py-2" ref={scrollRef}>
        {bubbles.length === 0 ? (
          <p className="py-1 text-center text-[0.6875rem] text-(--ui-text-tertiary)">{a.chatEmpty}</p>
        ) : (
          bubbles.map(b => (
            <div
              className={cn(
                'max-w-[85%] rounded-md px-2 py-1 text-[0.6875rem] leading-snug',
                b.role === 'user'
                  ? 'self-end bg-(--theme-primary)/10 text-(--ui-text-primary)'
                  : 'self-start bg-(--ui-bg-tertiary) text-(--ui-text-secondary)'
              )}
              key={b.id}
            >
              <span
                className={cn(
                  'mr-1 font-mono text-[0.5625rem] tracking-wide uppercase opacity-60',
                  b.role === 'user' ? 'text-(--theme-primary)' : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {b.role === 'user' ? a.chatYou : a.chatJarvis}
              </span>
              <span className="wrap-anywhere">{b.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
