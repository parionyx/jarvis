/**
 * JARVIS Phase 8: Planner & Dynamic Replanning
 * Goal decomposition into task DAGs, dynamic replanning on tool failures,
 * and loop prevention.
 */

import { classifyFailure } from './agent-verification'
import type { JarvisGoal } from './goal-model'
import {
  createTaskGraph,
  type JarvisPlanTask,
  type JarvisTaskGraph
} from './task-graph'

export interface PlannerConfig {
  defaultTimeoutMs: number
  maxPlanRevisions: number
  maxRetriesPerTask: number
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  defaultTimeoutMs: 30000,
  maxPlanRevisions: 3,
  maxRetriesPerTask: 2
}

/**
 * Decomposes a high-level goal into a dependency-aware task graph.
 */
export function decomposeGoal(
  goal: JarvisGoal,
  config: PlannerConfig = DEFAULT_PLANNER_CONFIG
): JarvisTaskGraph {
  const lower = goal.objective.toLowerCase()
  const tasks: JarvisPlanTask[] = []

  // 1. Complex Multi-Step: Research + Compare + Excel Export
  // e.g. "Research 50 AI companies, compare them, and export to Excel"
  if (
    /\b(?:research|find|discover|list)\s+\d+\s+.*?(?:companies|tools|products|startups)?.*?export\b/i.test(
      lower
    ) ||
    (lower.includes('research') && lower.includes('excel'))
  ) {
    const t1Id = `task_${Date.now()}_1`
    const t2Id = `task_${Date.now()}_2`
    const t3Id = `task_${Date.now()}_3`

    tasks.push({
      dependencies: [],
      description: 'Discover and research candidate companies across web sources',
      goalId: goal.id,
      id: t1Id,
      maxRetries: config.maxRetriesPerTask,
      parallelGroup: 'web_research',
      requiredCapabilities: ['web.search', 'web.research'],
      retryCount: 0,
      riskLevel: 'read',
      status: 'ready',
      timeoutMs: config.defaultTimeoutMs,
      toolId: 'web.research.adaptive',
      verificationState: { method: 'evidence_validation', verified: false }
    })

    tasks.push({
      dependencies: [t1Id],
      description: 'Generate structured Excel workbook with comparison data',
      goalId: goal.id,
      id: t2Id,
      maxRetries: config.maxRetriesPerTask,
      requiredCapabilities: ['spreadsheet.write', 'file.write'],
      retryCount: 0,
      riskLevel: 'low',
      status: 'waiting',
      timeoutMs: config.defaultTimeoutMs,
      toolId: 'spreadsheet.write',
      verificationState: { method: 'file_exists_validation', verified: false }
    })

    tasks.push({
      dependencies: [t2Id],
      description: 'Verify exported spreadsheet artifact on disk',
      goalId: goal.id,
      id: t3Id,
      maxRetries: config.maxRetriesPerTask,
      requiredCapabilities: ['file.read'],
      retryCount: 0,
      riskLevel: 'read',
      status: 'waiting',
      timeoutMs: 5000,
      toolId: 'file.search',
      verificationState: { method: 'file_readable_validation', verified: false }
    })

    return createTaskGraph(tasks)
  }

  // 2. Multi-Step: Invoices Search -> Extraction -> Total Calculation
  // e.g. "Find all invoices and calculate the total"
  if (lower.includes('invoice') && (lower.includes('total') || lower.includes('sum'))) {
    const t1Id = `task_${Date.now()}_1`
    const t2Id = `task_${Date.now()}_2`

    tasks.push({
      dependencies: [],
      description: 'Search local directory for invoice PDF documents',
      goalId: goal.id,
      id: t1Id,
      maxRetries: config.maxRetriesPerTask,
      requiredCapabilities: ['file.search', 'file.read'],
      retryCount: 0,
      riskLevel: 'read',
      status: 'ready',
      timeoutMs: 10000,
      toolId: 'file.search',
      verificationState: { method: 'file_matches_found', verified: false }
    })

    tasks.push({
      dependencies: [t1Id],
      description: 'Extract amounts and deterministically calculate total',
      goalId: goal.id,
      id: t2Id,
      maxRetries: config.maxRetriesPerTask,
      requiredCapabilities: ['document.extract', 'spreadsheet.compute'],
      retryCount: 0,
      riskLevel: 'read',
      status: 'waiting',
      timeoutMs: 15000,
      toolId: 'spreadsheet.compute',
      verificationState: { method: 'math_verified', verified: false }
    })

    return createTaskGraph(tasks)
  }

  // 3. Multi-Integration Business Briefing (Parallel Execution)
  // e.g. "Check Gmail, calendar, Meta, AiSensy, and ONEX and give me a briefing"
  if (
    (lower.includes('briefing') || lower.includes('summary')) &&
    (lower.includes('gmail') || lower.includes('calendar') || lower.includes('meta') || lower.includes('onex'))
  ) {
    const services = [
      { cap: 'email.read', desc: 'Fetch latest unread emails from Gmail', toolId: 'gmail.email.read' },
      { cap: 'calendar.read', desc: 'Inspect upcoming meetings on Google Calendar', toolId: 'calendar.read' },
      { cap: 'ads.read', desc: 'Retrieve campaign spend and lead stats from Meta Ads', toolId: 'meta.insights.read' },
      { cap: 'whatsapp.messages.read', desc: 'Fetch WhatsApp leads from AiSensy', toolId: 'aisensy.leads.read' },
      { cap: 'crm.leads.read', desc: 'Inspect overdue follow-ups from ONEX CRM', toolId: 'onex.leads.read' }
    ]

    for (let i = 0; i < services.length; i++) {
      const s = services[i]
      tasks.push({
        dependencies: [],
        description: s.desc,
        goalId: goal.id,
        id: `task_${Date.now()}_briefing_${i + 1}`,
        maxRetries: config.maxRetriesPerTask,
        parallelGroup: 'business_briefing',
        requiredCapabilities: [s.cap],
        retryCount: 0,
        riskLevel: 'read',
        status: 'ready',
        timeoutMs: config.defaultTimeoutMs,
        toolId: s.toolId,
        verificationState: { method: 'data_returned', verified: false }
      })
    }

    return createTaskGraph(tasks)
  }

  // 4. Cross-Service Comparison: Meta Ads vs AiSensy Leads
  // e.g. "Compare Meta leads with AiSensy leads"
  if (lower.includes('compare') && lower.includes('meta') && lower.includes('aisensy')) {
    const t1Id = `task_${Date.now()}_meta`
    const t2Id = `task_${Date.now()}_aisensy`

    tasks.push({
      dependencies: [],
      description: 'Fetch Meta Ads lead counts and campaign spend',
      goalId: goal.id,
      id: t1Id,
      maxRetries: config.maxRetriesPerTask,
      parallelGroup: 'lead_comparison',
      requiredCapabilities: ['ads.read'],
      retryCount: 0,
      riskLevel: 'read',
      status: 'ready',
      timeoutMs: config.defaultTimeoutMs,
      toolId: 'meta.insights.read',
      verificationState: { method: 'meta_data_valid', verified: false }
    })

    tasks.push({
      dependencies: [],
      description: 'Fetch AiSensy WhatsApp lead records',
      goalId: goal.id,
      id: t2Id,
      maxRetries: config.maxRetriesPerTask,
      parallelGroup: 'lead_comparison',
      requiredCapabilities: ['whatsapp.messages.read'],
      retryCount: 0,
      riskLevel: 'read',
      status: 'ready',
      timeoutMs: config.defaultTimeoutMs,
      toolId: 'aisensy.leads.read',
      verificationState: { method: 'aisensy_data_valid', verified: false }
    })

    return createTaskGraph(tasks)
  }

  // 5. Single-step direct operations (App launch, memory, integrations, terminal, vision)
  let toolId = 'computer.launch_app'
  let requiredCapabilities = ['computer.launch_app']

  if (/\b(?:check\s+(?:my\s+)?gmail|read\s+(?:my\s+)?(?:gmail|email)s?|gmail\s+mails?|aaj\s+ke\s+gmail\s+mails?)\b/i.test(lower)) {
    toolId = 'gmail.email.read'
    requiredCapabilities = ['email.read']
  } else if (/\b(?:what'?s\s+on\s+my\s+calendar|check\s+(?:my\s+)?calendar|calendar\s+meetings?|kal\s+ke\s+meetings?)\b/i.test(lower)) {
    toolId = 'calendar.read'
    requiredCapabilities = ['calendar.read']
  } else if (/\b(?:check\s+(?:my\s+)?github|github\s+prs?|open\s+prs?|my\s+prs?)\b/i.test(lower)) {
    toolId = 'github.pr.read'
    requiredCapabilities = ['github.pr.read']
  } else if (/\b(?:how\s+many\s+users\s+(?:are\s+)?in\s+supabase|check\s+supabase|query\s+supabase)\b/i.test(lower)) {
    toolId = 'supabase.database.query'
    requiredCapabilities = ['database.query']
  } else if (/\b(?:check\s+meta\s+ads|meta\s+ads\s+performance|campaign\s+performance|meta\s+ka\s+performance)\b/i.test(lower)) {
    toolId = 'meta.insights.read'
    requiredCapabilities = ['ads.read']
  } else if (/\b(?:how\s+many\s+leads\s+came\s+through\s+aisensy|check\s+aisensy|aisensy\s+leads?)\b/i.test(lower)) {
    toolId = 'aisensy.leads.read'
    requiredCapabilities = ['whatsapp.messages.read']
  } else if (/\b(?:show\s+overdue\s+leads|onex\s+overdue\s+leads|onex\s+mein\s+overdue\s+leads)\b/i.test(lower)) {
    toolId = 'onex.leads.read'
    requiredCapabilities = ['crm.leads.read']
  } else if (/\b(?:is\s+(?:the\s+)?n8n\s+workflow\s+running|check\s+n8n|n8n\s+failed\s+workflows?)\b/i.test(lower)) {
    toolId = 'n8n.workflow.read'
    requiredCapabilities = ['workflow.read']
  } else if (/\b(?:what\s+is\s+on\s+my\s+screen|look\s+at\s+my\s+screen)\b/i.test(lower)) {
    toolId = 'vision.analyze'
    requiredCapabilities = ['screen.capture', 'vision.analyze']
  } else if (/\b(?:remember\s+that)\b/i.test(lower)) {
    toolId = 'memory.write'
    requiredCapabilities = ['memory.write']
  } else if (/\b(?:check\s+(?:the\s+)?server)\b/i.test(lower)) {
    toolId = 'terminal.execute'
    requiredCapabilities = ['terminal.execute']
  } else if (/\b(?:search|latest\s+news|what\s+is)\b/i.test(lower)) {
    toolId = 'web.search.direct'
    requiredCapabilities = ['web.search']
  }

  tasks.push({
    dependencies: [],
    description: `Execute direct action: ${goal.objective}`,
    goalId: goal.id,
    id: `task_${Date.now()}_1`,
    maxRetries: config.maxRetriesPerTask,
    requiredCapabilities,
    retryCount: 0,
    riskLevel: goal.riskLevel === 'high' ? 'high' : 'low',
    status: 'ready',
    timeoutMs: config.defaultTimeoutMs,
    toolId,
    verificationState: { method: 'execution_result_ok', verified: false }
  })

  return createTaskGraph(tasks)
}

/**
 * Dynamically replans an in-flight task graph when a step fails.
 * Loop prevention: Strictly bounds total plan revisions.
 */
export function replanOnFailure(
  goal: JarvisGoal,
  graph: JarvisTaskGraph,
  failedTaskId: string,
  errorMessage: string,
  config: PlannerConfig = DEFAULT_PLANNER_CONFIG
): {
  actionTaken: 'retried' | 'fallback_switched' | 'failed'
  graph: JarvisTaskGraph
  revised: boolean
} {
  const task = graph.tasks.get(failedTaskId)
  if (!task) {
    return { actionTaken: 'failed', graph, revised: false }
  }

  // Loop Prevention: Refuse replanning if max revisions exceeded
  if (goal.planVersion >= config.maxPlanRevisions) {
    task.status = 'failed'
    task.error = `Max plan revisions (${config.maxPlanRevisions}) reached. Aborting to prevent infinite loop.`
    return { actionTaken: 'failed', graph, revised: false }
  }

  const diagnosis = classifyFailure(errorMessage, task)

  if (diagnosis.category === 'TRANSIENT' || diagnosis.category === 'RETRYABLE') {
    task.retryCount++
    task.status = 'retrying'
    goal.planVersion++
    return { actionTaken: 'retried', graph, revised: true }
  }

  if (diagnosis.category === 'RECOVERABLE') {
    // Switch to fallback tool
    if (task.toolId === 'web.research.adaptive') {
      task.toolId = 'web.search.direct'
    } else if (task.toolId === 'web.search.direct') {
      task.toolId = 'web.fetch.direct'
    } else {
      task.toolId = 'web.search.direct'
    }

    task.retryCount = 0
    task.status = 'ready'
    goal.planVersion++
    return { actionTaken: 'fallback_switched', graph, revised: true }
  }

  // Blocked or Permanent failure
  task.status = 'failed'
  task.error = errorMessage
  return { actionTaken: 'failed', graph, revised: false }
}
