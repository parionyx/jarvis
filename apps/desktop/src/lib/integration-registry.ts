/**
 * JARVIS Phase 9: Universal Integration Registry
 * Central metadata registry and runtime discovery for external SaaS, APIs,
 * communication tools, databases, and MCP servers.
 */

export type IntegrationCategory =
  | 'communication'
  | 'productivity'
  | 'business'
  | 'developer'
  | 'cloud'
  | 'database'
  | 'custom'

export type IntegrationAvailability =
  | 'connected'
  | 'available'
  | 'disconnected'
  | 'degraded'
  | 'unavailable'

export type AuthType =
  | 'oauth'
  | 'api_key'
  | 'service_account'
  | 'mcp'
  | 'local'
  | 'none'

export interface JarvisIntegrationDefinition {
  authentication: {
    authenticated: boolean
    tokenKey?: string
    type: AuthType
  }
  availability: IntegrationAvailability
  capabilities: string[]
  category: IntegrationCategory
  description: string
  id: string
  name: string
  provider?: string
  requiresUserAuth: boolean
  riskDefaults: {
    delete: 'high' | 'critical'
    read: 'read' | 'low'
    write: 'medium' | 'high'
  }
  supportsDelete: boolean
  supportsRead: boolean
  supportsWrite: boolean
}

export class JarvisIntegrationRegistry {
  private static instance: JarvisIntegrationRegistry | null = null
  private integrations: Map<string, JarvisIntegrationDefinition> = new Map()

  private constructor() {
    this.registerDefaultIntegrations()
  }

  public static getInstance(): JarvisIntegrationRegistry {
    if (!JarvisIntegrationRegistry.instance) {
      JarvisIntegrationRegistry.instance = new JarvisIntegrationRegistry()
    }
    return JarvisIntegrationRegistry.instance
  }

  /**
   * Registers default supported integration definitions.
   */
  private registerDefaultIntegrations(): void {
    // 1. GMAIL
    this.register({
      authentication: { authenticated: false, type: 'oauth' },
      availability: 'disconnected',
      capabilities: ['email.read', 'email.search', 'email.send', 'email.reply', 'attachment.read'],
      category: 'communication',
      description: 'Read, search, send, and reply to emails via Gmail.',
      id: 'gmail',
      name: 'Gmail',
      provider: 'google',
      requiresUserAuth: true,
      riskDefaults: { delete: 'high', read: 'read', write: 'medium' },
      supportsDelete: true,
      supportsRead: true,
      supportsWrite: true
    })

    // 2. GOOGLE CALENDAR
    this.register({
      authentication: { authenticated: false, type: 'oauth' },
      availability: 'disconnected',
      capabilities: ['calendar.read', 'calendar.search', 'calendar.create', 'calendar.update', 'calendar.delete'],
      category: 'productivity',
      description: 'Manage events, meetings, and daily schedules on Google Calendar.',
      id: 'google_calendar',
      name: 'Google Calendar',
      provider: 'google',
      requiresUserAuth: true,
      riskDefaults: { delete: 'high', read: 'read', write: 'medium' },
      supportsDelete: true,
      supportsRead: true,
      supportsWrite: true
    })

    // 3. GITHUB
    this.register({
      authentication: { authenticated: true, type: 'mcp' },
      availability: 'connected',
      capabilities: ['github.repo.read', 'github.issue.read', 'github.issue.create', 'github.pr.read', 'github.pr.create'],
      category: 'developer',
      description: 'Repositories, issues, pull requests, and workflows via GitHub MCP.',
      id: 'github',
      name: 'GitHub',
      provider: 'github',
      requiresUserAuth: false,
      riskDefaults: { delete: 'critical', read: 'read', write: 'medium' },
      supportsDelete: false,
      supportsRead: true,
      supportsWrite: true
    })

    // 4. SUPABASE
    this.register({
      authentication: { authenticated: true, type: 'api_key' },
      availability: 'connected',
      capabilities: ['database.query', 'database.read', 'database.write', 'database.schema.read'],
      category: 'database',
      description: 'PostgreSQL database queries and table operations on Supabase.',
      id: 'supabase',
      name: 'Supabase',
      provider: 'supabase',
      requiresUserAuth: false,
      riskDefaults: { delete: 'critical', read: 'read', write: 'high' },
      supportsDelete: true,
      supportsRead: true,
      supportsWrite: true
    })

    // 5. META ADS
    this.register({
      authentication: { authenticated: true, type: 'api_key' },
      availability: 'connected',
      capabilities: ['ads.read', 'campaign.read', 'insights.read', 'adset.read'],
      category: 'business',
      description: 'Campaign performance, spend, impressions, clicks, and lead analytics on Meta Ads.',
      id: 'meta_ads',
      name: 'Meta Ads',
      provider: 'meta',
      requiresUserAuth: false,
      riskDefaults: { delete: 'critical', read: 'read', write: 'high' },
      supportsDelete: false,
      supportsRead: true,
      supportsWrite: false
    })

    // 6. AISENSY (WhatsApp Business)
    this.register({
      authentication: { authenticated: true, type: 'api_key' },
      availability: 'connected',
      capabilities: ['whatsapp.contacts.read', 'whatsapp.campaign.read', 'whatsapp.messages.read', 'whatsapp.broadcast.send'],
      category: 'business',
      description: 'WhatsApp broadcast campaigns, message tracking, and incoming leads via AiSensy.',
      id: 'aisensy',
      name: 'AiSensy',
      provider: 'aisensy',
      requiresUserAuth: false,
      riskDefaults: { delete: 'high', read: 'read', write: 'high' },
      supportsDelete: false,
      supportsRead: true,
      supportsWrite: true
    })

    // 7. ONEX CRM
    this.register({
      authentication: { authenticated: true, type: 'api_key' },
      availability: 'connected',
      capabilities: ['crm.leads.read', 'crm.leads.search', 'crm.leads.update', 'crm.tasks.read', 'crm.reports.read'],
      category: 'business',
      description: 'Lead management, overdue follow-ups, and sales tracking in ONEX CRM.',
      id: 'onex',
      name: 'ONEX CRM',
      provider: 'onex',
      requiresUserAuth: false,
      riskDefaults: { delete: 'high', read: 'read', write: 'medium' },
      supportsDelete: false,
      supportsRead: true,
      supportsWrite: true
    })

    // 8. N8N WORKFLOW AUTOMATION
    this.register({
      authentication: { authenticated: true, type: 'api_key' },
      availability: 'connected',
      capabilities: ['workflow.read', 'workflow.execute', 'workflow.status'],
      category: 'cloud',
      description: 'Workflow execution, run status, and error logs via n8n.',
      id: 'n8n',
      name: 'n8n',
      provider: 'n8n',
      requiresUserAuth: false,
      riskDefaults: { delete: 'high', read: 'read', write: 'medium' },
      supportsDelete: false,
      supportsRead: true,
      supportsWrite: true
    })
  }

  public register(integration: JarvisIntegrationDefinition): void {
    this.integrations.set(integration.id, integration)
  }

  public get(id: string): JarvisIntegrationDefinition | undefined {
    return this.integrations.get(id)
  }

  public list(): JarvisIntegrationDefinition[] {
    return Array.from(this.integrations.values())
  }

  public listIntegrations(): JarvisIntegrationDefinition[] {
    return this.list()
  }

  /**
   * Discovers integrations by capability.
   */
  public findByCapability(capability: string): JarvisIntegrationDefinition[] {
    return this.list().filter(i => i.capabilities.includes(capability))
  }

  /**
   * Updates availability state of an integration.
   */
  public setAvailability(id: string, availability: IntegrationAvailability): void {
    const integration = this.integrations.get(id)
    if (integration) {
      integration.availability = availability
      integration.authentication.authenticated = availability === 'connected'
    }
  }
}
