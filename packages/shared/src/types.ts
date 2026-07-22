// Database models matching Section 7 of the INDRA AI Blueprint

export interface Organization {
  id: string; // "org_acme123"
  name: string; // "Acme Corporation"
  domain: string; // "acme.com"
  slug: string; // "acme" (URL-safe)
  plan: 'starter' | 'professional' | 'enterprise';
  seatCount: number; // licensed seats
  activeSeatCount: number; // currently used
  settings: {
    ssoEnabled: boolean;
    ssoProvider?: 'saml' | 'oidc';
    ssoConfig?: {
      entityId: string;
      ssoUrl: string;
      certificate: string; // PEM, stored encrypted
    };
    defaultRole: 'contributor' | 'viewer';
    allowPublicSignup: boolean;
    dataResidency: 'us' | 'eu' | 'apac';
    retentionDays: number; // knowledge retention policy
    cmekKeyId?: string; // Cloud KMS key (enterprise)
  };
  billing: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: any; // Date or Firebase Timestamp
    trialEndsAt?: any;
  };
  stats: {
    knowledgeCount: number;
    userCount: number;
    searchesToday: number;
    storageBytes: number;
  };
  createdAt: any;
  updatedAt: any;
  deletedAt?: any; // soft delete
}

export interface User {
  id: string; // Firebase UID "usr_abc123"
  orgId: string; // foreign key → organizations
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: 'super_admin' | 'knowledge_admin' | 'contributor' | 'viewer' | 'guest';
  status: 'active' | 'invited' | 'deactivated';
  expertise: string[]; // AI-derived expertise tags
  departments: string[];
  preferences: {
    theme: 'light' | 'dark' | 'system';
    emailDigest: 'daily' | 'weekly' | 'never';
    searchMode: 'ai' | 'semantic' | 'keyword';
    language: string; // BCP-47 language tag
  };
  collectionPermissions: {
    // Collection-level ACL overrides
    [collectionId: string]: 'read' | 'write' | 'admin' | 'none';
  };
  stats: {
    knowledgeCreated: number;
    searchesThisMonth: number;
    lastActiveAt: any;
  };
  invitedBy?: string; // user ID of inviter
  joinedAt?: any;
  invitedAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface KnowledgeEntry {
  id: string; // "kn_def456"
  orgId: string;
  title: string;
  summary: string; // AI-generated if not provided
  body: string; // Rich text (TipTap JSON serialized)
  bodyText: string; // Plain text for indexing
  type: 'article' | 'decision_log' | 'how_to' | 'faq' | 'reference' | 'meeting_note';
  status: 'draft' | 'in_review' | 'published' | 'archived';
  visibility: 'org' | 'team' | 'private';
  // Taxonomy
  collectionId: string;
  tags: string[];
  aiTags: string[]; // Auto-generated tags (source: AI)
  // Authorship
  authorId: string;
  contributorIds: string[];
  reviewerIds: string[];
  // Versioning
  version: number;
  versionHistory: {
    version: number;
    editedBy: string;
    editedAt: any;
    summary: string;
    bodySnapshot?: string; // Stored in GCS, reference here
  }[];
  // Type-specific metadata
  metadata: {
    // decision_log
    context?: string;
    options?: string[];
    decision?: string;
    outcome?: string;
    decisionDate?: any;
    // how_to
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    estimatedMinutes?: number;
    prerequisites?: string[];
    // meeting_note
    meetingDate?: any;
    attendees?: string[];
    actionItems?: { text: string; assigneeId: string; dueDate: any }[];
  };
  // AI enrichment
  embedding?: number[]; // text-embedding-3-large vector (stored in Pinecone, not Firestore)
  embeddingModel: string; // "text-embedding-3-large"
  embeddingUpdatedAt?: any;
  aiSummary?: string;
  aiConfidence?: number; // 0–1
  healthScore?: number; // 0–100 (staleness, conflicts, completeness)
  // Source tracking
  sourceIntegration?: {
    provider: string; // "confluence" | "notion" | etc.
    externalId: string;
    externalUrl: string;
    lastSyncedAt: any;
  };
  // Lifecycle
  expiresAt?: any;
  publishedAt?: any;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any; // soft delete
  // Engagement
  viewCount: number;
  bookmarkCount: number;
  feedbackPositive: number;
  feedbackNegative: number;
}

export interface Collection {
  id: string; // "col_engineering"
  orgId: string;
  name: string; // "Engineering"
  description?: string;
  parentId?: string; // Nested collections
  icon?: string; // Emoji or icon name
  color?: string; // Hex color for visual identification
  ownerId: string; // User responsible for curation
  visibility: 'org' | 'team' | 'private';
  permissions: {
    inheritFromOrg: boolean;
    explicit: {
      [userId: string]: 'read' | 'write' | 'admin';
    };
    teams: {
      [teamId: string]: 'read' | 'write';
    };
  };
  stats: {
    entryCount: number;
    viewsLast30Days: number;
    healthScore: number;
  };
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface SearchQuery {
  id: string;
  orgId: string;
  userId: string;
  query: string;
  mode: 'ai' | 'semantic' | 'keyword';
  filters: {
    collections?: string[];
    dateFrom?: any;
    dateTo?: any;
    authors?: string[];
  };
  resultCount: number;
  aiAnswerProvided: boolean;
  aiConfidence?: number;
  userFeedback?: 'positive' | 'negative' | null;
  latencyMs: number;
  sessionId: string;
  createdAt: any;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  actorId: string; // User performing the action
  actorIp: string; // Hashed IP
  actorUserAgent: string;
  action: AuditAction;
  resourceType: 'knowledge' | 'collection' | 'user' | 'integration' | 'org_settings';
  resourceId: string;
  before?: Record<string, any>; // State before change
  after?: Record<string, any>; // State after change
  metadata?: Record<string, any>;
  createdAt: any; // Immutable — never update
}

export type AuditAction =
  | 'knowledge.created'
  | 'knowledge.updated'
  | 'knowledge.deleted'
  | 'knowledge.viewed'
  | 'knowledge.exported'
  | 'user.invited'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'org.settings_changed'
  | 'integration.connected'
  | 'integration.disconnected'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_attempt';

export interface Integration {
  id: string;
  orgId: string;
  provider:
    | 'google_drive'
    | 'confluence'
    | 'notion'
    | 'slack'
    | 'github'
    | 'jira'
    | 'microsoft_365'
    | 'zendesk'
    | 'salesforce';
  status: 'active' | 'error' | 'paused' | 'pending_auth';
  credentials: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: any;
    apiKey?: string;
    baseUrl?: string;
  };
  config: {
    syncFrequencyMinutes: number; // 60 default
    includePaths?: string[]; // Drive folders, Confluence spaces, etc.
    excludePaths?: string[];
    maxDepth?: number;
    lastCursor?: string; // Pagination cursor for incremental sync
  };
  stats: {
    documentsIngested: number;
    lastSyncAt?: any;
    lastSyncStatus: 'success' | 'partial' | 'failed';
    lastSyncError?: string;
    lastSyncDurationMs?: number;
  };
  connectedBy: string; // User ID
  createdAt: any;
  updatedAt: any;
}

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  type:
    | 'knowledge_review_requested'
    | 'knowledge_mentioned'
    | 'knowledge_expired'
    | 'expert_match'
    | 'integration_error'
    | 'invite_accepted'
    | 'ai_answer_escalation';
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  resourceUrl?: string;
  read: boolean;
  readAt?: any;
  createdAt: any;
}

// PostgreSQL Graph Entity & Relational Models (Section 7.2)
export interface GraphEntity {
  id: string;
  orgId: string;
  entityType: 'person' | 'topic' | 'document' | 'project' | 'team';
  name: string;
  attributes?: Record<string, any>;
  createdAt: any;
}

export interface GraphRelationship {
  id: string;
  orgId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: 'authored' | 'references' | 'supersedes' | 'related_to' | 'expert_in';
  weight: number;
  metadata?: Record<string, any>;
  createdAt: any;
}
