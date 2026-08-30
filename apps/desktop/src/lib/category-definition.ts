/**
 * JARVIS Capability Discovery: Category Definition & Taxonomy
 * Central category definitions, capability mappings, and category relationship graph.
 */

export type CategoryName =
  | 'LOCAL'
  | 'COMPUTER'
  | 'WEB'
  | 'RESEARCH'
  | 'DEVOPS'
  | 'CLOUD'
  | 'BUSINESS'
  | 'COMMUNICATION'
  | 'AI'
  | 'DATABASE'
  | 'DEVELOPMENT'
  | 'DOCUMENT'
  | 'ARTIFACT'
  | 'HOME_IOT'

export type DiscoverySource =
  | 'local'
  | 'mcp'
  | 'api'
  | 'cli'
  | 'sdk'
  | 'online'

export interface JarvisCategoryDefinition {
  capabilities: string[]
  description: string
  discoverySources: DiscoverySource[]
  id: CategoryName
  name: string
  priority?: number
  relatedCategories: CategoryName[]
}

export const CATEGORY_RELATIONSHIPS: Record<CategoryName, CategoryName[]> = {
  AI: ['LOCAL', 'COMPUTER', 'RESEARCH', 'COMMUNICATION'],
  ARTIFACT: ['DOCUMENT', 'LOCAL', 'BUSINESS'],
  BUSINESS: ['COMMUNICATION', 'DATABASE', 'CLOUD', 'RESEARCH'],
  CLOUD: ['DEVOPS', 'DATABASE', 'DEVELOPMENT'],
  COMMUNICATION: ['BUSINESS', 'WEB', 'LOCAL'],
  COMPUTER: ['LOCAL', 'COMMUNICATION', 'AI'],
  DATABASE: ['CLOUD', 'DEVOPS', 'LOCAL', 'BUSINESS'],
  DEVELOPMENT: ['DEVOPS', 'LOCAL', 'CLOUD', 'DATABASE'],
  DEVOPS: ['DEVELOPMENT', 'CLOUD', 'DATABASE', 'LOCAL'],
  DOCUMENT: ['LOCAL', 'AI', 'ARTIFACT'],
  HOME_IOT: ['LOCAL', 'COMMUNICATION', 'CLOUD'],
  LOCAL: ['DOCUMENT', 'COMPUTER', 'DEVOPS', 'ARTIFACT'],
  RESEARCH: ['WEB', 'BUSINESS', 'AI', 'DOCUMENT'],
  WEB: ['RESEARCH', 'COMMUNICATION', 'COMPUTER']
}

export const DEFAULT_CATEGORIES: JarvisCategoryDefinition[] = [
  {
    capabilities: [
      'file.read',
      'file.write',
      'file.search',
      'file.delete',
      'file.move',
      'spreadsheet.compute'
    ],
    description: 'Local filesystem operations, documents, and deterministic spreadsheet math.',
    discoverySources: ['local', 'cli'],
    id: 'LOCAL',
    name: 'Local Operations',
    priority: 100,
    relatedCategories: CATEGORY_RELATIONSHIPS.LOCAL
  },
  {
    capabilities: [
      'computer.mouse',
      'computer.keyboard',
      'computer.launch_app',
      'computer.window',
      'screen.capture'
    ],
    description: 'Direct Windows computer control, input simulation, and active window management.',
    discoverySources: ['local'],
    id: 'COMPUTER',
    name: 'Computer Control',
    priority: 95,
    relatedCategories: CATEGORY_RELATIONSHIPS.COMPUTER
  },
  {
    capabilities: [
      'web.search',
      'web.fetch',
      'web.crawl',
      'web.scrape',
      'web.extract',
      'web.research'
    ],
    description: 'Universal web discovery, search engines, direct extraction, and web research.',
    discoverySources: ['mcp', 'api', 'online'],
    id: 'WEB',
    name: 'Web & Internet',
    priority: 90,
    relatedCategories: CATEGORY_RELATIONSHIPS.WEB
  },
  {
    capabilities: [
      'research.deep',
      'research.verify',
      'research.compare',
      'research.candidates'
    ],
    description: 'Multi-source entity discovery, competitive analysis, and citation verification.',
    discoverySources: ['mcp', 'api', 'online'],
    id: 'RESEARCH',
    name: 'Deep Research',
    priority: 85,
    relatedCategories: CATEGORY_RELATIONSHIPS.RESEARCH
  },
  {
    capabilities: [
      'terminal.execute',
      'system.cpu.read',
      'git.action',
      'docker.action',
      'ssh.action',
      'workflow.execute'
    ],
    description: 'PowerShell, terminal commands, process management, and DevOps tooling.',
    discoverySources: ['local', 'cli', 'mcp'],
    id: 'DEVOPS',
    name: 'DevOps & System',
    priority: 80,
    relatedCategories: CATEGORY_RELATIONSHIPS.DEVOPS
  },
  {
    capabilities: [
      'cloud.deploy',
      'vercel.deploy',
      'supabase.admin',
      'workflow.status'
    ],
    description: 'Cloud hosting, deployments, and backend infrastructure.',
    discoverySources: ['mcp', 'api', 'cli'],
    id: 'CLOUD',
    name: 'Cloud & Infrastructure',
    priority: 75,
    relatedCategories: CATEGORY_RELATIONSHIPS.CLOUD
  },
  {
    capabilities: [
      'crm.leads.read',
      'crm.leads.search',
      'crm.leads.update',
      'ads.read',
      'campaign.read',
      'whatsapp.messages.read',
      'whatsapp.broadcast.send'
    ],
    description: 'CRM leads, sales pipelines, Meta Ads marketing, and WhatsApp business communications.',
    discoverySources: ['api', 'mcp'],
    id: 'BUSINESS',
    name: 'Business & CRM',
    priority: 70,
    relatedCategories: CATEGORY_RELATIONSHIPS.BUSINESS
  },
  {
    capabilities: [
      'email.read',
      'email.send',
      'email.search',
      'calendar.read',
      'calendar.create',
      'message.send'
    ],
    description: 'Gmail, Google Calendar, meetings, scheduling, and messaging.',
    discoverySources: ['mcp', 'api'],
    id: 'COMMUNICATION',
    name: 'Communication',
    priority: 65,
    relatedCategories: CATEGORY_RELATIONSHIPS.COMMUNICATION
  },
  {
    capabilities: [
      'vision.analyze',
      'memory.read',
      'memory.write',
      'memory.delete',
      'context.get'
    ],
    description: 'Vision understanding, long-term memory, and contextual reasoning engines.',
    discoverySources: ['local', 'api'],
    id: 'AI',
    name: 'AI & Intelligence',
    priority: 60,
    relatedCategories: CATEGORY_RELATIONSHIPS.AI
  },
  {
    capabilities: [
      'database.query',
      'database.read',
      'database.write',
      'database.schema'
    ],
    description: 'SQL queries, relational databases, and PostgreSQL table operations.',
    discoverySources: ['mcp', 'api', 'cli'],
    id: 'DATABASE',
    name: 'Database',
    priority: 55,
    relatedCategories: CATEGORY_RELATIONSHIPS.DATABASE
  },
  {
    capabilities: [
      'code.python',
      'code.execute',
      'github.pr.read',
      'github.issue.read',
      'github.issue.create'
    ],
    description: 'Code execution, Python scripting, and GitHub developer workflows.',
    discoverySources: ['local', 'cli', 'mcp'],
    id: 'DEVELOPMENT',
    name: 'Development',
    priority: 50,
    relatedCategories: CATEGORY_RELATIONSHIPS.DEVELOPMENT
  },
  {
    capabilities: [
      'document.pdf.extract',
      'document.pdf_to_cad',
      'document.ocr',
      'document.convert'
    ],
    description: 'PDF extraction, OCR text recognition, and file conversion.',
    discoverySources: ['local', 'cli', 'mcp', 'api', 'online'],
    id: 'DOCUMENT',
    name: 'Document & OCR',
    priority: 45,
    relatedCategories: CATEGORY_RELATIONSHIPS.DOCUMENT
  },
  {
    capabilities: [
      'spreadsheet.write',
      'artifact.generate',
      'report.export'
    ],
    description: 'Workbook generation, file exports, and report artifacts.',
    discoverySources: ['local'],
    id: 'ARTIFACT',
    name: 'Artifacts & Export',
    priority: 40,
    relatedCategories: CATEGORY_RELATIONSHIPS.ARTIFACT
  },
  {
    capabilities: [
      'home.light.control',
      'home.device.status',
      'home.automation'
    ],
    description: 'Smart home control, IoT devices, and home automation.',
    discoverySources: ['mcp', 'api', 'online'],
    id: 'HOME_IOT',
    name: 'Home & IoT',
    priority: 35,
    relatedCategories: CATEGORY_RELATIONSHIPS.HOME_IOT
  }
]
