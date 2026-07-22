import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { createContext } from './context';
import { db } from './services/database';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    
    if (isLocalhost || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Rate-limit response headers (PRD §6.9 — simulated tier-based limits)
app.use((_req, res, next) => {
  res.setHeader('X-RateLimit-Limit', '1000');
  res.setHeader('X-RateLimit-Remaining', '999');
  res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 60));
  next();
});

// Raw body parser for Stripe webhook signature verification (PRD §6.8)
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// tRPC express integration
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC Error on path "${path}":`, error);
    },
  })
);

// Health check endpoint — includes DB connectivity status (PRD §2.5)
app.get('/health', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }
  res.json({
    status: dbStatus === 'ok' ? 'OK' : 'DEGRADED',
    uptime: process.uptime(),
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Stripe webhook (PRD §6.8 — signature verification)
app.post('/webhook/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!sig || webhookSecret.includes('replace')) {
    console.warn('[stripe] Webhook received but STRIPE_WEBHOOK_SECRET not configured');
    res.json({ received: true, status: 'unverified' });
    return;
  }

  // In production, use Stripe SDK: stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  // For now, log the event type from raw body
  try {
    const event = JSON.parse((req.body as Buffer).toString()) as { type: string; id: string };
    console.info(`[stripe] Webhook received: ${event.type} (${event.id})`);
    res.json({ received: true, type: event.type });
  } catch (err) {
    console.error('[stripe] Webhook parse error:', err);
    res.status(400).json({ error: 'Invalid webhook payload' });
  }
});

// Database seeding helper for local demo environment
async function seedDatabase() {
  const orgCount = await db.organization.count();
  if (orgCount > 0) {
    console.info('Database already contains records. Skipping seed.');
    return;
  }

  console.info('Seeding default database records for INDRA AI...');

  const orgId = 'org_acme123';
  const userId = 'usr_priya';

  // Seed Org
  await db.organization.create({
    data: {
      id: orgId,
      name: 'Acme Corporation',
      domain: 'acme.com',
      slug: 'acme',
      plan: 'professional',
      seatCount: 100,
      activeSeatCount: 1,
      settings: JSON.stringify({
        ssoEnabled: false,
        defaultRole: 'contributor',
        allowPublicSignup: false,
        dataResidency: 'us',
        retentionDays: 365,
      }),
      billing: JSON.stringify({
        stripeCustomerId: 'cus_mock123',
        stripeSubscriptionId: 'sub_mock123',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      stats: JSON.stringify({
        knowledgeCount: 3,
        userCount: 1,
        searchesToday: 0,
        storageBytes: 102400,
      }),
    },
  });

  // Seed User
  await db.user.create({
    data: {
      id: userId,
      orgId,
      email: 'priya@acme.com',
      displayName: 'Priya Sharma',
      role: 'super_admin',
      status: 'active',
      expertise: JSON.stringify(['React', 'TypeScript', 'Node.js', 'Firebase', 'Postgres']),
      departments: JSON.stringify(['Engineering']),
      preferences: JSON.stringify({
        theme: 'dark',
        emailDigest: 'daily',
        searchMode: 'ai',
        language: 'en',
      }),
      collectionPermissions: JSON.stringify({}),
      stats: JSON.stringify({
        knowledgeCreated: 3,
        searchesThisMonth: 12,
        lastActiveAt: new Date().toISOString(),
      }),
    },
  });

  // Seed Collections
  await db.collection.create({
    data: {
      id: 'col_general',
      orgId,
      name: 'General Wiki',
      description: 'General onboarding manuals and operational documentation.',
      ownerId: userId,
      visibility: 'org',
      permissions: JSON.stringify({ inheritFromOrg: true }),
      stats: JSON.stringify({ entryCount: 2 }),
      createdBy: userId,
    },
  });

  await db.collection.create({
    data: {
      id: 'col_infra',
      orgId,
      name: 'Infrastructure & DB',
      description: 'Technical design documents, decision logs, and server architecture specifications.',
      ownerId: userId,
      visibility: 'org',
      permissions: JSON.stringify({ inheritFromOrg: true }),
      stats: JSON.stringify({ entryCount: 1 }),
      createdBy: userId,
    },
  });

  // Seed Knowledge Entries
  const onboardDocId = 'kn_onboard';
  await db.knowledgeEntry.create({
    data: {
      id: onboardDocId,
      orgId,
      title: 'Acme General Onboarding Manual',
      summary: 'Essential guidelines for starting engineering work at Acme Corp. Covers environments, repositories, and workspace setups.',
      body: '<p>Welcome to the Acme team! Your setup should configure a monorepo workspace containing our frontend apps and APIs. Run <code>pnpm dev</code> in the root folder to boot development servers. Code standards mandate TypeScript, strict ESLint limits, and responsive layout wrappers.</p>',
      bodyText: 'Welcome to the Acme team! Your setup should configure a monorepo workspace containing our frontend apps and APIs. Run pnpm dev in the root folder to boot development servers. Code standards mandate TypeScript, strict ESLint limits, and responsive layout wrappers.',
      type: 'article',
      status: 'published',
      visibility: 'org',
      collectionId: 'col_general',
      tags: JSON.stringify(['onboarding', 'wiki', 'setup']),
      aiTags: JSON.stringify(['onboard', 'manual']),
      authorId: userId,
      contributorIds: JSON.stringify([userId]),
      reviewerIds: JSON.stringify([]),
      version: 1,
      versionHistory: JSON.stringify([]),
      metadata: JSON.stringify({}),
      embeddingModel: 'text-embedding-3-large',
      aiConfidence: 0.98,
      healthScore: 98.0,
      viewCount: 12,
      bookmarkCount: 2,
      feedbackPositive: 3,
      feedbackNegative: 0,
    },
  });

  const stripeDocId = 'kn_stripe';
  await db.knowledgeEntry.create({
    data: {
      id: stripeDocId,
      orgId,
      title: 'Stripe Integration Design Log',
      summary: 'A structured decision log detailing Acme billing framework logic. Replaces legacy invoice triggers with Stripe subscription webhooks.',
      body: '<h3>Context</h3><p>Acme plans to migrate Starter/Professional plans to automated seat billing cycles.</p><h3>Options Considered</h3><p>Option A: Custom invoice generators. Option B: Stripe Webhook sync modules.</p><h3>Decision</h3><p>Integrate Stripe webhook event hooks due to robust auto-retry capabilities.</p>',
      bodyText: 'Context: Acme plans to migrate Starter/Professional plans to automated seat billing cycles. Options: Option A: Custom invoice generators. Option B: Stripe Webhook sync modules. Decision: Integrate Stripe webhook event hooks.',
      type: 'decision_log',
      status: 'published',
      visibility: 'org',
      collectionId: 'col_infra',
      tags: JSON.stringify(['billing', 'stripe', 'design_log']),
      aiTags: JSON.stringify(['billing', 'integration']),
      authorId: userId,
      contributorIds: JSON.stringify([userId]),
      reviewerIds: JSON.stringify([]),
      version: 1,
      versionHistory: JSON.stringify([]),
      metadata: JSON.stringify({
        context: 'Automated Billing Migration',
        options: ['Custom invoices', 'Stripe webhook triggers'],
        decision: 'Integrate Stripe hooks',
        outcome: 'Completed implementation, pending QA deployment',
      }),
      embeddingModel: 'text-embedding-3-large',
      aiConfidence: 0.94,
      healthScore: 100.0,
      viewCount: 8,
      bookmarkCount: 1,
      feedbackPositive: 2,
      feedbackNegative: 0,
    },
  });

  // Seed Knowledge Graph Entities
  await db.graphEntity.create({
    data: { id: userId, orgId, entityType: 'person', name: 'Priya Sharma', attributes: JSON.stringify({ role: 'super_admin' }) },
  });

  await db.graphEntity.create({
    data: { id: 'col_general', orgId, entityType: 'topic', name: 'General Wiki' },
  });

  await db.graphEntity.create({
    data: { id: 'col_infra', orgId, entityType: 'topic', name: 'Infrastructure' },
  });

  await db.graphEntity.create({
    data: { id: onboardDocId, orgId, entityType: 'document', name: 'Acme General Onboarding Manual' },
  });

  await db.graphEntity.create({
    data: { id: stripeDocId, orgId, entityType: 'document', name: 'Stripe Integration Design Log' },
  });

  // Seed Graph Relationships
  await db.graphRelationship.create({
    data: { id: 'rel_1', orgId, sourceEntityId: userId, targetEntityId: onboardDocId, relationshipType: 'authored', weight: 1.0 },
  });

  await db.graphRelationship.create({
    data: { id: 'rel_2', orgId, sourceEntityId: userId, targetEntityId: stripeDocId, relationshipType: 'authored', weight: 1.0 },
  });

  await db.graphRelationship.create({
    data: { id: 'rel_3', orgId, sourceEntityId: onboardDocId, targetEntityId: 'col_general', relationshipType: 'related_to', weight: 0.9 },
  });

  await db.graphRelationship.create({
    data: { id: 'rel_4', orgId, sourceEntityId: stripeDocId, targetEntityId: 'col_infra', relationshipType: 'related_to', weight: 0.9 },
  });

  console.info('Seeding finished successfully.');
}

export type { AppRouter } from './router';
export { appRouter } from './router';

app.listen(PORT, async () => {
  console.info(`Server listening on http://localhost:${PORT}`);
  try {
    await seedDatabase();
  } catch (err) {
    console.error('Seeding database failed:', err);
  }
});
