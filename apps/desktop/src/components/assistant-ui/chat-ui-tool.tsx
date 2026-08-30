'use client'

import { type ToolCallMessagePartProps, useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import {
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  useCallback,
  useMemo,
  useState
} from 'react'

import { requestComposerSubmit } from '@/app/chat/composer/focus'
import { useSessionView } from '@/app/chat/session-view'
import { ToolFallback } from '@/components/assistant-ui/tool/fallback'
import { selectMessageRunning } from '@/components/assistant-ui/tool/fallback-model'
import { parseMaybeObject } from '@/components/assistant-ui/tool/fallback-model/format'
import { WIDGET_SHELL_CLASS } from '@/components/chat/widget-shell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { type ChatFormRequest, clearChatFormRequest, type FormField, normalizeFormFields, sessionChatFormRequest } from '@/store/chat-form'
import { $gateway } from '@/store/gateway'
import { notifyError } from '@/store/notifications'

// ---------------------------------------------------------------------------
// Shared arg/result readers
// ---------------------------------------------------------------------------

interface ButtonArg {
  id?: string
  label: string
  message: string
  style?: string
}

interface ButtonsArgs {
  buttons: ButtonArg[]
  note?: string
  prompt?: string
}

function readButtonsArgs(args: unknown): ButtonsArgs {
  const row = parseMaybeObject(args)
  const raw = Array.isArray(row.buttons) ? row.buttons : []
  const buttons: ButtonArg[] = []

  for (const entry of raw.slice(0, 8)) {
    if (typeof entry === 'string' && entry.trim()) {
      const label = entry.trim()
      buttons.push({ label, message: label })

      continue
    }

    if (typeof entry === 'object' && entry !== null) {
      const item = entry as Record<string, unknown>

      const label =
        typeof item.label === 'string' && item.label.trim()
          ? item.label.trim()
          : typeof item.value === 'string' && item.value.trim()
            ? item.value.trim()
            : ''

      if (!label) {
        continue
      }

      const message =
        typeof item.message === 'string' && item.message.trim() ? item.message.trim() : label

      const style = typeof item.style === 'string' ? item.style : undefined

      buttons.push({
        ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
        label,
        message,
        ...(style ? { style } : {})
      })
    }
  }

  return {
    buttons,
    ...(typeof row.note === 'string' && row.note.trim() ? { note: row.note.trim() } : {}),
    ...(typeof row.prompt === 'string' ? { prompt: row.prompt } : {})
  }
}

const BUTTON_VARIANT_BY_STYLE: Record<string, ComponentProps<typeof Button>['variant']> = {
  destructive: 'destructive',
  outline: 'outline',
  primary: 'default',
  secondary: 'secondary'
}

// ---------------------------------------------------------------------------
// show_buttons — persistent quick-action chips
// ---------------------------------------------------------------------------

/**
 * Buttons render identically live and settled — they ARE the point of the
 * tool: a menu that stays in the transcript and stays clickable after the
 * turn ends. A click submits the button's preset message through the normal
 * composer pipeline (queued like any typed prompt when a turn is running),
 * so no new response channel exists to maintain.
 */
export function ButtonsTool(props: ToolCallMessagePartProps) {
  // A call that failed outright dispatched nothing — fall back to the honest
  // error row instead of dead chips.
  if (props.isError) {
    return <ToolFallback {...props} />
  }

  return <ButtonsChips {...props} />
}

function ButtonsChips({ args, result }: ToolCallMessagePartProps) {
  const fromArgs = useMemo(() => readButtonsArgs(args), [args])
  const fromResult = useMemo(() => readButtonsArgs(result), [result])

  // Prefer the settled result's copy (the tool echoes what it actually
  // rendered); args are the fallback while streaming.
  const prompt = fromResult.prompt || fromArgs.prompt || ''
  const buttons = fromResult.buttons.length > 0 ? fromResult.buttons : fromArgs.buttons
  const note = fromResult.note || fromArgs.note || ''

  const [clickedId, setClickedId] = useState<string | null>(null)

  const click = useCallback(
    (button: ButtonArg) => {
      triggerHaptic('submit')
      setClickedId(button.id ?? button.label)
      // Visible send: the chosen action should read as part of the
      // conversation, not vanish into a hidden intent.
      requestComposerSubmit(button.message)
    },
    []
  )

  if (!prompt && buttons.length === 0) {
    return null
  }

  return (
    <div className={cn(WIDGET_SHELL_CLASS, 'my-1')} data-slot="aui_buttons-widget">
      {prompt && (
        <div className="mb-2 text-[length:var(--conversation-text-font-size)] font-medium text-(--ui-text-primary)">
          {prompt}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {buttons.map((button, index) => {
          const key = button.id ?? `${button.label}-${index}`
          const variant = BUTTON_VARIANT_BY_STYLE[button.style ?? ''] ?? 'secondary'

          return (
            <Button
              className="h-7 px-2.5 text-xs"
              data-slot="aui_buttons-chip"
              key={key}
              onClick={() => click(button)}
              title={button.message !== button.label ? button.message : undefined}
              type="button"
              variant={variant}
            >
              {button.label}
            </Button>
          )
        })}
      </div>

      {note && (
        <div className="mt-1.5 text-[0.6875rem] leading-snug text-(--ui-text-tertiary)">{note}</div>
      )}

      {clickedId && (
        <div className="mt-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
          Sent — waiting for the reply.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// show_form — blocking structured input card
// ---------------------------------------------------------------------------

interface FormValues {
  [name: string]: boolean | number | string | undefined
}

function initialValues(fields: FormField[]): FormValues {
  const values: FormValues = {}

  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.name] = field.default
    } else if (field.type === 'checkbox') {
      values[field.name] = false
    } else {
      values[field.name] = ''
    }
  }

  return values
}

/** Settled: the blocking window is over — show what was submitted (or why it
 *  wasn't). Values echo back so the exchange reads as part of the chat. */
export function FormTool(props: ToolCallMessagePartProps) {
  if (props.result !== undefined) {
    return <FormSettled {...props} />
  }

  return <FormLive {...props} />
}

function FormSettled({ result }: ToolCallMessagePartProps) {
  const row = parseMaybeObject(result)
  const title = typeof row.title === 'string' ? row.title : ''
  const error = typeof row.error === 'string' ? row.error : ''
  const success = row.success === true

  let summary = ''

  if (success && typeof row.values === 'object' && row.values !== null) {
    summary = Object.entries(row.values as Record<string, unknown>)
      .map(([key, value]) => {
        const display = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value ?? '')

        return `${key}: ${display}`
      })
      .join(' · ')
  } else if (success && typeof row.raw_response === 'string') {
    summary = row.raw_response
  }

  if (!success && !error) {
    return null
  }

  return (
    <div className={cn(WIDGET_SHELL_CLASS, 'my-1')} data-slot="aui_form-widget-settled">
      <div className="text-[length:var(--conversation-caption-font-size)] font-medium text-(--ui-text-secondary)">
        {title || 'Form'}
      </div>

      {summary && (
        <div className="mt-1 wrap-anywhere text-[length:var(--conversation-caption-font-size)] text-(--ui-text-primary)">
          {summary}
        </div>
      )}

      {error && (
        <div className="mt-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
          {error}
        </div>
      )}
    </div>
  )
}

function FormLive(props: ToolCallMessagePartProps) {
  const messageRunning = useAuiState(selectMessageRunning)

  // Stopped mid-form with no result — don't leave a dead interactive panel.
  if (!messageRunning) {
    return <ToolFallback {...props} />
  }

  return <FormPending {...props} />
}

function FormPending({ args }: ToolCallMessagePartProps) {
  const { t } = useI18n()
  const gateway = useStore($gateway)

  // The tool row lives in whichever session rendered it; read THAT session's
  // pending form request (it carries the server-side request_id).
  const sessionId = useStore(useSessionView().$runtimeId)
  const $request = useMemo(() => sessionChatFormRequest(sessionId), [sessionId])
  const request = useStore($request) as ChatFormRequest | null

  const argFields = useMemo(() => normalizeFieldsFromArgs(args), [args])

  const title = request?.title ?? stringField(args, 'title') ?? ''
  const fields = request?.fields?.length ? request.fields : argFields
  const submitLabel = request?.submitLabel ?? stringField(args, 'submit_label') ?? 'Submit'

  const [values, setValues] = useState<FormValues>(() => initialValues(fields))
  const [submitting, setSubmitting] = useState(false)

  // Re-seed defaults when the field set first arrives (request lands a tick
  // after mount — same hydration race clarify handles with `ready`).
  const [seededFor, setSeededFor] = useState('')
  const fieldsKey = fields.map(f => f.name).join(',')

  if (fieldsKey && seededFor !== fieldsKey) {
    setSeededFor(fieldsKey)
    setValues(initialValues(fields))
  }

  const setValue = useCallback(
    (field: FormField, value: boolean | number | string) => {
      setValues(current => ({ ...current, [field.name]: value }))
    },
    []
  )

  // Race: tool.start fires before form.request, so request_id arrives slightly
  // after the card mounts. Hold submit until wired rather than erroring.
  const ready = Boolean(request?.requestId)
  const canSubmit = ready && !submitting && fields.length > 0

  const onSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault()

      // Submit stays disabled until the gateway request is wired (ready) —
      // this guard only fires on Enter-in-field races.
      if (!canSubmit || !request || !gateway) {
        return
      }

      // Required-field guard: block submit and surface the missing ones.
      const missing = fields.filter(field => {
        if (!field.required) {
          return false
        }

        const value = values[field.name]

        return value === undefined || value === '' || value === null
      })

      if (missing.length > 0) {
        notifyError(
          new Error(`${t.assistant.clarify.notReady}: ${missing.map(f => f.label).join(', ')}`),
          t.assistant.clarify.sendFailed
        )

        return
      }

      setSubmitting(true)

      try {
        await gateway.request<{ ok?: boolean }>('form.respond', {
          answer: JSON.stringify(values),
          request_id: request.requestId
        })
        triggerHaptic('submit')
        clearChatFormRequest(request.requestId, request.sessionId)
        // tool.complete lands next → FormSettled.
      } catch (error) {
        notifyError(error, t.assistant.clarify.sendFailed)
        setSubmitting(false)
      }
    },
    [canSubmit, fields, gateway, request, t.assistant.clarify, values]
  )

  if (fields.length === 0) {
    return null
  }

  return (
    <form className={cn(WIDGET_SHELL_CLASS, 'my-1')} data-slot="aui_form-widget" onSubmit={onSubmit}>
      {title && (
        <div className="mb-2 text-[length:var(--conversation-text-font-size)] font-medium text-(--ui-text-primary)">
          {title}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {fields.map(field => (
          <FormFieldRow field={field} key={field.name} onValue={setValue} value={values[field.name]} />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <Button disabled={!canSubmit} size="sm" type="submit">
          {submitting ? '…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function FormFieldRow({
  field,
  onValue,
  value
}: {
  field: FormField
  onValue: (field: FormField, value: boolean | number | string) => void
  value: boolean | number | string | undefined
}) {
  const inputId = `chat-form-${field.name}`

  if (field.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2" htmlFor={inputId}>
        <Checkbox
          checked={value === true}
          id={inputId}
          onCheckedChange={checked => onValue(field, checked === true)}
        />
        <span className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-secondary)">
          {field.label}
          {field.required && <span aria-hidden className="ml-1 text-destructive">*</span>}
        </span>
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)"
        htmlFor={inputId}
      >
        {field.label}
        {field.required && <span aria-hidden className="ml-1 text-destructive">*</span>}
      </label>

      {field.type === 'select' ? (
        <Select
          onValueChange={next => onValue(field, next)}
          value={typeof value === 'string' && value ? value : ''}
        >
          <SelectTrigger id={inputId} size="sm">
            <SelectValue placeholder={field.placeholder || field.label} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'textarea' ? (
        <Textarea
          className="field-sizing-content max-h-48 min-h-16"
          id={inputId}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onValue(field, event.target.value)}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
        />
      ) : (
        <Input
          id={inputId}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onValue(field, field.type === 'number' ? Number(event.target.value) : event.target.value)
          }
          placeholder={field.placeholder}
          type={field.type === 'number' ? 'number' : 'text'}
          value={value === undefined || value === false ? '' : String(value)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function stringField(args: unknown, ...keys: string[]): string | undefined {
  const row = parseMaybeObject(args)

  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
}

function normalizeFieldsFromArgs(args: unknown): FormField[] {
  const row = parseMaybeObject(args)

  return normalizeFormFields(row.fields)
}
