import { useStore } from '@nanostores/react'
import { ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import {
  $activeArtifactProject,
  $assemblyTreeRoots,
  childComponentsOf,
  setArtifactSelection
} from '@/store/artifact-studio'
import type { ArtifactComponent, ArtifactProject } from '@/types/artifact-studio'

interface FlatRow {
  component: ArtifactComponent
  depth: number
}

/** Depth-first walk of the parent-constraint forest, sorted per level. */
function flattenTree(project: ArtifactProject, roots: string[]): FlatRow[] {
  const childrenOf = (id: string): string[] =>
    childComponentsOf(project, id).sort((a, b) => a.localeCompare(b))

  const out: FlatRow[] = []

  const visit = (id: string, depth: number): void => {
    const component = project.components[id]

    if (!component) {return}
    out.push({ component, depth })

    for (const child of childrenOf(id)) {visit(child, depth + 1)}
  }

  for (const root of [...roots].sort((a, b) => a.localeCompare(b))) {visit(root, 0)}

  // Orphans (cycle members etc.) still deserve a row.
  const seen = new Set(out.map(r => r.component.id))

  for (const id of Object.keys(project.components).sort()) {
    if (!seen.has(id)) {
      const component = project.components[id]

      if (component) {out.push({ component, depth: 0 })}
    }
  }

  return out
}

export function AssemblyTree() {
  const project = useStore($activeArtifactProject)
  const roots = useStore($assemblyTreeRoots)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const rows = useMemo(() => (project ? flattenTree(project, roots) : []), [project, roots])

  if (!project) {return null}

  const toggle = (id: string): void => {
    setCollapsed(current => {
      const next = new Set(current)

      if (next.has(id)) {next.delete(id)}
      else {next.add(id)}

      return next
    })
  }

  // Hide rows under a collapsed ancestor.
  const visible: FlatRow[] = []
  const hiddenDepths: number[] = []

  for (const row of rows) {
    while (hiddenDepths.length && row.depth <= hiddenDepths[hiddenDepths.length - 1]) {hiddenDepths.pop()}

    if (hiddenDepths.length === 0) {visible.push(row)}

    if (collapsed.has(row.component.id)) {hiddenDepths.push(row.depth + 1)}
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="artifact-assembly-tree">
      <div className="px-2 pt-2 pb-1 text-[0.625rem] tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        components · {Object.keys(project.components).length}
      </div>
      {visible.map(({ component, depth }) => {
        const hasChildren = Object.values(project.constraints).some(c => c.parent === component.id)
        const isCollapsed = collapsed.has(component.id)

        return (
          <Fragment key={component.id}>
            <button
              className={cn(
                'group flex w-full items-center gap-1 py-[3px] pr-2 text-left text-xs hover:bg-(--chrome-action-hover)',
                'text-(--ui-text-secondary)'
              )}
              onClick={() => setArtifactSelection([component.id])}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
              type="button"
            >
              {hasChildren ? (
                <span
                  aria-label={isCollapsed ? 'expand' : 'collapse'}
                  className="grid size-4 shrink-0 place-items-center text-(--ui-text-tertiary)"
                  onClick={event => {
                    event.stopPropagation()
                    toggle(component.id)
                  }}
                  role="button"
                >
                  <ChevronRight className={cn('size-3 transition-transform', !isCollapsed && 'rotate-90')} />
                </span>
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="truncate">{component.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[0.5625rem] text-(--ui-text-tertiary) opacity-0 transition-opacity group-hover:opacity-100">
                {component.id}
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
