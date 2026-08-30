/**
 * JARVIS Tool Selection Engine: Capability Taxonomy & Task Requirement Model
 * Extracts capability requirements, constraints, and risk classification from user intent.
 */

import type { ToolRiskClass } from './tool-definition'

export interface TaskRequirement {
  completeness: 'fast' | 'normal' | 'thorough'
  dataFreshness: 'any' | 'latest' | 'realtime'
  entities?: string[]
  explicitTool?: string
  forbiddenCapabilities?: string[]
  goal: string
  intent: string
  outputFormat?: 'text' | 'table' | 'csv' | 'json' | 'excel' | 'pdf' | 'report'
  preferredCapabilities?: string[]
  requiredCapabilities: string[]
  requiresAuth: boolean
  requiresBrowser: boolean
  requiresFileAccess: boolean
  requiresNetwork: boolean
  requiresVision: boolean
  riskLevel: ToolRiskClass
}

/**
 * Extracts task capability requirements from a natural-language user prompt.
 */
export function extractTaskRequirements(rawPrompt: string): TaskRequirement {
  const prompt = (rawPrompt || '').trim()
  const lower = prompt.toLowerCase()

  const req: TaskRequirement = {
    completeness: 'normal',
    dataFreshness: 'any',
    goal: prompt,
    intent: 'general',
    requiredCapabilities: [],
    requiresAuth: false,
    requiresBrowser: false,
    requiresFileAccess: false,
    requiresNetwork: false,
    requiresVision: false,
    riskLevel: 'read'
  }

  if (!prompt) return req

  // 1. Explicit User Tool Request Overrides
  if (/\b(?:use\s+exa|use\s+powershell|use\s+terminal|use\s+python)\b/i.test(lower)) {
    if (lower.includes('exa')) req.explicitTool = 'web.search.exa'
    if (lower.includes('powershell')) req.explicitTool = 'terminal.powershell'
    if (lower.includes('python')) req.explicitTool = 'code.python'
  }

  // JARVIS Phase 7: Memory & Context Commands
  // Explicit Remember (*"Remember that ONEX uses Supabase"*)
  if (/^(?:hey\s+jarvis\s*,?\s*)?(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i.test(lower)) {
    req.intent = 'remember_fact'
    req.requiredCapabilities = ['memory.write']
    req.riskLevel = 'low'
    return req
  }

  // Explicit Forget (*"Forget that ONEX uses Supabase"*, *"Forget that"*)
  if (/^(?:hey\s+jarvis\s*,?\s*)?(?:please\s+)?(?:forget\s+(?:that\s+|everything\s+about\s+)?|delete\s+(?:what\s+you\s+remember\s+about\s+|memories\s+about\s+))(.+)$/i.test(lower)) {
    req.intent = 'forget_fact'
    req.requiredCapabilities = ['memory.delete']
    req.riskLevel = 'low'
    return req
  }

  // Memory Inspection (*"What do you remember about ONEX?"*)
  if (/^(?:hey\s+jarvis\s*,?\s*)?(?:what\s+do\s+you\s+remember\s+about\s+|tell\s+me\s+what\s+you\s+remember\s+about\s+)(.+)$/i.test(lower)) {
    req.intent = 'inspect_memory'
    req.requiredCapabilities = ['memory.read']
    req.riskLevel = 'read'
    return req
  }

  // Cross-Session Task Continuation (*"Continue where we stopped"*)
  if (/\b(?:continue\s+where\s+we\s+stopped|resume\s+(?:my\s+)?task|resume\s+work|pick\s+up\s+where\s+we\s+left)\b/i.test(lower)) {
    req.intent = 'task_continue'
    req.requiredCapabilities = ['context.get']
    req.riskLevel = 'read'
    return req
  }

  // JARVIS Phase 9: Universal Tools & Integrations
  // Gmail
  if (/\b(?:check\s+(?:my\s+)?gmail|read\s+(?:my\s+)?(?:gmail|email)s?|gmail\s+mails?|aaj\s+ke\s+gmail\s+mails?)\b/i.test(lower)) {
    req.intent = 'gmail_read'
    req.requiredCapabilities = ['email.read']
    req.riskLevel = 'read'
    return req
  }

  // Google Calendar
  if (/\b(?:what(?:'?s|\s+is)\s+on\s+(?:my\s+)?calendar|check\s+(?:my\s+)?calendar|calendar\s+meetings?|kal\s+ke\s+meetings?)\b/i.test(lower)) {
    req.intent = 'calendar_read'
    req.requiredCapabilities = ['calendar.read']
    req.riskLevel = 'read'
    return req
  }

  // GitHub
  if (/\b(?:check\s+(?:my\s+)?github|github\s+prs?|open\s+prs?|my\s+prs?)\b/i.test(lower)) {
    req.intent = 'github_read'
    req.requiredCapabilities = ['github.pr.read']
    req.riskLevel = 'read'
    return req
  }

  // Supabase Database
  if (/\b(?:how\s+many\s+users\s+(?:are\s+)?in\s+supabase|check\s+supabase|query\s+supabase)\b/i.test(lower)) {
    req.intent = 'supabase_query'
    req.requiredCapabilities = ['database.query']
    req.riskLevel = 'read'
    return req
  }

  // Meta Ads
  if (/\b(?:check\s+meta\s+ads|meta\s+ads\s+performance|campaign\s+performance|meta\s+ka\s+performance)\b/i.test(lower)) {
    req.intent = 'meta_ads'
    req.requiredCapabilities = ['ads.read']
    req.riskLevel = 'read'
    return req
  }

  // AiSensy WhatsApp
  if (/\b(?:how\s+many\s+leads\s+came\s+through\s+aisensy|check\s+aisensy|aisensy\s+leads?)\b/i.test(lower)) {
    req.intent = 'aisensy_leads'
    req.requiredCapabilities = ['whatsapp.messages.read']
    req.riskLevel = 'read'
    return req
  }

  // ONEX CRM
  if (/\b(?:show\s+overdue\s+leads|onex\s+overdue\s+leads|onex\s+mein\s+overdue\s+leads)\b/i.test(lower)) {
    req.intent = 'onex_leads'
    req.requiredCapabilities = ['crm.leads.read']
    req.riskLevel = 'read'
    return req
  }

  // n8n Workflow Automation
  if (/\b(?:is\s+(?:the\s+)?n8n\s+workflow\s+running|check\s+n8n|n8n\s+failed\s+workflows?)\b/i.test(lower)) {
    req.intent = 'n8n_workflows'
    req.requiredCapabilities = ['workflow.read']
    req.riskLevel = 'read'
    return req
  }

  // 2. Deterministic Level 1 Operations
  // App Launch
  if (/\b(?:open|launch|start)\s+(?:chrome|vs\s*code|notepad|calculator|terminal|explorer)\b/i.test(lower)) {
    req.intent = 'launch_app'
    req.requiredCapabilities = ['computer.launch_app']
    req.riskLevel = 'low'
    return req
  }

  // Window Focus / Switch
  if (/\b(?:switch\s+to|focus|bring\s+to\s+front)\s+(.+)/i.test(lower)) {
    req.intent = 'focus_window'
    req.requiredCapabilities = ['computer.focus_window']
    req.riskLevel = 'low'
    return req
  }

  // Keyboard actions
  if (/\b(?:press\s+enter|press\s+tab|press\s+escape|type\s+enter)\b/i.test(lower)) {
    req.intent = 'key_press'
    req.requiredCapabilities = ['computer.key_press']
    req.riskLevel = 'low'
    return req
  }

  // Screen Vision / "What's on my screen?"
  if (/\b(?:what\s+is\s+on\s+my\s+screen|look\s+at\s+my\s+screen|what\s+do\s+you\s+see|read\s+this\s+screen|screen\s+error)\b/i.test(lower)) {
    req.intent = 'screen_vision'
    req.requiredCapabilities = ['screen.capture', 'vision.analyze']
    req.requiresVision = true
    return req
  }

  // GUI Click with visual grounding
  if (/\b(?:click\s+(?:the\s+)?(?:submit|login|button|icon|dropdown))\b/i.test(lower)) {
    req.intent = 'gui_click'
    req.requiredCapabilities = ['screen.capture', 'vision.grounding', 'computer.mouse']
    req.requiresVision = true
    req.riskLevel = 'medium'
    return req
  }

  // 3. Document / Spreadsheet / Local Files
  // Document Comparison (*"Compare these two contracts"*)
  if (/\b(?:compare\s+(?:these\s+)?(?:two\s+)?(?:contracts|documents|agreements|pdfs)|contract\s+comparison)\b/i.test(lower)) {
    req.intent = 'compare_documents'
    req.requiredCapabilities = ['file.read', 'document.compare']
    req.requiresFileAccess = true
    return req
  }

  // Document Summarization (*"Summarize this document"*)
  if (/\b(?:summarize\s+(?:this\s+)?(?:document|pdf|contract|report)|document\s+summary)\b/i.test(lower)) {
    req.intent = 'summarize_document'
    req.requiredCapabilities = ['file.read', 'document.summarize']
    req.requiresFileAccess = true
    return req
  }

  // Structured Information Extraction (*"Extract payment dates and UTR numbers"*, *"What is the total amount in this invoice?"*)
  if (
    /\b(?:extract\s+(?:all\s+)?(?:payment\s+dates|utr|amounts?|invoices?)|total\s+amount\s+in\s+(?:this\s+)?invoice)\b/i.test(
      lower
    )
  ) {
    req.intent = 'extract_entities'
    req.requiredCapabilities = ['file.read', 'document.extract']
    req.requiresFileAccess = true
    return req
  }

  // Duplicate Files Finding (*"Find duplicate files"*)
  if (/\b(?:find\s+duplicate\s+files|duplicate\s+detection|find\s+duplicates)\b/i.test(lower)) {
    req.intent = 'find_duplicates'
    req.requiredCapabilities = ['file.search', 'file.duplicates']
    req.requiresFileAccess = true
    return req
  }

  // Folder Organization Preview (*"Organize my Downloads folder"*)
  if (/\b(?:organize\s+(?:my\s+)?(?:downloads|folder|documents))\b/i.test(lower)) {
    req.intent = 'organize_folder'
    req.requiredCapabilities = ['file.search', 'file.organize_preview']
    req.requiresFileAccess = true
    req.riskLevel = 'medium'
    return req
  }

  // Move Files (*"Move these invoices into the 2026 folder"*)
  if (/\b(?:move\s+(?:these\s+)?(?:invoices|files)\s+(?:into|to))\b/i.test(lower)) {
    req.intent = 'move_files'
    req.requiredCapabilities = ['file.search', 'file.move']
    req.requiresFileAccess = true
    req.riskLevel = 'low'
    return req
  }

  // Cross-Phase: Web Download and Analyze (*"Download this report and analyze it"*)
  if (/\b(?:download\s+(?:this\s+)?report\s+and\s+analyze)\b/i.test(lower)) {
    req.intent = 'download_and_analyze'
    req.requiredCapabilities = ['web.fetch', 'document.read', 'document.summarize']
    req.requiresNetwork = true
    req.requiresFileAccess = true
    return req
  }

  // Cross-Phase: Research companies in spreadsheet (*"Research the companies in this spreadsheet"*)
  if (/\b(?:research\s+(?:the\s+)?companies\s+in\s+(?:this\s+)?spreadsheet)\b/i.test(lower)) {
    req.intent = 'spreadsheet_research'
    req.requiredCapabilities = ['file.read', 'spreadsheet.compute', 'web.research', 'spreadsheet.write']
    req.requiresNetwork = true
    req.requiresFileAccess = true
    return req
  }

  // PDF Parsing & Specific Clause Search
  if (
    /\b(?:read\s+(?:this\s+)?pdf|parse\s+pdf|extract\s+pdf|from\s+(?:the\s+)?pdf|pdf\s+that\s+mentions)\b/i.test(lower) ||
    prompt.endsWith('.pdf')
  ) {
    req.intent = 'read_pdf'
    req.requiredCapabilities = ['file.read', 'document.pdf_parse']
    req.requiresFileAccess = true
    return req
  }

  // Spreadsheet Compute / Analyze
  if (
    /\b(?:analyze\s+(?:this\s+)?excel|sum\s+(?:this\s+)?(?:column|excel)|highest\s+sales|spreadsheet\s+calculation)\b/i.test(
      lower
    ) ||
    prompt.endsWith('.xlsx') ||
    prompt.endsWith('.csv')
  ) {
    req.intent = 'analyze_spreadsheet'
    req.requiredCapabilities = ['file.read', 'spreadsheet.compute']
    req.requiresFileAccess = true
    return req
  }

  // Spreadsheet Write / Create Excel
  if (/\b(?:create\s+(?:an?\s+)?excel|export\s+(?:to\s+)?excel|save\s+as\s+xlsx|generate\s+spreadsheet)\b/i.test(lower)) {
    req.intent = 'write_spreadsheet'
    req.requiredCapabilities = ['spreadsheet.write', 'file.write']
    req.outputFormat = 'excel'
    req.riskLevel = 'low'
    return req
  }

  // Local File Search
  if (/\b(?:find\s+my\s+agreement|search\s+files?|find\s+file|locate\s+document)\b/i.test(lower)) {
    req.intent = 'search_file'
    req.requiredCapabilities = ['file.search', 'file.local']
    req.requiresFileAccess = true
    return req
  }

  // File Rename / Move / Delete
  if (/\b(?:rename\s+file|delete\s+file)\b/i.test(lower)) {
    req.intent = 'modify_file'
    req.requiredCapabilities = ['file.write', 'filesystem.modify']
    req.requiresFileAccess = true
    req.riskLevel = lower.includes('delete') ? 'high' : 'medium'
    return req
  }

  // 4. Developer & Terminal Operations
  if (/\b(?:check\s+(?:the\s+)?server|run\s+powershell|git\s+status|docker\s+ps|terminal\s+command|ssh\s+status)\b/i.test(lower)) {
    req.intent = 'terminal_execute'
    req.requiredCapabilities = ['terminal.execute']
    req.riskLevel = 'medium'
    return req
  }

  // 5. Complex Multi-Tool Research & Export
  // e.g. "Research 50 AI companies and export them to Excel"
  if (
    /\b(?:research|find|discover|list)\s+\d+\s+.*?(?:companies|tools|products|startups|entities|items)?.*?export\b/i.test(
      lower
    ) ||
    /\b(?:top\s+\d+.*?export)\b/i.test(lower)
  ) {
    req.intent = 'research_and_export'
    req.completeness = 'thorough'
    req.requiredCapabilities = ['web.search', 'web.research', 'spreadsheet.write', 'file.write']
    req.requiresNetwork = true
    req.outputFormat = 'excel'
    return req
  }

  // 6. Web Search & Research
  if (/\b(?:research|search\s+the\s+web|latest\s+news|what\s+is\s+the\s+latest|who\s+won|compare\s+companies)\b/i.test(lower)) {
    req.intent = 'web_research'
    req.requiredCapabilities = ['web.search', 'web.fetch']
    req.requiresNetwork = true
    req.dataFreshness = 'latest'
    // Browser is NOT required for web search
    req.requiresBrowser = false
    return req
  }

  return req
}
