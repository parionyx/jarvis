import { atom, computed } from 'nanostores'

import { activeGateway } from '@/store/gateway'
import { notifyError } from '@/store/notifications'
import type {
  ApplyActionsResult,
  ArtifactAction,
  ArtifactProject,
  ArtifactProjectSummary,
  HistoryRow,
  PendingProposal,
  SelectionState,
  StudioCommandContext,
  StudioConsoleLine,
  StudioMode
} from '@/types/artifact-studio'

/**
 * Artifact Studio state. Backend artifact state is AUTHORITATIVE: this store
 * caches the open document, sends every mutation through
 * `artifacts.apply_actions`, and reconciles against gateway events
 * (`artifact.studio.*`, `artifact.state.changed`). No local mutation path —
 * optimistic painting arrives with Phase 2 drag interactions, and even then
 * only transforms paint ahead of the ack.
 */

const CONSOLE_MAX_LINES = 200

export const ARTIFACT_STUDIO_PANE_ID = 'artifact-studio'

export const $artifactStudioOpen = atom(false)
export const $activeArtifactProject = atom<ArtifactProject | null>(null)
export const $artifactSelection = atom<SelectionState>({ componentIds: [], wireIds: [] })
export const $studioMode = atom<StudioMode>('DESIGN')
export const $studioConsole = atom<StudioConsoleLine[]>([])
/** Two-click wiring: pehla port yahan set hota hai, doosra inspector se. */
export const $pendingWirePort = atom<null | string>(null)

export function setPendingWirePort(ref: null | string): void {
  $pendingWirePort.set(ref)
}

export const $pendingProposal = atom<{ projectId: string; actions: ArtifactAction[]; pending: PendingProposal[] } | null>(null)

/** Recent applied-change summaries handed to JARVIS as command context. */
const $recentChanges = atom<string[]>([])

// Revision-driven undo/redo: restore() appends revisions, so stacks hold
// revision numbers rather than inverse patches. Backend stays authoritative.
const $undoRevisions = atom<number[]>([])
const $redoRevisions = atom<number[]>([])

let consoleSeq = 0

export function pushConsoleLine(level: StudioConsoleLine['level'], text: string): void {
  const line: StudioConsoleLine = {
    id: `con_${Date.now()}_${consoleSeq++}`,
    ts: new Date().toISOString(),
    level,
    text
  }

  const next = [...$studioConsole.get(), line]
  $studioConsole.set(next.length > CONSOLE_MAX_LINES ? next.slice(-CONSOLE_MAX_LINES) : next)
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export const $selectedComponentId = computed($artifactSelection, selection => selection.componentIds[0] ?? null)

export const $selectedComponent = computed(
  [$activeArtifactProject, $selectedComponentId],
  (project, id) => (project && id ? project.components[id] ?? null : null)
)

export const $assemblyTreeRoots = computed($activeArtifactProject, project => {
  if (!project) {return []}
  // Roots = components never appearing as a constraint child.
  const children = new Set(Object.values(project.constraints).map(c => c.child))

  return Object.keys(project.components).filter(id => !children.has(id))
})

function childComponentsOf(project: ArtifactProject | null, parentId: string): string[] {
  if (!project) {return []}

  return Object.values(project.constraints)
    .filter(c => c.parent === parentId)
    .map(c => c.child)
}

export { childComponentsOf }

// ---------------------------------------------------------------------------
// Gateway plumbing
// ---------------------------------------------------------------------------

function request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const gateway = activeGateway()

  if (!gateway) {
    throw new Error('gateway not connected')
  }

  return gateway.request<T>(method, params)
}

async function fetchProject(projectId: string): Promise<ArtifactProject | null> {
  const res = await request<{ project: ArtifactProject }>('artifacts.get', { project_id: projectId })

  return res.project ?? null
}

/** Load a project into the studio (fetch + select). Returns true on success. */
export async function loadArtifactProject(projectId: string): Promise<boolean> {
  try {
    const project = await fetchProject(projectId)

    if (!project) {return false}
    $activeArtifactProject.set(project)
    $artifactSelection.set({ componentIds: [], wireIds: [] })
    $pendingProposal.set(null)
    $undoRevisions.set([])
    $redoRevisions.set([])
    pushConsoleLine('info', `${project.name} · ${project.status} · rev ${project.revision}`)
    void reportStudioContext()

    return true
  } catch (err) {
    notifyError(err, 'Failed to load artifact project')

    return false
  }
}

export async function openArtifactStudio(projectId?: string): Promise<void> {
  $artifactStudioOpen.set(true)

  if (projectId) {
    if ($activeArtifactProject.get()?.id !== projectId) {
      await loadArtifactProject(projectId)
    }
  } else if (!$activeArtifactProject.get()) {
    // No project given and none cached: ask the backend what exists before
    // creating anything — the tool path owns creation.
    try {
      const res = await request<{ projects: ArtifactProjectSummary[] }>('artifacts.list')
      const first = res.projects?.[0]

      if (first) {await loadArtifactProject(first.id)}
    } catch {
      // Pane can still render its empty state without a project.
    }
  }
}

export function closeArtifactStudio(): void {
  $artifactStudioOpen.set(false)
  void reportStudioContext(true)
}

// ---------------------------------------------------------------------------
// Mutations — the single entry point is artifacts.apply_actions
// ---------------------------------------------------------------------------

interface ApplyOptions {
  reason?: string
  autoReview?: boolean
}

export async function applyArtifactActions(actions: ArtifactAction[], opts: ApplyOptions = {}): Promise<boolean> {
  const project = $activeArtifactProject.get()

  if (!project || actions.length === 0) {return false}

  const previousRevision = project.revision

  try {
    const res = await request<ApplyActionsResult | { success: false; error: { code: string; message: string; pending?: PendingProposal[] } }>(
      'artifacts.apply_actions',
      {
        project_id: project.id,
        actions,
        source: 'user',
        reason: opts.reason ?? '',
        auto_review: opts.autoReview ?? false
      }
    )

    if (res.success) {
      const applied = res as ApplyActionsResult
      // Undo/redo ride backend revisions: remember where to restore back to.
      noteMutation(previousRevision)
      recordAppliedSummary(applied.applied.map(a => a.type))
      pushConsoleLine('success', `rev ${applied.revision}: applied ${applied.applied.length} action${applied.applied.length === 1 ? '' : 's'}`)
      await reconcileProject(project.id, applied.revision)

      return true
    }

    const err = res.error

    if (err.code === 'REVIEW_REQUIRED' && err.pending?.length) {
      $pendingProposal.set({ projectId: project.id, actions, pending: err.pending })
      pushConsoleLine('warning', `${err.pending.length} action(s) require review`)
    } else {
      pushConsoleLine('error', `${err.code}: ${err.message}`)
    }

    return false
  } catch (err) {
    // Failed write rolls back visibly: refetch authoritative state.
    pushConsoleLine('error', String(err instanceof Error ? err.message : err))
    await reconcileProject(project.id)

    return false
  }
}

/** User confirmed the review card: resend the exact batch with auto_review. */
export async function confirmPendingProposal(): Promise<boolean> {
  const proposal = $pendingProposal.get()

  if (!proposal) {return false}
  $pendingProposal.set(null)

  return applyArtifactActions(proposal.actions, { autoReview: true, reason: 'review confirmed' })
}

export function dismissPendingProposal(): void {
  $pendingProposal.set(null)
}

async function reconcileProject(projectId: string, atLeastRevision?: number): Promise<void> {
  try {
    const fresh = await fetchProject(projectId)

    if (!fresh) {return}
    const current = $activeArtifactProject.get()

    // Guard against the past: stale responses never overwrite newer intent.
    if (!current || current.id !== projectId || fresh.revision >= current.revision) {
      if (atLeastRevision === undefined || fresh.revision >= atLeastRevision) {
        $activeArtifactProject.set(fresh)
        void reportStudioContext()
      }
    }
  } catch {
    // Reconcile failures are non-fatal; next event retries.
  }
}

function recordAppliedSummary(types: string[]): void {
  const stamp = new Date().toLocaleTimeString()
  const next = [...$recentChanges.get(), `${stamp}: ${types.join(', ')}`].slice(-10)
  $recentChanges.set(next)
}

// ---------------------------------------------------------------------------
// Undo / redo over backend revisions
// ---------------------------------------------------------------------------

function noteMutation(previousRevision: number): void {
  $undoRevisions.set([...$undoRevisions.get().slice(-49), previousRevision])
  $redoRevisions.set([])
}

export async function undoArtifactChange(): Promise<boolean> {
  const project = $activeArtifactProject.get()
  const stack = $undoRevisions.get()

  if (!project || stack.length === 0) {return false}

  const target = stack[stack.length - 1]
  const previous = project.revision
  $undoRevisions.set(stack.slice(0, -1))

  try {
    const res = await request<{ revision: number }>('artifacts.restore', {
      project_id: project.id,
      revision: target
    })

    $redoRevisions.set([...$redoRevisions.get().slice(-49), previous])
    pushConsoleLine('info', `undo → rev ${res.revision}`)
    await reconcileProject(project.id, res.revision)

    return true
  } catch (err) {
    $undoRevisions.set([...$undoRevisions.get(), target]) // put it back
    pushConsoleLine('error', `undo failed: ${err instanceof Error ? err.message : String(err)}`)

    return false
  }
}

export async function redoArtifactChange(): Promise<boolean> {
  const project = $activeArtifactProject.get()
  const stack = $redoRevisions.get()

  if (!project || stack.length === 0) {return false}

  const target = stack[stack.length - 1]
  const previous = project.revision
  $redoRevisions.set(stack.slice(0, -1))

  try {
    const res = await request<{ revision: number }>('artifacts.restore', {
      project_id: project.id,
      revision: target
    })

    $undoRevisions.set([...$undoRevisions.get().slice(-49), previous])
    pushConsoleLine('info', `redo → rev ${res.revision}`)
    await reconcileProject(project.id, res.revision)

    return true
  } catch (err) {
    $redoRevisions.set([...$redoRevisions.get(), target])
    pushConsoleLine('error', `redo failed: ${err instanceof Error ? err.message : String(err)}`)

    return false
  }
}

export async function loadArtifactHistory(limit = 50): Promise<HistoryRow[]> {
  const project = $activeArtifactProject.get()

  if (!project) {return []}

  try {
    const res = await request<{ history: HistoryRow[] }>('artifacts.history', {
      project_id: project.id,
      limit
    })

    return res.history ?? []
  } catch (err) {
    pushConsoleLine('error', `history failed: ${err instanceof Error ? err.message : String(err)}`)

    return []
  }
}

// ---------------------------------------------------------------------------
// Selection / mode / context reporting
// ---------------------------------------------------------------------------

export function setArtifactSelection(componentIds: string[], wireIds: string[] = []): void {
  $artifactSelection.set({ componentIds, wireIds })
  void reportStudioContext()
}

export function setStudioMode(mode: StudioMode): void {
  $studioMode.set(mode)
  void reportStudioContext()
}

let contextReportTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced report of what this window has open, so agent tools resolve
 * "the open artifact" without ids. Failures are silent (best-effort hint).
 * `clear` sends an EMPTY context so the backend drops the stale project
 * reference instead of keeping it alive after the studio closes. */
function reportStudioContext(clear = false): void {
  if (contextReportTimer) {clearTimeout(contextReportTimer)}
  contextReportTimer = setTimeout(() => {
    contextReportTimer = null
    const gateway = activeGateway()

    if (!gateway) {return}

    if (clear) {
      void gateway.request('artifacts.set_context', { session_id: '' }).catch(() => {})

      return
    }

    void gateway
      .request('artifacts.set_context', {
        session_id: '',
        project_id: $activeArtifactProject.get()?.id ?? null,
        selection: $artifactSelection.get().componentIds,
        mode: $studioMode.get()
      })
      .catch(() => {})
  }, 150)
}

export function buildCommandContext(): StudioCommandContext | null {
  const project = $activeArtifactProject.get()

  if (!project) {return null}

  return {
    project_id: project.id,
    revision: project.revision,
    selected_component: $artifactSelection.get().componentIds[0] ?? null,
    active_mode: $studioMode.get(),
    recent_artifact_changes: $recentChanges.get().slice(-5)
  }
}

// ---------------------------------------------------------------------------
// Gateway event wiring — installed once by the controller registration.
// ---------------------------------------------------------------------------

let eventsInstalled = false
let boundGateway: unknown = null

export function initArtifactStudioEvents(): void {
  if (eventsInstalled) {return}
  eventsInstalled = true

  import('@/store/gateway').then(({ $gateway }) => {
    const bind = (): void => {
      const gateway = $gateway.get()

      // $gateway.subscribe fires on EVERY instance set AND once immediately
      // at subscribe time — without this guard a re-bind would stack
      // duplicate handlers on the same gateway and double-handle events.
      if (!gateway || gateway === boundGateway) {return}

      boundGateway = gateway

      gateway.on<{ project_id: string }>('artifact.studio.open', event => {
        void openArtifactStudio(event.payload?.project_id)
      })

      gateway.on<{ project_id: string }>('artifact.studio.close', () => {
        closeArtifactStudio()
      })

      gateway.on<{ project_id: string; revision: number; source: string }>('artifact.state.changed', event => {
        const payload = event.payload
        const active = $activeArtifactProject.get()

        if (!payload || !active || active.id !== payload.project_id) {return}

        if (payload.revision <= active.revision) {return}
        void reconcileProject(payload.project_id, payload.revision)
      })
    }

    bind()
    $gateway.subscribe(bind)
  }).catch(() => {})
}
