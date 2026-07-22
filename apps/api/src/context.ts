/**
 * tRPC Request Context — INDRA AI (PRD §2.4 — Authentication & Authorization)
 *
 * Token resolution priority:
 *  1. Firebase ID Token (from Google Sign-In via Firebase Auth)
 *  2. INDRA AI JWT (from credential sign-up / email+password login)
 *  3. Mock token (format: mock-{userId}:{orgId}:{role}:{email}:{displayName}) — DEV ONLY
 *
 * RBAC roles (§2.4):
 *  super_admin | knowledge_admin | contributor | viewer | guest
 */

import { inferAsyncReturnType } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './services/database';

const JWT_SECRET = process.env.JWT_SECRET || 'indra_ai_secret_key_123';

// Firebase Admin — lazy initialization to avoid hard crash if credentials missing
let firebaseAdmin: typeof import('firebase-admin') | null = null;
let firebaseApp: import('firebase-admin').app.App | null = null;

function getFirebaseAdmin() {
  if (firebaseApp) return firebaseAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (
    !projectId ||
    !clientEmail ||
    !privateKey ||
    clientEmail.includes('xxxx') ||
    privateKey.includes('...')
  ) {
    return null; // Firebase Admin not configured — fall through to JWT
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    firebaseAdmin = require('firebase-admin') as typeof import('firebase-admin');
    if (firebaseAdmin.apps.length === 0) {
      firebaseApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      firebaseApp = firebaseAdmin.apps[0] ?? null;
    }
    return firebaseAdmin;
  } catch (err) {
    console.warn('[auth] Firebase Admin init failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface UserContext {
  id: string;
  orgId: string;
  role: 'super_admin' | 'knowledge_admin' | 'contributor' | 'viewer' | 'guest';
  email: string;
  displayName: string;
  firebaseUid?: string;
}

export interface AppContext {
  req: Request;
  res: Response;
  user: UserContext | null;
  actorIp: string;
  actorUserAgent: string;
}

// ---------------------------------------------------------------------------
// createContext — called per-request
// ---------------------------------------------------------------------------

export async function createContext({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Promise<AppContext> {
  let user: UserContext | null = null;
  const authHeader = req.headers.authorization;
  const actorIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    '127.0.0.1';
  const actorUserAgent = req.headers['user-agent'] || 'Unknown';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // ── Priority 3: Mock token (DEV only) ──────────────────────────────────
    if (token.startsWith('mock-')) {
      const parts = token.substring(5).split(':');
      user = {
        id: parts[0] || 'usr_mock_123',
        orgId: parts[1] || 'org_mock_123',
        role: (parts[2] as UserContext['role']) || 'contributor',
        email: parts[3] || 'mock@indraai.com',
        displayName: parts[4] || 'Mock User',
      };
    } else {
      // ── Priority 1: Firebase ID Token ────────────────────────────────────
      const admin = getFirebaseAdmin();
      if (admin) {
        try {
          const decoded = await admin.auth().verifyIdToken(token);
          // Look up user in our DB by Firebase UID (stored as User.id)
          const dbUser = await db.user.findFirst({
            where: { id: decoded.uid },
          });

          if (dbUser) {
            user = {
              id: dbUser.id,
              orgId: dbUser.orgId,
              role: dbUser.role as UserContext['role'],
              email: dbUser.email,
              displayName: dbUser.displayName,
              firebaseUid: decoded.uid,
            };
          } else {
            // Firebase token is valid but user not yet in DB — return minimal context
            // (googleAuth procedure will create the user record)
            user = {
              id: decoded.uid,
              orgId: '',
              role: 'viewer',
              email: decoded.email || '',
              displayName: decoded.name || decoded.email?.split('@')[0] || 'User',
              firebaseUid: decoded.uid,
            };
          }
        } catch {
          // Firebase token invalid — fall through to JWT check
        }
      }

      // ── Priority 2: INDRA AI JWT ────────────────────────────────────────
      if (!user) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as Record<string, string>;
          user = {
            id: decoded['id'],
            orgId: decoded['orgId'],
            role: decoded['role'] as UserContext['role'],
            email: decoded['email'],
            displayName: decoded['displayName'] || decoded['email']?.split('@')[0] || 'User',
          };
        } catch {
          // Token invalid — user stays null → 401 on protected procedures
        }
      }
    }
  }

  return { req, res, user, actorIp, actorUserAgent };
}

export type Context = inferAsyncReturnType<typeof createContext>;
