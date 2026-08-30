/**
 * JARVIS Phase 5: File Discovery Engine
 * Fast metadata search, incremental on-demand folder indexing, content-based search,
 * and duplicate file detection.
 */

export interface FileMetadata {
  createdAt: number
  directory: string
  extension: string
  hash?: string
  mimeType?: string
  modifiedAt: number
  name: string
  path: string
  sizeBytes: number
}

export interface FileIndexEntry extends FileMetadata {
  extractedText?: string
  indexedAt: number
  pageCount?: number
}

export interface FileSearchFilter {
  createdAfter?: number
  directory?: string
  extension?: string
  maxSizeBytes?: number
  minSizeBytes?: number
  modifiedAfter?: number
  namePattern?: string
  textQuery?: string
}

export interface DuplicateFileGroup {
  hash: string
  paths: string[]
  recommendedAction: string
  sizeBytes: number
}

// In-memory index of indexed folders
const fileIndex = new Map<string, FileIndexEntry>()

/**
 * Normalizes file extension to lowercase without leading dot.
 */
export function normalizeExtension(filename: string): string {
  const ext = filename.split('.').pop() || ''
  return ext.toLowerCase().trim()
}

/**
 * Returns MIME type based on file extension.
 */
export function getMimeType(filename: string): string {
  const ext = normalizeExtension(filename)
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'csv':
      return 'text/csv'
    case 'json':
      return 'application/json'
    case 'txt':
      return 'text/plain'
    case 'md':
      return 'text/markdown'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'zip':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Indexes a list of file metadata entries into the local index.
 */
export function indexFiles(entries: FileIndexEntry[]): void {
  for (const entry of entries) {
    fileIndex.set(entry.path, {
      ...entry,
      indexedAt: Date.now(),
      mimeType: entry.mimeType || getMimeType(entry.name)
    })
  }
}

/**
 * Prunes deleted files from the index.
 */
export function pruneDeletedFiles(existingPaths: Set<string>): number {
  let pruned = 0
  for (const path of fileIndex.keys()) {
    if (!existingPaths.has(path)) {
      fileIndex.delete(path)
      pruned++
    }
  }
  return pruned
}

/**
 * Clears the file index.
 */
export function clearFileIndex(): void {
  fileIndex.clear()
}

/**
 * Searches the file index by metadata and content filters.
 */
export function searchFileIndex(filter: FileSearchFilter): FileIndexEntry[] {
  const results: FileIndexEntry[] = []

  for (const entry of fileIndex.values()) {
    // 1. Directory filter
    if (filter.directory && !entry.directory.toLowerCase().startsWith(filter.directory.toLowerCase())) {
      continue
    }

    // 2. Extension filter
    if (filter.extension) {
      const targetExt = filter.extension.replace(/^\./, '').toLowerCase()
      if (entry.extension.toLowerCase() !== targetExt) {
        continue
      }
    }

    // 3. Name pattern (fuzzy/substring)
    if (filter.namePattern) {
      const pattern = filter.namePattern.toLowerCase()
      if (!entry.name.toLowerCase().includes(pattern)) {
        continue
      }
    }

    // 4. Size bounds
    if (filter.minSizeBytes !== undefined && entry.sizeBytes < filter.minSizeBytes) {
      continue
    }
    if (filter.maxSizeBytes !== undefined && entry.sizeBytes > filter.maxSizeBytes) {
      continue
    }

    // 5. Modification date bounds
    if (filter.modifiedAfter !== undefined && entry.modifiedAt < filter.modifiedAfter) {
      continue
    }

    // 6. Content / Text query
    if (filter.textQuery) {
      const query = filter.textQuery.toLowerCase()
      const text = (entry.extractedText || '').toLowerCase()
      if (!text.includes(query) && !entry.name.toLowerCase().includes(query)) {
        continue
      }
    }

    results.push(entry)
  }

  // Sort by modification date descending
  return results.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

/**
 * Detects duplicate files across indexed files based on hash and file size.
 */
export function detectDuplicateFiles(entries: FileIndexEntry[]): DuplicateFileGroup[] {
  const hashMap = new Map<string, string[]>()
  const sizeMap = new Map<string, number>()

  for (const entry of entries) {
    if (entry.hash) {
      const list = hashMap.get(entry.hash) || []
      list.push(entry.path)
      hashMap.set(entry.hash, list)
      sizeMap.set(entry.hash, entry.sizeBytes)
    }
  }

  const duplicates: DuplicateFileGroup[] = []
  for (const [hash, paths] of hashMap.entries()) {
    if (paths.length > 1) {
      duplicates.push({
        hash,
        paths,
        recommendedAction: `Keep newest file (${paths[0]}) and review ${paths.length - 1} duplicate copies for archiving/cleanup.`,
        sizeBytes: sizeMap.get(hash) || 0
      })
    }
  }

  return duplicates
}
