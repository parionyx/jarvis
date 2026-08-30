import { atom, computed } from 'nanostores'


export interface FormField {
  name: string
  label: string
  type: 'checkbox' | 'number' | 'select' | 'text' | 'textarea'
  options?: string[]
  required?: boolean
  placeholder?: string
  default?: boolean | number | string
}

export interface ChatFormRequest {
  requestId: string
  title: string
  fields: FormField[]
  submitLabel: string
  sessionId: null | string
}

const VALID_TYPES = new Set(['checkbox', 'number', 'select', 'text', 'textarea'])

/**
 * Leniently normalize the tool args' `fields` array (the same shape travels on
 * `form.request`). Keeps structurally valid entries only; a select without
 * options or an unnamed field is dropped rather than breaking the whole card.
 */
export function normalizeFormFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const fields: FormField[] = []
  const seen = new Set<string>()

  for (const entry of raw.slice(0, 12)) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }

    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const label = typeof row.label === 'string' ? row.label.trim() : ''

    if (!name || !label || seen.has(name)) {
      continue
    }

    const rawType = typeof row.type === 'string' ? row.type.trim().toLowerCase() : 'text'
    const type = (VALID_TYPES.has(rawType) ? rawType : 'text') as FormField['type']

    const field: FormField = { label: label.slice(0, 120), name: name.slice(0, 64), type }

    if (type === 'select') {
      const options = Array.isArray(row.options)
        ? row.options.map(o => String(o).trim()).filter(Boolean).slice(0, 20)
        : []

      // A select with no usable options renders dead; degrade to text instead.
      if (options.length === 0) {
        field.type = 'text'
      } else {
        field.options = options
      }
    }

    if (row.required === true) {
      field.required = true
    }

    if (typeof row.placeholder === 'string' && row.placeholder.trim()) {
      field.placeholder = row.placeholder.trim().slice(0, 200)
    }

    if (row.default !== undefined && row.default !== null) {
      if (field.type === 'checkbox') {
        field.default = row.default === true
      } else if (field.type === 'number') {
        const num = Number(row.default)

        if (!Number.isNaN(num)) {
          field.default = num
        }
      } else if (typeof row.default === 'string' && row.default.trim()) {
        field.default = row.default.slice(0, 2000)
      }
    }

    seen.add(name)
    fields.push(field)
  }

  return fields
}

/** Per-session pending form requests — the clarify.ts pattern. A background
 *  session's form parks until the user focuses that chat. */
const keyFor = (sessionId: null | string | undefined): string => sessionId ?? ''

export const $chatFormRequests = atom<Record<string, ChatFormRequest>>({})

export const sessionChatFormRequest = (sessionId: null | string) =>
  computed($chatFormRequests, requests => requests[keyFor(sessionId)] ?? null)

export function setChatFormRequest(request: ChatFormRequest): void {
  $chatFormRequests.set({ ...$chatFormRequests.get(), [keyFor(request.sessionId)]: request })
}

export function clearChatFormRequest(requestId?: string, sessionId?: null | string): void {
  const requests = $chatFormRequests.get()

  if (sessionId !== undefined) {
    const key = keyFor(sessionId)
    const current = requests[key]

    if (!current || (requestId && current.requestId !== requestId)) {
      return
    }

    const next = { ...requests }
    delete next[key]
    $chatFormRequests.set(next)

    return
  }

  const next: Record<string, ChatFormRequest> = {}
  let changed = false

  for (const [key, value] of Object.entries(requests)) {
    if (requestId && value.requestId !== requestId) {
      next[key] = value
    } else {
      changed = true
    }
  }

  if (changed) {
    $chatFormRequests.set(next)
  }
}
