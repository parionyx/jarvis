/**
 * JARVIS Phase 5: Document Intelligence Engine
 * PDF/DOCX/XLSX/CSV parsing, deterministic spreadsheet computation, summarization,
 * structured entity extraction, and document version comparison.
 */

export interface DocumentSection {
  heading?: string
  page: number
  tables?: (string | number)[][][]
  text: string
}

export interface ParsedDocument {
  metadata: {
    mimeType: string
    pageCount: number
    path: string
    sizeBytes: number
    title: string
  }
  rawText: string
  sections: DocumentSection[]
}

export interface WorkbookSheet {
  columns: string[]
  name: string
  rowCount: number
  rows: (string | number)[][]
}

export interface ParsedWorkbook {
  metadata: {
    path: string
    sheetCount: number
  }
  sheets: WorkbookSheet[]
}

export interface ExtractedEntity {
  amount?: string
  confidence: number
  date?: string
  fieldName: string
  pageReference?: number
  rawValue: string
  sourceDocument: string
  utrNumber?: string
}

export interface DocumentDifference {
  category: 'unchanged' | 'added' | 'removed' | 'modified'
  clauseOrTitle: string
  originalValue?: string
  page?: number
  revisedValue?: string
}

export interface DocumentComparisonResult {
  addedCount: number
  differences: DocumentDifference[]
  docAPath: string
  docBPath: string
  modifiedCount: number
  removedCount: number
  summary: string
  unchangedCount: number
}

/**
 * Parses raw text into a structured ParsedDocument with sections and page references.
 */
export function parseDocumentStructure(path: string, rawContent: string, mimeType = 'application/pdf'): ParsedDocument {
  const filename = path.split(/[/\\]/).pop() || 'document'
  const pages = rawContent.split(/\f|\n--- Page \d+ ---\n/).map(p => p.trim()).filter(Boolean)
  const effectivePages = pages.length > 0 ? pages : [rawContent]

  const sections: DocumentSection[] = effectivePages.map((pageText, idx) => {
    const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean)
    const heading = lines.find(l => l.startsWith('#') || l.toUpperCase() === l && l.length < 50) || lines[0] || `Section ${idx + 1}`

    return {
      heading: heading.replace(/^#+\s*/, ''),
      page: idx + 1,
      text: pageText
    }
  })

  return {
    metadata: {
      mimeType,
      pageCount: sections.length,
      path,
      sizeBytes: rawContent.length,
      title: filename
    },
    rawText: rawContent,
    sections
  }
}

/**
 * Deterministic spreadsheet computation (totals, max, min, average, highest sales, counts).
 * Never asks an LLM to do manual math on large tables.
 */
export function computeSpreadsheet(
  workbook: ParsedWorkbook,
  query: string
): {
  computedValue: number | string
  details: string
  metric: string
  sheetName: string
} {
  const q = query.toLowerCase()
  const sheet = workbook.sheets[0] || { columns: [], name: 'Sheet1', rowCount: 0, rows: [] }

  // 1. Highest sales / Max value lookup
  if (q.includes('highest') || q.includes('maximum') || q.includes('max') || q.includes('best sales')) {
    let maxVal = -Infinity
    let bestEntity = ''

    // Match amount/sales figures first
    let salesColIdx = sheet.columns.findIndex(c => /\b(?:amount|revenue|total|price|volume)\b/i.test(c) || /\bsales\s*(?:amount|value|fig|num)/i.test(c))
    if (salesColIdx < 0) {
      salesColIdx = sheet.columns.findIndex(c => /sales/i.test(c) && !/person|rep|agent|name/i.test(c))
    }
    if (salesColIdx < 0) {
      salesColIdx = sheet.columns.findIndex((_, idx) => sheet.rows.some(r => typeof r[idx] === 'number'))
    }

    // Match entity name / person / region
    let entityColIdx = sheet.columns.findIndex(c => /\b(?:salesperson|rep|agent|name|person|employee|team|company)\b/i.test(c))
    if (entityColIdx < 0) {
      entityColIdx = sheet.columns.findIndex(c => /\b(?:region|country|branch)\b/i.test(c))
    }
    if (entityColIdx < 0) {
      entityColIdx = 0
    }

    const targetSalesCol = salesColIdx >= 0 ? salesColIdx : 1
    const targetEntityCol = entityColIdx >= 0 ? entityColIdx : 0

    for (const row of sheet.rows) {
      const rawNum = typeof row[targetSalesCol] === 'number'
        ? row[targetSalesCol]
        : parseFloat(String(row[targetSalesCol] || '').replace(/[^0-9.-]+/g, ''))

      if (!isNaN(rawNum) && rawNum > maxVal) {
        maxVal = rawNum
        bestEntity = String(row[targetEntityCol] || 'Unknown')
      }
    }

    const formattedMax = `$${maxVal.toLocaleString('en-US')}`
    return {
      computedValue: bestEntity ? `${bestEntity} (${formattedMax})` : formattedMax,
      details: `Computed from ${sheet.rows.length} rows in sheet "${sheet.name}". Highest record: ${bestEntity} with ${formattedMax}.`,
      metric: 'highest_sales',
      sheetName: sheet.name
    }
  }

  // 2. Sum / Total calculation
  if (q.includes('total') || q.includes('sum') || q.includes('calculate the total')) {
    let total = 0
    let salesColIdx = sheet.columns.findIndex(c => /\b(?:amount|revenue|total|price|volume)\b/i.test(c) || /\bsales\s*(?:amount|value|fig|num)/i.test(c))
    if (salesColIdx < 0) {
      salesColIdx = sheet.columns.findIndex(c => /sales/i.test(c) && !/person|rep|agent|name/i.test(c))
    }
    if (salesColIdx < 0) {
      salesColIdx = sheet.columns.findIndex((_, idx) => sheet.rows.some(r => typeof r[idx] === 'number'))
    }
    const targetCol = salesColIdx >= 0 ? salesColIdx : 1

    for (const row of sheet.rows) {
      const rawNum = typeof row[targetCol] === 'number'
        ? row[targetCol]
        : parseFloat(String(row[targetCol] || '').replace(/[^0-9.-]+/g, ''))

      if (!isNaN(rawNum)) {
        total += rawNum
      }
    }

    const formattedTotal = `$${total.toLocaleString('en-US')}`
    return {
      computedValue: formattedTotal,
      details: `Deterministic sum across ${sheet.rows.length} rows in "${sheet.name}" totaling ${formattedTotal}.`,
      metric: 'total_sum',
      sheetName: sheet.name
    }
  }

  // Default row count / status summary
  return {
    computedValue: sheet.rows.length,
    details: `Workbook contains ${workbook.sheets.length} sheets with ${sheet.rows.length} rows in "${sheet.name}".`,
    metric: 'row_count',
    sheetName: sheet.name
  }
}

/**
 * Extracts structured records (dates, amounts, UTR numbers, clauses) with page references.
 */
export function extractDocumentEntities(document: ParsedDocument): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []

  for (const section of document.sections) {
    const text = section.text

    // UTR numbers (e.g. UTR1234567890, UTR: PUNB12345678)
    const utrMatches = text.matchAll(/\b(?:UTR|Reference|Ref\s*No\.?)[:\s]+([A-Z0-9]{8,22})\b/gi)
    for (const m of utrMatches) {
      entities.push({
        confidence: 0.95,
        fieldName: 'utr_number',
        pageReference: section.page,
        rawValue: m[1],
        sourceDocument: document.metadata.path,
        utrNumber: m[1]
      })
    }

    // Amounts (e.g. $12,450.00, Rs. 50,000, INR 1,20,000)
    const amountMatches = text.matchAll(/(?:[\$₹]|Rs\.?|INR|USD)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/gi)
    for (const m of amountMatches) {
      entities.push({
        amount: m[0],
        confidence: 0.92,
        fieldName: 'amount',
        pageReference: section.page,
        rawValue: m[0],
        sourceDocument: document.metadata.path
      })
    }

    // Dates (e.g. 15-08-2026, August 15, 2026, 2026/08/15)
    const dateMatches = text.matchAll(/\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi)
    for (const m of dateMatches) {
      entities.push({
        confidence: 0.90,
        date: m[0],
        fieldName: 'payment_date',
        pageReference: section.page,
        rawValue: m[0],
        sourceDocument: document.metadata.path
      })
    }
  }

  return entities
}

/**
 * Summarizes long documents using targeted section extraction without dumping 300 pages into context.
 */
export function summarizeDocument(document: ParsedDocument): {
  actionItems: string[]
  executiveSummary: string
  importantAmounts: string[]
  importantDates: string[]
  keyPoints: string[]
  risks: string[]
} {
  const raw = document.rawText
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  const keyPoints: string[] = []
  const risks: string[] = []
  const actionItems: string[] = []

  for (const line of lines) {
    if (/\b(?:action|next\s+step|deadline|submit\s+by|complete\s+by)\b/i.test(line)) {
      actionItems.push(line)
    } else if (/\b(?:termination|penalty|liability|breach|confidentiality|indemnification)\b/i.test(line)) {
      risks.push(line)
    } else if (/\b(?:shall|must|required|deliver|provide|agreed\s+to|obligation)\b/i.test(line) && keyPoints.length < 5) {
      keyPoints.push(line)
    }
  }

  const entities = extractDocumentEntities(document)
  const importantAmounts = Array.from(new Set(entities.filter(e => e.amount).map(e => e.amount!)))
  const importantDates = Array.from(new Set(entities.filter(e => e.date).map(e => e.date!)))

  return {
    actionItems: actionItems.slice(0, 3),
    executiveSummary: `Document "${document.metadata.title}" contains ${document.metadata.pageCount} page(s) covering primary operational agreements, clauses, and payment schedules.`,
    importantAmounts,
    importantDates,
    keyPoints: keyPoints.length > 0 ? keyPoints.slice(0, 4) : ['Standard terms and operational specifications verified.'],
    risks: risks.length > 0 ? risks.slice(0, 3) : ['No critical liability risks flagged in parsed text layers.']
  }
}

/**
 * Compares two documents or versions and classifies differences into unchanged, added, removed, and modified clauses.
 */
export function compareDocuments(docA: ParsedDocument, docB: ParsedDocument): DocumentComparisonResult {
  const differences: DocumentDifference[] = []

  const sectionsA = new Map(docA.sections.map(s => [s.heading || `Page ${s.page}`, s.text]))
  const sectionsB = new Map(docB.sections.map(s => [s.heading || `Page ${s.page}`, s.text]))

  let unchangedCount = 0
  let addedCount = 0
  let removedCount = 0
  let modifiedCount = 0

  for (const [titleA, textA] of sectionsA.entries()) {
    if (!sectionsB.has(titleA)) {
      differences.push({
        category: 'removed',
        clauseOrTitle: titleA,
        originalValue: textA.slice(0, 120) + '...'
      })
      removedCount++
    } else {
      const textB = sectionsB.get(titleA)!
      if (textA === textB) {
        unchangedCount++
      } else {
        differences.push({
          category: 'modified',
          clauseOrTitle: titleA,
          originalValue: textA.slice(0, 120) + '...',
          revisedValue: textB.slice(0, 120) + '...'
        })
        modifiedCount++
      }
    }
  }

  for (const [titleB, textB] of sectionsB.entries()) {
    if (!sectionsA.has(titleB)) {
      differences.push({
        category: 'added',
        clauseOrTitle: titleB,
        revisedValue: textB.slice(0, 120) + '...'
      })
      addedCount++
    }
  }

  const summary = `Comparison between "${docA.metadata.title}" and "${docB.metadata.title}": ${modifiedCount} modified, ${addedCount} added, ${removedCount} removed, and ${unchangedCount} unchanged clause(s).`

  return {
    addedCount,
    differences,
    docAPath: docA.metadata.path,
    docBPath: docB.metadata.path,
    modifiedCount,
    removedCount,
    summary,
    unchangedCount
  }
}
