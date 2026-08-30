import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { onComposerSubmitRequest } from '@/app/chat/composer/focus'
import { I18nProvider } from '@/i18n'
import { clearChatFormRequest, type FormField, setChatFormRequest } from '@/store/chat-form'
import { $gateway } from '@/store/gateway'
import { $activeSessionId } from '@/store/session'

import { ButtonsTool, FormTool } from './chat-ui-tool'

// The live pending form only renders while its message is running. Force that
// so FormPending can be exercised directly.
vi.mock('@assistant-ui/react', () => ({
  useAuiState: () => true
}))

// Radix Select (used by the form's dropdown field) measures its trigger with
// ResizeObserver, which jsdom does not ship.
class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub
}

afterEach(() => {
  cleanup()
  clearChatFormRequest()
  $activeSessionId.set(null)
  $gateway.set(null)
  vi.clearAllMocks()
})

function renderWidget(ui: ReactNode) {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      {/* requestComposerSubmit refuses to broadcast without a *visible*
          composer surface id — stamp one like a mounted chat would. */}
      <div data-composer-surface-id="surface-1" data-composer-target="main" />
      {ui}
    </I18nProvider>
  )
}

function baseProps(overrides: Partial<ToolCallMessagePartProps>): ToolCallMessagePartProps {
  // Cast: Partial-spread widens the discriminated unions (status/type) beyond
  // what assistant-ui's part type encodes; every test supplies valid literals.
  return {
    addResult: vi.fn(),
    argsText: '',
    isError: false,
    respondToApproval: vi.fn(),
    result: undefined,
    resume: vi.fn(),
    status: { type: 'complete' } as const,
    toolCallId: 'widget-1',
    toolName: 'show_buttons',
    type: 'tool-call',
    ...overrides
  } as ToolCallMessagePartProps
}

describe('ButtonsTool', () => {
  it('renders chips from settled results and stays clickable after the turn', async () => {
    const submits: string[] = []

    const unsubscribe = onComposerSubmitRequest(({ text }) => {
      submits.push(text)
    })

    const args = {
      buttons: [
        { label: 'Deploy', message: 'Deploy to staging', style: 'primary' },
        { label: 'Diff', message: 'Show the diff first' }
      ],
      prompt: 'What next?'
    }

    renderWidget(
      <ButtonsTool
        {...baseProps({
          args,
          result: { buttons: args.buttons, prompt: 'What next?', success: true }
        })}
      />
    )

    expect(screen.getByText('What next?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Deploy' }))
    await waitFor(() => expect(submits).toEqual(['Deploy to staging']))

    // Chips stay actionable — click the second one too.
    fireEvent.click(screen.getByRole('button', { name: 'Diff' }))
    await waitFor(() => expect(submits).toEqual(['Deploy to staging', 'Show the diff first']))

    unsubscribe()
  })

  it('falls back to bare-string button lists (label == message)', () => {
    renderWidget(
      <ButtonsTool
        {...baseProps({
          args: { buttons: ['Approve', 'Reject'], prompt: 'Decide:' },
          result: { buttons: [{ label: 'Approve', message: 'Approve' }, { label: 'Reject', message: 'Reject' }], success: true }
        })}
      />
    )

    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })
})

describe('FormTool', () => {
  const fields: FormField[] = [
    { label: 'Email', name: 'email', placeholder: 'you@example.com', required: true, type: 'text' },
    { label: 'Count', name: 'count', type: 'number' },
    { label: 'Tier', name: 'tier', options: ['free', 'pro'], type: 'select' },
    { label: 'Notify me', name: 'notify', type: 'checkbox' }
  ]

  function liveFormProps(): ToolCallMessagePartProps {
    return baseProps({
      args: { fields, title: 'Create workspace', submit_label: 'Go' },
      status: { type: 'running' } as const,
      toolCallId: 'form-live',
      toolName: 'show_form'
    })
  }

  it('submits typed values as JSON through form.respond and clears the parked request', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true })

    $activeSessionId.set('session-1')
    $gateway.set({ request } as never)
    setChatFormRequest({
      fields,
      requestId: 'form-req-1',
      sessionId: 'session-1',
      submitLabel: 'Go',
      title: 'Create workspace'
    })

    renderWidget(<FormTool {...liveFormProps()} />)

    expect(screen.getByText('Create workspace')).toBeTruthy()

    const email = screen.getByLabelText(/Email/) as HTMLInputElement
    fireEvent.change(email, { target: { value: 'a@b.c' } })

    const count = screen.getByLabelText(/Count/) as HTMLInputElement
    fireEvent.change(count, { target: { value: '3' } })

    fireEvent.click(screen.getByRole('checkbox'))

    fireEvent.submit(screen.getByRole('button', { name: 'Go' }).closest('form')!)

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    // Key order follows the field order the form was seeded from.
    expect(request).toHaveBeenCalledWith('form.respond', {
      answer: JSON.stringify({ email: 'a@b.c', count: 3, tier: '', notify: true }),
      request_id: 'form-req-1'
    })
  })

  it('shows the submitted values once the tool settles', () => {
    renderWidget(
      <FormTool
        {...baseProps({
          result: {
            success: true,
            title: 'Create workspace',
            values: { email: 'a@b.c', notify: true }
          }
        })}
      />
    )

    expect(screen.getByText(/email: a@b\.c/)).toBeTruthy()
    expect(screen.getByText(/notify: yes/)).toBeTruthy()
  })

  it('renders the timeout honestly when no answer arrived', () => {
    renderWidget(
      <FormTool
        {...baseProps({
          result: { error: 'The user did not fill the form within the time limit.', success: false }
        })}
      />
    )

    expect(screen.getByText(/did not fill the form/)).toBeTruthy()
  })
})
