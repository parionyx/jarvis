import { useStore } from '@nanostores/react'
import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'

// Vendored UMD builds (?raw → inlined into the bundle at build time): React 18
// + Babel standalone run the artifact's JSX inside the sandboxed iframe with
// zero network access. React 19 dropped UMD builds, hence pinning 18 here.
import babelStandaloneSource from '@/assets/vendor/babel-standalone.min.js?raw'
import reactSource from '@/assets/vendor/react-18.production.min.js?raw'
import reactDomSource from '@/assets/vendor/react-dom-18.production.min.js?raw'
import { CopyButton } from '@/components/ui/copy-button'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { artifactDownloadName, type ArtifactKind } from '@/lib/artifact-detect'
import { downloadTextFile } from '@/lib/download-text'
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from '@/lib/icons'
import { $artifactRegistry, $artifactVersionSelection, findArtifact, selectArtifactVersion } from '@/store/artifacts'
import { notifyError } from '@/store/notifications'
import type { PreviewTarget } from '@/store/preview'

import { PreviewEmptyState, PreviewModeSwitcher, type PreviewViewMode, SourceView } from './preview-file'

const MIME_BY_KIND = {
  code: 'text/plain',
  html: 'text/html',
  react: 'text/html',
  svg: 'image/svg+xml'
} as const

// Shiki has no `svg` grammar; code artifacts keep their detected fence language.
const SOURCE_LANGUAGE_BY_KIND: Record<ArtifactKind, string | undefined> = {
  code: undefined,
  html: 'html',
  react: undefined,
  svg: 'xml'
}

const HEADER_BUTTON_CLASS =
  'flex items-center gap-1 rounded-md px-1.5 text-[0.625rem] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40'

/** Wrap an HTML fragment in a minimal document shell; full documents pass
 *  through untouched. Keeps generated fragments (no <html>/<body>) rendering
 *  with sane defaults instead of quirks-mode soup. */
function composeArtifactHtml(content: string): string {
  if (/<html[\s>]|<!doctype\s+html/i.test(content)) {
    return content
  }

  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>body{margin:0;font-family:system-ui,sans-serif}</style></head><body>',
    content,
    '</body></html>'
  ].join('\n')
}

/**
 * Build the self-contained document for a React/JSX artifact.
 * ...
 * Exported for tests only — the renderer treats this as an implementation
 * detail of the live view.
 */
export function composeReactArtifactHtml(source: string): string {
  // JSON.stringify escapes quotes/newlines; only `</script>` could break out
  // of the inline script element — neutralize it.
  const safeSource = JSON.stringify(source).replace(/<\/script/gi, '<\\/script')
  const safeBabel = JSON.stringify(babelStandaloneSource)
  const safeReact = JSON.stringify(reactSource)
  const safeReactDom = JSON.stringify(reactDomSource)

  const runner = `
;(function () {
  var mount = document.getElementById('hermes-artifact-root')
  function fail(message) {
    mount.innerHTML = ''
    var box = document.createElement('pre')
    box.style.cssText = 'white-space:pre-wrap;padding:16px;font:12px ui-monospace,monospace;color:#b91c1c'
    box.textContent = message
    document.body.appendChild(box)
  }
  try {
    var raw = ${safeSource}
    // ESM → plain script: capture the default export, drop export keywords.
    var prepared = raw
      .replace(/export\\s+default\\s+/g, 'window.__HERMES_ARTIFACT_DEFAULT__ = ')
      .replace(/export\\s+(const|let|var|function|class)\\s/g, '$1 ')
    var out = window.Babel.transform(prepared, {
      filename: 'artifact.tsx',
      presets: [
        ['react', {}],
        ['typescript', { isTSX: true, allExtensions: true }]
      ]
    }).code
    // Execute in global scope so top-level declarations exist for the mount.
    ;(0, eval)(out + '\\n;window.__HERMES_ARTIFACT_READY__ = true;')
    var Candidate =
      window.__HERMES_ARTIFACT_DEFAULT__ ||
      (typeof App !== 'undefined' ? App : null) ||
      (typeof Component !== 'undefined' ? Component : null)
    if (!Candidate) {
      fail('No component found. Add "export default function App()" to your artifact.')
      return
    }
    var element = window.React.isValidElement(Candidate) ? Candidate : window.React.createElement(Candidate)
    window.ReactDOM.createRoot(mount).render(element)
  } catch (error) {
    fail(String((error && error.message) || error))
  }
})()
`

  // The vendored libraries are embedded as inline scripts — srcdoc iframes
  // have no origin-relative base URL, so file/network references cannot
  // resolve.
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>',
    'body{margin:0;font-family:system-ui,sans-serif}',
    '#hermes-artifact-root{min-height:100vh}',
    '</style>',
    '<script>' + decodeScript(safeReact) + '</script>',
    '<script>' + decodeScript(safeReactDom) + '</script>',
    '<script>' + decodeScript(safeBabel) + '</script>',
    '</head><body>',
    '<div id="hermes-artifact-root"></div>',
    '<script>' + runner + '</script>',
    '</body></html>'
  ].join('\n')
}

/** Turn a JSON-string-encoded source into inline script text. */
function decodeScript(encoded: string): string {
  return JSON.parse(encoded).replace(/<\/script/gi, '<\\/script')
}

/** Write the composed document to a real temp file through the existing
 *  buffer-save IPC, then hand it to the OS browser. A blob/data URL can't
 *  cross into the OS default browser, so a file on disk is the honest path. */
async function openHtmlInBrowser(content: string): Promise<void> {
  const bridge = window.hermesDesktop

  if (!bridge?.saveImageBuffer || !bridge.openExternal) {
    throw new Error('Desktop bridge unavailable')
  }

  const bytes = new TextEncoder().encode(composeArtifactHtml(content))
  const path = await bridge.saveImageBuffer(bytes, '.html')

  if (!path) {
    throw new Error('Could not write artifact file')
  }

  const fileUrl = `file://${path.startsWith('/') ? '' : '/'}${path.replace(/\\/g, '/')}`

  if (bridge.openPreviewInBrowser) {
    await bridge.openPreviewInBrowser(fileUrl)

    return
  }

  await bridge.openExternal(fileUrl)
}

/**
 * Live view for renderable artifact content.
 *
 * HTML runs in an `<iframe sandbox="allow-scripts">` — scripts execute in an
 * opaque origin with no same-origin access, no top navigation, no popups, no
 * form submission out of the frame. The parent app is unreachable. SVG is
 * DOMPurify-sanitized with the same profile as the inline ```svg embed.
 * React artifacts get the same sandbox around an inlined React 18 + Babel
 * runtime that transpiles and mounts the artifact's component on the spot.
 */
function ArtifactLiveView({ content, kind, title }: { content: string; kind: ArtifactKind; title: string }) {
  const svgClean = useMemo(
    () => (kind === 'svg' ? DOMPurify.sanitize(content, { USE_PROFILES: { svg: true, svgFilters: true } }) : ''),
    [content, kind]
  )

  if (kind === 'svg') {
    return (
      <div className="grid h-full place-items-center overflow-auto bg-background p-4 [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full">
        <div dangerouslySetInnerHTML={{ __html: svgClean }} />
      </div>
    )
  }

  const doc = kind === 'react' ? composeReactArtifactHtml(content) : composeArtifactHtml(content)

  return (
    <iframe
      className="block size-full border-0 bg-white"
      sandbox="allow-scripts"
      srcDoc={doc}
      // Deliberately raw white + forced light scheme: the frame hosts foreign
      // generated HTML that assumes a light canvas, so it renders deterministically
      // light in both app themes instead of inheriting theme tokens it can't see.
      style={{ colorScheme: 'light' }}
      title={title}
    />
  )
}

function VersionStepper({
  current,
  onSelect,
  total
}: {
  current: number
  onSelect: (index: number) => void
  total: number
}) {
  const { t } = useI18n()
  const copy = t.artifactPreview

  if (total < 2) {
    return null
  }

  return (
    <>
      <Tip label={copy.olderVersion}>
        <button
          aria-label={copy.olderVersion}
          className={HEADER_BUTTON_CLASS}
          disabled={current === 0}
          onClick={() => onSelect(current - 1)}
          type="button"
        >
          <ChevronLeft className="size-3" />
        </button>
      </Tip>
      <span className="text-[0.625rem] font-bold tabular-nums text-muted-foreground">
        {copy.versionOf(current + 1, total)}
      </span>
      <Tip label={copy.newerVersion}>
        <button
          aria-label={copy.newerVersion}
          className={HEADER_BUTTON_CLASS}
          disabled={current === total - 1}
          onClick={() => onSelect(current + 1)}
          type="button"
        >
          <ChevronRight className="size-3" />
        </button>
      </Tip>
      {current < total - 1 && (
        <button
          className="text-[0.625rem] font-bold text-muted-foreground underline decoration-current/25 underline-offset-4 transition-colors hover:text-foreground"
          onClick={() => onSelect(total - 1)}
          type="button"
        >
          {copy.latest}
        </button>
      )}
    </>
  )
}

/**
 * Renders an `artifact` preview target inside the real preview pane: the
 * shared mode switcher up top (RENDERED / SOURCE, plus the version stepper and
 * content actions in its trailing slot) over either the live view or the same
 * windowed source view a file preview uses.
 *
 * The target only carries the artifact id — content is read live from the
 * registry, so an open tab picks up new versions as the model iterates.
 *
 * `onClose` (wired by the tile pane) adds an always-visible ✕ beside the other
 * header actions. The zone tab strip also closes this pane, but a close that
 * lives INSIDE the artifact is the one users find when they came here from an
 * artifact card click and don't know about tab strips.
 */
export function ArtifactPreview({
  onClose,
  target
}: {
  onClose?: () => void
  target: PreviewTarget
}) {
  const { t } = useI18n()
  const copy = t.artifactPreview
  const artifactId = target.url
  const registry = useStore($artifactRegistry)
  const versionSelection = useStore($artifactVersionSelection)
  const [userMode, setUserMode] = useState<PreviewViewMode | null>(null)

  // Reset the explicit mode when the pane is reused for another artifact.
  useEffect(() => {
    setUserMode(null)
  }, [artifactId])

  const record = useMemo(() => findArtifact(registry, artifactId), [artifactId, registry])

  if (!record) {
    return <PreviewEmptyState body={copy.missingBody} title={copy.missingTitle} />
  }

  const renderable = record.kind === 'html' || record.kind === 'react' || record.kind === 'svg'
  const modes: PreviewViewMode[] = renderable ? ['rendered', 'source'] : ['source']
  const mode = userMode && modes.includes(userMode) ? userMode : modes[0]!
  const versionIndex = Math.min(versionSelection[artifactId] ?? record.versions.length - 1, record.versions.length - 1)
  const version = record.versions[versionIndex]!

  return (
    <div className="flex h-full flex-col overflow-hidden bg-transparent">
      <PreviewModeSwitcher
        active={mode}
        modes={modes}
        onSelect={setUserMode}
        trailing={
          <>
            <VersionStepper
              current={versionIndex}
              onSelect={index => selectArtifactVersion(artifactId, index)}
              total={record.versions.length}
            />
            <CopyButton
              appearance="inline"
              className="h-5 px-1 opacity-70 hover:opacity-100"
              iconClassName="size-3"
              label={copy.copyContent}
              showLabel={false}
              text={version.content}
            />
            <Tip label={copy.download}>
              <button
                aria-label={copy.download}
                className={HEADER_BUTTON_CLASS}
                onClick={() =>
                  downloadTextFile(
                    artifactDownloadName(record.kind, record.language, record.title),
                    version.content,
                    MIME_BY_KIND[record.kind]
                  )
                }
                type="button"
              >
                <Download className="size-3" />
              </button>
            </Tip>
            {record.kind !== 'code' && record.kind !== 'svg' && window.hermesDesktop && (
              <Tip label={copy.openInBrowser}>
                <button
                  aria-label={copy.openInBrowser}
                  className={HEADER_BUTTON_CLASS}
                  onClick={() =>
                    void openHtmlInBrowser(
                      record.kind === 'react' ? composeReactArtifactHtml(version.content) : version.content
                    ).catch(error => notifyError(error, copy.openInBrowserFailed))
                  }
                  type="button"
                >
                  <ExternalLink className="size-3" />
                </button>
              </Tip>
            )}
            {onClose && (
              <Tip label={t.common.close}>
                <button
                  aria-label={t.common.close}
                  className={HEADER_BUTTON_CLASS}
                  data-slot="aui_artifact-preview-close"
                  onClick={onClose}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </Tip>
            )}
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'rendered' && renderable ? (
          <ArtifactLiveView content={version.content} kind={record.kind} title={record.title} />
        ) : (
          <SourceView language={SOURCE_LANGUAGE_BY_KIND[record.kind] ?? record.language} text={version.content} />
        )}
      </div>
    </div>
  )
}
