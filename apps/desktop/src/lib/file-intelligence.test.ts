import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearFileIndex,
  detectDuplicateFiles,
  indexFiles,
  pruneDeletedFiles,
  searchFileIndex,
  type FileIndexEntry
} from './file-discovery'
import {
  compareDocuments,
  computeSpreadsheet,
  extractDocumentEntities,
  parseDocumentStructure,
  summarizeDocument,
  type ParsedDocument,
  type ParsedWorkbook
} from './document-intelligence'
import {
  cleanupTempFiles,
  executeBulkPlan,
  generateOrganizePreview,
  getTempFileCount,
  trackTempFile
} from './file-operations'
import { JarvisToolRouter } from './tool-router'

describe('JARVIS Phase 5: Files & Document Intelligence', () => {
  let router: JarvisToolRouter

  beforeEach(() => {
    clearFileIndex()
    cleanupTempFiles()
    router = JarvisToolRouter.getInstance()
  })

  describe('1. File Discovery & Indexing', () => {
    it('indexes files and supports fast metadata and content search', () => {
      const entries: FileIndexEntry[] = [
        {
          createdAt: Date.now() - 10000,
          directory: 'C:\\Users\\works_ar\\Documents',
          extension: 'pdf',
          extractedText: 'Vendor Agreement with 30-day termination clause and payment terms.',
          hash: 'hash_123',
          indexedAt: Date.now(),
          modifiedAt: Date.now() - 5000,
          name: 'vendor_agreement.pdf',
          pageCount: 3,
          path: 'C:\\Users\\works_ar\\Documents\\vendor_agreement.pdf',
          sizeBytes: 102400
        },
        {
          createdAt: Date.now() - 20000,
          directory: 'C:\\Users\\works_ar\\Downloads',
          extension: 'xlsx',
          extractedText: 'Sales Q3 Report with regional figures.',
          hash: 'hash_456',
          indexedAt: Date.now(),
          modifiedAt: Date.now() - 15000,
          name: 'sales_q3.xlsx',
          path: 'C:\\Users\\works_ar\\Downloads\\sales_q3.xlsx',
          sizeBytes: 204800
        }
      ]

      indexFiles(entries)

      // Search by extension
      const pdfs = searchFileIndex({ extension: 'pdf' })
      expect(pdfs).toHaveLength(1)
      expect(pdfs[0].name).toBe('vendor_agreement.pdf')

      // Content search: "30-day termination clause"
      const clauseMatches = searchFileIndex({ textQuery: '30-day termination clause' })
      expect(clauseMatches).toHaveLength(1)
      expect(clauseMatches[0].name).toBe('vendor_agreement.pdf')
    })

    it('prunes deleted files from the index', () => {
      indexFiles([
        {
          createdAt: Date.now(),
          directory: 'C:\\Users\\works_ar\\Documents',
          extension: 'txt',
          indexedAt: Date.now(),
          modifiedAt: Date.now(),
          name: 'temp.txt',
          path: 'C:\\Users\\works_ar\\Documents\\temp.txt',
          sizeBytes: 500
        }
      ])

      const pruned = pruneDeletedFiles(new Set())
      expect(pruned).toBe(1)
      expect(searchFileIndex({})).toHaveLength(0)
    })

    it('detects duplicate files by SHA-256 hash', () => {
      const entries: FileIndexEntry[] = [
        {
          createdAt: Date.now(),
          directory: 'C:\\Users\\works_ar\\Downloads',
          extension: 'pdf',
          hash: 'identical_hash_abc',
          indexedAt: Date.now(),
          modifiedAt: Date.now(),
          name: 'invoice_copy1.pdf',
          path: 'C:\\Users\\works_ar\\Downloads\\invoice_copy1.pdf',
          sizeBytes: 51200
        },
        {
          createdAt: Date.now(),
          directory: 'C:\\Users\\works_ar\\Documents',
          extension: 'pdf',
          hash: 'identical_hash_abc',
          indexedAt: Date.now(),
          modifiedAt: Date.now(),
          name: 'invoice_copy2.pdf',
          path: 'C:\\Users\\works_ar\\Documents\\invoice_copy2.pdf',
          sizeBytes: 51200
        }
      ]

      const duplicates = detectDuplicateFiles(entries)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].paths).toHaveLength(2)
    })
  })

  describe('2. Document Intelligence & Parsers', () => {
    it('parses structured document pages and extracts sections', () => {
      const rawText = `SERVICE LEVEL AGREEMENT\n\n--- Page 2 ---\nPAYMENT TERMS\nTotal amount: $12,450.00 payable within 30 days.`
      const doc = parseDocumentStructure('C:\\docs\\agreement.pdf', rawText)

      expect(doc.metadata.pageCount).toBe(2)
      expect(doc.sections).toHaveLength(2)
      expect(doc.sections[1].heading).toBe('PAYMENT TERMS')
    })

    it('deterministically computes spreadsheet aggregates (highest sales & totals) without LLM math', () => {
      const workbook: ParsedWorkbook = {
        metadata: { path: 'sales.xlsx', sheetCount: 1 },
        sheets: [
          {
            columns: ['Region', 'Salesperson', 'Sales Amount'],
            name: 'Q3_Sales',
            rowCount: 3,
            rows: [
              ['North', 'Alice', 250000],
              ['South', 'Bob', 450000],
              ['West', 'Charlie', 180000]
            ]
          }
        ]
      }

      const highest = computeSpreadsheet(workbook, 'Who has the highest sales?')
      expect(highest.computedValue).toContain('Bob')
      expect(highest.computedValue).toContain('$450,000')

      const total = computeSpreadsheet(workbook, 'What is the total sales amount?')
      expect(total.computedValue).toBe('$880,000')
    })

    it('extracts structured entities (amounts, dates, UTR numbers) with citations', () => {
      const rawText = `INVOICE #9981\nDate: 15-08-2026\nPayment Ref / UTR: PUNB1234567890\nTotal Due: $12,450.00`
      const doc = parseDocumentStructure('invoice.pdf', rawText)
      const entities = extractDocumentEntities(doc)

      expect(entities.some(e => e.fieldName === 'utr_number' && e.rawValue === 'PUNB1234567890')).toBe(true)
      expect(entities.some(e => e.fieldName === 'amount' && e.amount === '$12,450.00')).toBe(true)
      expect(entities.some(e => e.fieldName === 'payment_date')).toBe(true)
    })

    it('summarizes long documents with key points, risks, and action items', () => {
      const rawText = `MASTER SERVICES CONTRACT\nAll liabilities are limited to total fees paid.\nTermination clause requires 30 days written notice.\nAction required: Complete onboarding by next week.\nTotal Value: $50,000.`
      const doc = parseDocumentStructure('contract.pdf', rawText)
      const summary = summarizeDocument(doc)

      expect(summary.executiveSummary).toBeDefined()
      expect(summary.risks.length).toBeGreaterThanOrEqual(1)
      expect(summary.actionItems.length).toBeGreaterThanOrEqual(1)
    })

    it('compares two contract versions and identifies modified/added/removed clauses', () => {
      const docA: ParsedDocument = parseDocumentStructure('v1.pdf', `CONFIDENTIALITY\nStrict non-disclosure.\n\n--- Page 2 ---\nTERMINATION\n30 days written notice.`)
      const docB: ParsedDocument = parseDocumentStructure('v2.pdf', `CONFIDENTIALITY\nStrict non-disclosure.\n\n--- Page 2 ---\nTERMINATION\n60 days written notice.\n\n--- Page 3 ---\nARBITRATION\nDisputes handled in New Delhi.`)

      const comparison = compareDocuments(docA, docB)
      expect(comparison.modifiedCount).toBe(1)
      expect(comparison.addedCount).toBe(1)
      expect(comparison.unchangedCount).toBe(1)
      expect(comparison.summary).toContain('1 modified')
    })
  })

  describe('3. File Operations & Safety', () => {
    it('generates dry-run preview for folder organization before execution', () => {
      const files = [
        { extension: 'pdf', name: 'report.pdf', path: 'C:\\Downloads\\report.pdf' },
        { extension: 'xlsx', name: 'data.xlsx', path: 'C:\\Downloads\\data.xlsx' },
        { extension: 'png', name: 'chart.png', path: 'C:\\Downloads\\chart.png' }
      ]

      const preview = generateOrganizePreview('C:\\Downloads', files)
      expect(preview.filesAffected).toBe(3)
      expect(preview.proposedDestinations).toContain('C:\\Downloads\\PDFs')
      expect(preview.proposedDestinations).toContain('C:\\Downloads\\Spreadsheets')
      expect(preview.proposedDestinations).toContain('C:\\Downloads\\Images')

      // Fails without confirmation
      const unconfirmed = executeBulkPlan(preview, false)
      expect(unconfirmed.success).toBe(false)
      expect(unconfirmed.skipped).toBe(3)

      // Succeeds when confirmed
      const confirmed = executeBulkPlan(preview, true)
      expect(confirmed.success).toBe(true)
      expect(confirmed.completed).toBe(3)
    })

    it('tracks temporary files and performs lifecycle cleanup', () => {
      trackTempFile('C:\\Temp\\render_page_1.png')
      trackTempFile('C:\\Temp\\ocr_scratch.txt')
      expect(getTempFileCount()).toBe(2)

      const cleanup = cleanupTempFiles()
      expect(cleanup.cleaned).toBe(2)
      expect(getTempFileCount()).toBe(0)
    })
  })

  describe('4. Tool Selection Engine Integration for Phase 5', () => {
    it('routes "Compare these two contracts" to document.compare', () => {
      const decision = router.route('Compare these two contracts')
      expect(decision.primaryToolId).toBe('document.compare')
    })

    it('routes "Summarize this document" to document.summarize', () => {
      const decision = router.route('Summarize this document')
      expect(decision.primaryToolId).toBe('document.summarize')
    })

    it('routes "What is the total amount in this invoice?" to document.extract', () => {
      const decision = router.route('What is the total amount in this invoice?')
      expect(decision.primaryToolId).toBe('document.extract')
    })

    it('routes "Find duplicate files" to file.duplicates', () => {
      const decision = router.route('Find duplicate files')
      expect(decision.primaryToolId).toBe('file.duplicates')
    })

    it('routes "Organize my Downloads folder" to file.organize_preview', () => {
      const decision = router.route('Organize my Downloads folder')
      expect(decision.primaryToolId).toBe('file.organize_preview')
    })

    it('routes "Move these invoices into the 2026 folder" to file.move', () => {
      const decision = router.route('Move these invoices into the 2026 folder')
      expect(decision.primaryToolId).toBe('file.move')
    })
  })
})
