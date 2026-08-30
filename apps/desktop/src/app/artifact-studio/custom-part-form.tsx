import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import {
  $activeArtifactProject,
  applyArtifactActions,
  pushConsoleLine
} from '@/store/artifact-studio'

import { nextComponentId, slugifyType } from './component-palette'

/**
 * Custom part form — palette me jo type nahi hai use bhi banao. Type
 * free-form hai (backend whitelist nahi lagata); renderer given dims +
 * color se render karta hai, warna generic box.
 */
export function CustomPartForm() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const project = useStore($activeArtifactProject)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [w, setW] = useState('40')
  const [h, setH] = useState('25')
  const [d, setD] = useState('30')
  const [color, setColor] = useState('#71717a')
  const [busy, setBusy] = useState(false)

  if (!project) {return null}

  const add = async (): Promise<void> => {
    const trimmed = name.trim()

    if (!trimmed || busy) {return}

    const type = slugifyType(trimmed)
    const id = nextComponentId(Object.keys(project.components), type)
    const stackZ = Object.keys(project.components).length * 12
    const hexColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined

    setBusy(true)

    const ok = await applyArtifactActions(
      [
        {
          type: 'component.create',
          component: {
            id,
            type,
            name: trimmed,
            category: 'custom',
            geometry: {
              primitive: 'box',
              params: { w_mm: Number(w) || 40, h_mm: Number(h) || 25, d_mm: Number(d) || 30 }
            },
            material: hexColor ? { name: 'custom', color: hexColor } : { name: 'generic' },
            transform: {
              position: { x: 0, y: 0, z: 40 + stackZ },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            }
          }
        }
      ],
      { reason: 'custom part from palette' }
    )

    setBusy(false)

    if (ok) {
      setName('')
      pushConsoleLine('success', `added ${id}`)
    } else {
      pushConsoleLine('error', `could not add ${id}`)
    }
  }

  return (
    <div className="border-t border-(--ui-stroke-quaternary) px-2 py-2" data-testid="artifact-custom-part">
      {!open ? (
        <button
          className="w-full rounded-[4px] border border-dashed border-(--ui-stroke-secondary) py-1 text-[0.5625rem] tracking-wide text-(--ui-text-tertiary) uppercase transition-colors hover:border-(--theme-primary) hover:text-(--ui-text-secondary)"
          onClick={() => setOpen(true)}
          type="button"
        >
          + {a.customPart}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            aria-label={a.customName}
            autoFocus
            className="h-6 w-full rounded-[4px] border border-(--ui-stroke-tertiary) bg-transparent px-1.5 text-xs text-(--ui-text-primary) outline-none focus:border-(--theme-primary)"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {void add()}

              if (e.key === 'Escape') {setOpen(false)}
            }}
            placeholder={a.customNamePlaceholder}
            value={name}
          />
          <div className="flex items-center gap-1">
            <span className="text-[0.5625rem] text-(--ui-text-tertiary)">mm</span>
            {[
              [w, setW, 'W'],
              [h, setH, 'H'],
              [d, setD, 'D']
            ].map(([val, setter, label]) => (
              <input
                aria-label={`${a.customDims} ${label}`}
                className="h-5 w-11 rounded-[3px] border border-(--ui-stroke-tertiary) bg-transparent px-1 font-mono text-[0.625rem] text-(--ui-text-secondary) outline-none focus:border-(--theme-primary)"
                key={label as string}
                onChange={e => (setter as (v: string) => void)(e.target.value)}
                type="number"
                value={val as string}
              />
            ))}
            <input
              aria-label={a.customColor}
              className="h-5 w-8 cursor-pointer rounded-[3px] border border-(--ui-stroke-tertiary) bg-transparent"
              onChange={e => setColor(e.target.value)}
              title={a.customColor}
              type="color"
              value={color}
            />
          </div>
          <div className="flex gap-1">
            <Button disabled={!name.trim() || busy} onClick={() => void add()} size="xs" type="button">
              {a.paletteAdd}
            </Button>
            <Button onClick={() => setOpen(false)} size="xs" type="button" variant="ghost">
              {a.cancelReview}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
