import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { priorityWeights } from '@nazemni/shared';
import {
  authUser,
  generateInviteCode,
  inviteCodeHash,
  registrationInput,
  requireAdmin,
  type RegistrationMode,
} from '../auth.js';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';

const ok = (data: unknown) => ({ ok: true, data });

export function createPublicAccountRouter(registrationMode: RegistrationMode) {
  const router = Router();
  const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.get('/registration', (_request, response) => {
    response.json(ok({ mode: registrationMode }));
  });

  router.post('/register', registrationLimiter, async (request, response, next) => {
    try {
      if (registrationMode === 'CLOSED') throw new AppError(403, 'Registration is closed');
      const input = registrationInput.parse(request.body);
      const passwordHash = await bcrypt.hash(input.password, 12);
      const now = new Date();
      const user = await prisma.$transaction(async (tx) => {
        if (registrationMode === 'INVITE_ONLY') {
          if (!input.inviteCode) throw new AppError(400, 'A valid invite code is required');
          const invite = await tx.inviteCode.findUnique({
            where: { codeHash: inviteCodeHash(input.inviteCode) },
          });
          if (!invite || !invite.active || (invite.expiresAt && invite.expiresAt <= now)
            || (invite.maxUses !== null && invite.currentUses >= invite.maxUses)) {
            throw new AppError(400, 'A valid invite code is required');
          }
          const reserved = await tx.inviteCode.updateMany({
            where: { id: invite.id, active: true, currentUses: invite.currentUses },
            data: { currentUses: { increment: 1 } },
          });
          if (reserved.count !== 1) throw new AppError(409, 'Please retry registration');
        }

        const newUserId = randomUUID();
        const created = await tx.user.create({
          data: {
            id: newUserId,
            email: input.email,
            username: input.username,
            displayUsername: input.displayName,
            name: input.displayName,
            preferredLanguage: input.preferredLanguage,
            accounts: {
              create: {
                accountId: newUserId,
                providerId: 'credential',
                password: passwordHash,
              },
            },
            settings: {
              create: {
                language: input.preferredLanguage,
                defaultTarget: 'B+',
                priorityWeights,
              },
            },
          },
          select: { id: true, email: true, username: true, name: true },
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      request.log.info({ event: 'account_created', userId: user.id }, 'Account created');
      response.status(201).json(ok(user));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        request.log.warn({ event: 'registration_conflict' }, 'Registration rejected');
        next(new AppError(409, 'Unable to create account with these details'));
        return;
      }
      next(error);
    }
  });

  return router;
}

export function createAccountRouter() {
  const router = Router();

  router.get('/profile', (_request, response) => {
    const user = authUser(response);
    response.json(ok({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.name,
      preferredLanguage: user.preferredLanguage,
      role: user.role,
      createdAt: user.createdAt,
    }));
  });

  router.patch('/profile', async (request, response) => {
    const user = authUser(response);
    const input = z.object({
      displayName: z.string().trim().min(2).max(100).optional(),
      preferredLanguage: z.enum(['ar', 'en']).optional(),
    }).parse(request.body);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: input.displayName, displayUsername: input.displayName, preferredLanguage: input.preferredLanguage },
      select: { email: true, username: true, name: true, preferredLanguage: true, role: true, createdAt: true },
    });
    if (input.preferredLanguage) {
      await prisma.appSettings.updateMany({ where: { userId: user.id }, data: { language: input.preferredLanguage } });
    }
    response.json(ok({ ...updated, displayName: updated.name }));
  });

  router.post('/change-password', async (request, response) => {
    const user = authUser(response);
    const input = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(10).max(128),
      confirmation: z.string().min(10).max(128),
    }).refine((value) => value.newPassword === value.confirmation, {
      path: ['confirmation'], message: 'Passwords do not match',
    }).parse(request.body);
    const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (!account?.password || !(await bcrypt.compare(input.currentPassword, account.password))) {
      throw new AppError(400, 'Current password is incorrect');
    }
    const password = await bcrypt.hash(input.newPassword, 12);
    const currentSessionId = (response.locals.authSession as { id?: string } | undefined)?.id;
    await prisma.$transaction([
      prisma.account.update({ where: { id: account.id }, data: { password } }),
      prisma.session.deleteMany({
        where: { userId: user.id, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
      }),
    ]);
    request.log.info({ event: 'password_changed', userId: user.id }, 'Password changed');
    response.json(ok(null));
  });

  router.post('/logout-all', async (request, response) => {
    const user = authUser(response);
    await prisma.session.deleteMany({ where: { userId: user.id } });
    request.log.info({ event: 'sessions_revoked', userId: user.id }, 'All sessions revoked');
    response.json(ok(null));
  });

  router.delete('/', async (request, response) => {
    const user = authUser(response);
    const input = z.object({
      password: z.string().min(1).max(128),
      confirmation: z.literal('DELETE'),
    }).parse(request.body);
    const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (!account?.password || !(await bcrypt.compare(input.password, account.password))) {
      throw new AppError(400, 'Password confirmation failed');
    }
    await prisma.$transaction(async (tx) => {
      await tx.semesterCourse.deleteMany({ where: { semester: { userId: user.id } } });
      await tx.semester.deleteMany({ where: { userId: user.id } });
      await tx.course.deleteMany({ where: { ownerId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
    request.log.info({ event: 'account_deleted', userId: user.id }, 'Account deleted');
    response.json(ok(null));
  });

  return router;
}

export function createAdminRouter(registrationMode: RegistrationMode) {
  const router = Router();
  router.use(requireAdmin);

  router.get('/summary', async (request, response) => {
    const take = z.coerce.number().int().min(1).max(100).catch(25).parse(request.query.take);
    const cursor = z.string().optional().parse(request.query.cursor);
    const [totalUsers, activeUsers, disabledUsers, invites, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'DISABLED' } }),
      prisma.inviteCode.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.user.findMany({
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: take + 1,
        orderBy: { id: 'asc' },
        select: { id: true, email: true, username: true, name: true, role: true, status: true, createdAt: true, lastLoginAt: true },
      }),
    ]);
    const hasMore = users.length > take;
    const page = hasMore ? users.slice(0, take) : users;
    response.json(ok({
      totalUsers, activeUsers, disabledUsers, registrationMode, invites,
      users: page,
      nextCursor: hasMore ? page.at(-1)?.id : null,
    }));
  });

  router.post('/invites', async (request, response) => {
    const admin = authUser(response);
    const input = z.object({
      maxUses: z.coerce.number().int().min(1).max(10_000).optional().nullable(),
      expiresAt: z.coerce.date().optional().nullable(),
    }).parse(request.body);
    const code = generateInviteCode();
    const invite = await prisma.inviteCode.create({
      data: {
        codeHash: inviteCodeHash(code),
        codePreview: code.slice(-6),
        maxUses: input.maxUses,
        expiresAt: input.expiresAt,
        createdById: admin.id,
      },
    });
    request.log.info({ event: 'invite_created', adminId: admin.id, inviteId: invite.id }, 'Invite created');
    response.status(201).json(ok({ ...invite, code }));
  });

  router.post('/invites/:id/revoke', async (request, response) => {
    const admin = authUser(response);
    const result = await prisma.inviteCode.updateMany({ where: { id: request.params.id }, data: { active: false } });
    if (!result.count) throw new AppError(404, 'Resource not found');
    request.log.info({ event: 'invite_revoked', adminId: admin.id, inviteId: request.params.id }, 'Invite revoked');
    response.json(ok(null));
  });

  router.patch('/users/:id/status', async (request, response) => {
    const admin = authUser(response);
    const input = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) }).parse(request.body);
    if (admin.id === request.params.id && input.status === 'DISABLED') {
      throw new AppError(400, 'You cannot disable your own account');
    }
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: request.params.id },
        data: { status: input.status },
        select: { id: true, email: true, username: true, role: true, status: true },
      });
      if (input.status === 'DISABLED') await tx.session.deleteMany({ where: { userId: updated.id } });
      return updated;
    });
    request.log.info({ event: 'user_status_changed', adminId: admin.id, userId: user.id, status: user.status }, 'User status changed');
    response.json(ok(user));
  });

  return router;
}
