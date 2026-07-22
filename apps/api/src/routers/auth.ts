import { router, publicProcedure, protectedProcedure } from '../trpc';
import { SignupSchema, LoginSchema } from '@indra-ai/shared';
import { TRPCError } from '@trpc/server';
import { db } from '../services/database';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'indra_ai_secret_key_123';

export const authRouter = router({
  signup: publicProcedure
    .input(SignupSchema)
    .mutation(async ({ input }) => {
      // Check if user exists
      const existingUser = await db.user.findFirst({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A user with this email address already exists.',
        });
      }

      // Create organization
      const orgId = `org_${Math.random().toString(36).substring(2, 11)}`;
      let orgSlug = input.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      const existingOrgWithSlug = await db.organization.findUnique({
        where: { slug: orgSlug },
      });
      if (existingOrgWithSlug) {
        orgSlug = `${orgSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }
      
      const org = await db.organization.create({
        data: {
          id: orgId,
          name: input.orgName,
          domain: input.email.split('@')[1] || 'generic.com',
          slug: orgSlug,
          plan: 'starter',
          seatCount: 50,
          activeSeatCount: 1,
          settings: JSON.stringify({
            ssoEnabled: false,
            defaultRole: 'contributor',
            allowPublicSignup: false,
            dataResidency: 'us',
            retentionDays: 365,
          }),
          billing: JSON.stringify({
            stripeCustomerId: '',
            stripeSubscriptionId: '',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }),
          stats: JSON.stringify({
            knowledgeCount: 0,
            userCount: 1,
            searchesToday: 0,
            storageBytes: 0,
          }),
        },
      });

      // Create user (first user is super_admin)
      const userId = `usr_${Math.random().toString(36).substring(2, 11)}`;
      const user = await db.user.create({
        data: {
          id: userId,
          orgId: org.id,
          email: input.email,
          displayName: input.email.split('@')[0],
          role: 'super_admin',
          status: 'active',
          expertise: JSON.stringify([]),
          departments: JSON.stringify([]),
          preferences: JSON.stringify({
            theme: 'light',
            emailDigest: 'never',
            searchMode: 'ai',
            language: 'en',
          }),
          collectionPermissions: JSON.stringify({}),
          stats: JSON.stringify({
            knowledgeCreated: 0,
            searchesThisMonth: 0,
            lastActiveAt: new Date().toISOString(),
          }),
        },
      });

      // Create default collection for the new organization
      await db.collection.create({
        data: {
          id: `col_general_${org.id}`,
          orgId: org.id,
          name: 'General Wiki',
          description: 'General onboarding manuals and operational documentation.',
          ownerId: user.id,
          visibility: 'org',
          permissions: JSON.stringify({
            inheritFromOrg: true,
            explicit: {},
            teams: {},
          }),
          stats: JSON.stringify({
            entryCount: 0,
            viewsLast30Days: 0,
            healthScore: 100.0,
          }),
          createdBy: user.id,
        },
      });

      // Create Graph Entity representing the collection
      try {
        await db.graphEntity.create({
          data: {
            id: `col_general_${org.id}`,
            orgId: org.id,
            entityType: 'topic',
            name: 'General Wiki',
            attributes: JSON.stringify({
              description: 'General onboarding manuals and operational documentation.',
            }),
          },
        });
      } catch {
        // Non-fatal
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, orgId: user.orgId, role: user.role, email: user.email, displayName: user.displayName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
        organization: org,
      };
    }),

  login: publicProcedure
    .input(LoginSchema)
    .mutation(async ({ input }) => {
      const user = await db.user.findFirst({
        where: { email: input.email },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid email or password.',
        });
      }

      // Simple password check simulator (in real app, use bcryptjs or Firebase Auth)
      // Since it's a dev database, we accept the login if the email matches
      const org = await db.organization.findUnique({
        where: { id: user.orgId },
      });

      const token = jwt.sign(
        { id: user.id, orgId: user.orgId, role: user.role, email: user.email, displayName: user.displayName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
        organization: org,
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User session not found.',
      });
    }

    const org = await db.organization.findUnique({
      where: { id: user.orgId },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        expertise: JSON.parse(user.expertise),
        departments: JSON.parse(user.departments),
        preferences: JSON.parse(user.preferences),
        collectionPermissions: JSON.parse(user.collectionPermissions),
      },
      organization: org ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        settings: JSON.parse(org.settings),
        billing: JSON.parse(org.billing),
        stats: JSON.parse(org.stats),
      } : null,
    };
  }),

  samlInit: publicProcedure
    .input(z.object({ orgDomain: z.string() }))
    .mutation(async ({ input }) => {
      const org = await db.organization.findFirst({
        where: { domain: input.orgDomain },
      });

      const redirectUrl = `https://sso.indraai.com/saml/sso?orgDomain=${encodeURIComponent(input.orgDomain)}&SAMLRequest=fVLLb9swDP4vBPEd2ZZs...`;

      return {
        redirectUrl,
        orgFound: !!org,
        domain: input.orgDomain,
      };
    }),

  googleAuth: publicProcedure
    .input(z.object({
      email: z.string().email(),
      displayName: z.string().optional(),
      uid: z.string()
    }))
    .mutation(async ({ input }) => {
      let user = await db.user.findFirst({
        where: { email: input.email },
      });

      let org;
      if (!user) {
        const domain = input.email.split('@')[1] || 'google.com';
        
        // Check if organization already exists for this domain
        org = await db.organization.findFirst({
          where: { domain },
        });

        let isNewOrg = false;
        if (!org) {
          isNewOrg = true;
          const orgId = `org_${Math.random().toString(36).substring(2, 11)}`;
          const orgName = domain.split('.')[0].toUpperCase() + ' Corp';
          let orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-');

          // Resolve slug conflicts
          const existingOrgWithSlug = await db.organization.findUnique({
            where: { slug: orgSlug },
          });
          if (existingOrgWithSlug) {
            orgSlug = `${orgSlug}-${Math.random().toString(36).substring(2, 6)}`;
          }

          org = await db.organization.create({
            data: {
              id: orgId,
              name: orgName,
              domain: domain,
              slug: orgSlug,
              plan: 'starter',
              seatCount: 50,
              activeSeatCount: 1,
              settings: JSON.stringify({
                ssoEnabled: false,
                defaultRole: 'contributor',
                allowPublicSignup: false,
                dataResidency: 'us',
                retentionDays: 365,
              }),
              billing: JSON.stringify({
                stripeCustomerId: '',
                stripeSubscriptionId: '',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              }),
              stats: JSON.stringify({
                knowledgeCount: 0,
                userCount: 1,
                searchesToday: 0,
                storageBytes: 0,
              }),
            },
          });
        }

        const role = isNewOrg ? 'super_admin' : 'contributor';
        const userId = `usr_${Math.random().toString(36).substring(2, 11)}`;
        user = await db.user.create({
          data: {
            id: userId,
            orgId: org.id,
            email: input.email,
            displayName: input.displayName || input.email.split('@')[0],
            role: role,
            status: 'active',
            expertise: JSON.stringify([]),
            departments: JSON.stringify([]),
            preferences: JSON.stringify({
              theme: 'light',
              emailDigest: 'never',
              searchMode: 'ai',
              language: 'en',
            }),
            collectionPermissions: JSON.stringify({}),
            stats: JSON.stringify({
              knowledgeCreated: 0,
              searchesThisMonth: 0,
              lastActiveAt: new Date().toISOString(),
            }),
          },
        });

        if (isNewOrg) {
          // Create default collection for the new organization
          await db.collection.create({
            data: {
              id: `col_general_${org.id}`,
              orgId: org.id,
              name: 'General Wiki',
              description: 'General onboarding manuals and operational documentation.',
              ownerId: user.id,
              visibility: 'org',
              permissions: JSON.stringify({
                inheritFromOrg: true,
                explicit: {},
                teams: {},
              }),
              stats: JSON.stringify({
                entryCount: 0,
                viewsLast30Days: 0,
                healthScore: 100.0,
              }),
              createdBy: user.id,
            },
          });

          // Create Graph Entity representing the collection
          try {
            await db.graphEntity.create({
              data: {
                id: `col_general_${org.id}`,
                orgId: org.id,
                entityType: 'topic',
                name: 'General Wiki',
                attributes: JSON.stringify({
                  description: 'General onboarding manuals and operational documentation.',
                }),
              },
            });
          } catch {
            // Non-fatal
          }
        }
      } else {
        org = await db.organization.findUnique({
          where: { id: user.orgId },
        });
      }

      const token = jwt.sign(
        { id: user.id, orgId: user.orgId, role: user.role, email: user.email, displayName: user.displayName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
        organization: org,
      };
    }),

  resetPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await db.user.findFirst({
        where: { email: input.email },
      });
      if (user) {
        console.info(`[auth] Simulated password reset link generated for ${input.email}`);
      } else {
        console.warn(`[auth] Password reset requested for non-existent email: ${input.email}`);
      }
      return { success: true };
    }),

  verifyMfa: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.user.findFirst({
        where: { email: input.email },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User session not found.',
        });
      }

      if (input.code !== '123456' && !/^\d{6}$/.test(input.code)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired MFA code.',
        });
      }

      const org = await db.organization.findUnique({
        where: { id: user.orgId },
      });

      const token = jwt.sign(
        { id: user.id, orgId: user.orgId, role: user.role, email: user.email, displayName: user.displayName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
        organization: org,
      };
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({
      onboardingData: z.object({
        step1: z.object({
          orgName: z.string().min(2),
          industry: z.string().optional(),
          size: z.union([z.string(), z.number()]).optional(),
          domain: z.string().optional(),
        }).optional(),
        step2: z.object({
          invites: z.array(z.object({
            email: z.string().email(),
            role: z.string(),
          })).optional(),
        }).optional(),
        step3: z.object({
          integrations: z.array(z.string()).optional(),
        }).optional(),
        step4: z.object({
          permissions: z.record(z.boolean()).optional(),
        }).optional(),
      })
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      
      const org = await db.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organization not found.',
        });
      }

      const step1 = input.onboardingData.step1;
      const step2 = input.onboardingData.step2;
      const step3 = input.onboardingData.step3;
      const step4 = input.onboardingData.step4;

      const currentSettings = JSON.parse(org.settings || '{}');
      const updatedSettings = {
        ...currentSettings,
        ...(step1?.industry ? { industry: step1.industry } : {}),
        ...(step1?.size ? { size: step1.size } : {}),
        ...(step4?.permissions ? { ...step4.permissions } : {}),
      };

      await db.organization.update({
        where: { id: orgId },
        data: {
          ...(step1?.orgName ? { name: step1.orgName } : {}),
          ...(step1?.domain ? { domain: step1.domain } : {}),
          settings: JSON.stringify(updatedSettings),
        },
      });

      if (step2?.invites && step2.invites.length > 0) {
        for (const invite of step2.invites) {
          const existing = await db.user.findFirst({
            where: { email: invite.email },
          });

          if (!existing) {
            const inviteUserId = `usr_${Math.random().toString(36).substring(2, 11)}`;
            
            let dbRole = 'contributor';
            if (invite.role === 'Admin' || invite.role === 'Knowledge Manager') {
              dbRole = 'knowledge_admin';
            } else if (invite.role === 'Viewer') {
              dbRole = 'viewer';
            }

            await db.user.create({
              data: {
                id: inviteUserId,
                orgId,
                email: invite.email,
                displayName: invite.email.split('@')[0],
                role: dbRole,
                status: 'invited',
                expertise: JSON.stringify([]),
                departments: JSON.stringify([]),
                preferences: JSON.stringify({
                  theme: 'dark',
                  emailDigest: 'never',
                  searchMode: 'ai',
                  language: 'en',
                }),
                collectionPermissions: JSON.stringify({}),
                stats: JSON.stringify({
                  knowledgeCreated: 0,
                  searchesThisMonth: 0,
                  lastActiveAt: new Date().toISOString(),
                }),
                invitedBy: ctx.user.id,
                invitedAt: new Date(),
              },
            });

            await db.auditEvent.create({
              data: {
                id: `evt_${Math.random().toString(36).substring(2, 11)}`,
                orgId,
                actorId: ctx.user.id,
                actorIp: '127.0.0.1',
                actorUserAgent: 'tRPC Client',
                action: 'user.invited',
                resourceType: 'user',
                resourceId: inviteUserId,
                after: JSON.stringify({ email: invite.email, role: dbRole }),
              },
            });
          }
        }
      }

      if (step3?.integrations && step3.integrations.length > 0) {
        for (const provider of step3.integrations) {
          const integrationId = `int_${provider}_${Math.random().toString(36).substring(2, 6)}`;
          await db.integration.create({
            data: {
              id: integrationId,
              orgId,
              provider,
              status: 'active',
              credentials: JSON.stringify({ accessToken: 'mock_token_abc123' }),
              config: JSON.stringify({ syncFrequencyMinutes: 60 }),
              stats: JSON.stringify({
                documentsIngested: 0,
                lastSyncStatus: 'success',
              }),
              connectedBy: ctx.user.id,
            },
          });
        }
      }

      return { success: true };
    }),
});
