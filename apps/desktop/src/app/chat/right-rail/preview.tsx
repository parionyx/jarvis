import { useStore } from '@nanostores/react'
import { useCallback } from 'react'

import { forgetPreviewConsole } from '@/app/chat/right-rail/preview-console-store'
import { $restartPreviewServer } from '@/app/contrib/panes'
import { $previewReloadRequest, $previewTabs, closeRightRailTab } from '@/store/preview'

import { PreviewPane } from './preview-pane'

interface PreviewTilePaneProps {
  /** The `$previewTabs` id this pane renders. */
  tabId: string
}

/**
 * One preview, as a layout-tree pane. The tab strip — its label, close verbs,
 * drag/stack/split and ⌘W — belongs to the ZONE (see `preview-tile.tsx`), so
 * this renders only the body and a preview tab behaves like every other tab.
 *
 * The console / DevTools toggles live in the pane's own browser bar beside the
 * address (`preview-browser-bar`); the restart handler arrives through the atom
 * bridge the old rail wrapper used, since the mirror renders this pane with no
 * props to thread.
 */
export function PreviewTilePane({ tabId }: PreviewTilePaneProps) {
  const previewReloadRequest = useStore($previewReloadRequest)
  const previewTabs = useStore($previewTabs)
  const restartPreviewServer = useStore($restartPreviewServer)
  const target = previewTabs.find(tab => tab.id === tabId)?.target

  // Same cleanup + close the pane-mirror's tab-strip ✕ uses — surfaced again
  // INSIDE the artifact header so the pane is closable without knowing about
  // tab strips at all.
  const onClose = useCallback(() => {
    forgetPreviewConsole(tabId)
    closeRightRailTab(tabId)
  }, [tabId])

  // The tab closed while this pane was still mounted (the mirror disposes it a
  // tick later).
  if (!target) {
    return null
  }

  return (
    <PreviewPane
      embedded
      onClose={target.kind === 'artifact' ? onClose : undefined}
      onRestartServer={target.kind === 'url' ? (restartPreviewServer ?? undefined) : undefined}
      reloadRequest={previewReloadRequest}
      tabId={tabId}
      target={target}
    />
  )
}
