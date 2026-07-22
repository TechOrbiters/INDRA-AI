import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  orgSize: z.number().min(1, 'Organization size must be at least 1'),
});

export const SearchQuerySchema = z.object({
  query: z.string().max(500, 'Query exceeds 500 character limit'),
  mode: z.enum(['ai', 'semantic', 'keyword']),
  filters: z.object({
    collections: z.array(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    authors: z.array(z.string()).optional(),
  }).optional(),
});

export const InviteTeamSchema = z.object({
  emails: z.array(z.string().email('Invalid email address')),
  role: z.enum(['super_admin', 'knowledge_admin', 'contributor', 'viewer', 'guest']),
});

export const CollectionCreateSchema = z.object({
  name: z.string().min(2, 'Collection name must be at least 2 characters'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  visibility: z.enum(['org', 'team', 'private']),
});

export const KnowledgeEntryCreateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  summary: z.string().optional(),
  body: z.string().min(1, 'Body is required'),
  type: z.enum(['article', 'decision_log', 'how_to', 'faq', 'reference', 'meeting_note']),
  visibility: z.enum(['org', 'team', 'private']),
  collectionId: z.string(),
  tags: z.array(z.string()).default([]),
  metadata: z.object({
    // decision_log
    context: z.string().optional(),
    options: z.array(z.string()).optional(),
    decision: z.string().optional(),
    outcome: z.string().optional(),
    // how_to
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    estimatedMinutes: z.number().optional(),
    prerequisites: z.array(z.string()).optional(),
    // meeting_note
    meetingDate: z.string().optional(),
    attendees: z.array(z.string()).optional(),
    actionItems: z.array(z.object({
      text: z.string(),
      assigneeId: z.string(),
      dueDate: z.string(),
    })).optional(),
  }).default({}),
});
