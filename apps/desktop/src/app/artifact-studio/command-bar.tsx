import { useStore } from '@nanostores/react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { $activeArtifactProject, buildCommandContext } from '@/store/artifact-studio'

export interface CommandSubmitPayload {
  text: string
  contextLine: string | null
}

interface CommandBarProps {
  onSubmit: (payload: CommandSubmitPayload) => void
}

/**
 * Contextual command bar — a control surface for the SAME JARVIS session,
 * not a second chat. Every submission carries an artifact context line
 * (project / revision / selection / mode) so JARVIS resolves references like
 * "is motor" without the user repeating themselves.
 */
export function CommandBar({ onSubmit }: CommandBarProps) {
  const { t } = useI18n()
  const a = t.artifactStudio
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const project = useStore($activeArtifactProject)

  const submit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault()
      const text = value.trim()

      if (!text || !project) {return}

      // Real live context (mode/selection move with the studio), not a
      // hardcoded label — "is motor ko upar karo" must resolve to what the
      // user is actually looking at right now.
      const ctx = buildCommandContext()

      const contextLine = ctx
        ? `[artifact ${ctx.project_id} rev${ctx.revision}${ctx.selected_component ? ` · sel:${ctx.selected_component}` : ''} · ${ctx.active_mode}]`
        : null

      onSubmit({ text, contextLine })
      setValue('')
    },
    [value, project, onSubmit]
  )

  // Focus follows the studio surface when the user has it open.
  useEffect(() => {
    const el = inputRef.current

    if (el && document.activeElement === document.body) {el.focus()}
  }, [])

  return (
    <form
      className="flex h-9 shrink-0 items-center gap-2 border-t border-(--ui-stroke-tertiary) px-2"
      data-testid="artifact-command-bar"
      onSubmit={submit}
    >
      <span className="shrink-0 font-mono text-[0.625rem] tracking-[0.08em] text-cyan-700 uppercase dark:text-cyan-400">
        {a.askLabel}
      </span>
      <input
        aria-label={a.askPlaceholder}
        className="h-7 min-w-0 flex-1 bg-transparent text-xs text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-tertiary)"
        onChange={event => setValue(event.target.value)}
        placeholder={project ? a.askPlaceholder : a.askNoProject}
        ref={inputRef}
        value={value}
      />
      <button
        className="shrink-0 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) disabled:opacity-40"
        disabled={!value.trim() || !project}
        type="submit"
      >
        {a.send}
      </button>
    </form>
  )
}
