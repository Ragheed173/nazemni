import { Router } from 'express';
import { priorityWeights } from '@nazemni/shared';
import { authUser } from '../auth.js';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { checkOutInput, settingsInput } from '../schemas.js';
import { getBacklog, getDailyPlan, getDashboard, getWeeklyReview } from '../services/study.js';

export const planningRouter = Router();
const ok = (data: unknown) => ({ ok: true, data });

planningRouter.get('/dashboard', async (_request, response) => {
  response.json(ok(await getDashboard(authUser(response).id)));
});
planningRouter.get('/daily-plan', async (_request, response) => {
  response.json(ok(await getDailyPlan(authUser(response).id)));
});
planningRouter.get('/backlog', async (_request, response) => {
  response.json(ok(await getBacklog(authUser(response).id)));
});
planningRouter.get('/weekly-review', async (_request, response) => {
  response.json(ok(await getWeeklyReview(authUser(response).id)));
});

planningRouter.post('/daily-checkouts', async (request, response) => {
  const userId = authUser(response).id;
  const input = checkOutInput.parse(request.body);
  const requestedTaskIds = [...new Set([
    ...input.completedTaskIds,
    ...input.inProgressTaskIds,
    ...input.deferredTaskIds,
  ])];
  const result = await prisma.$transaction(async (tx) => {
    const ownedTasks = requestedTaskIds.length
      ? await tx.studyTask.findMany({
          where: { id: { in: requestedTaskIds }, course: { semester: { userId } } },
          select: { id: true, lectureId: true, courseId: true },
        })
      : [];
    if (ownedTasks.length !== requestedTaskIds.length) throw new AppError(404, 'Resource not found');
    if (input.courseId) {
      const ownedCourse = await tx.semesterCourse.count({ where: { id: input.courseId, semester: { userId } } });
      if (!ownedCourse) throw new AppError(404, 'Resource not found');
    }

    if (input.completedTaskIds.length) {
      const completedTasks = ownedTasks.filter((task) => input.completedTaskIds.includes(task.id));
      await tx.studyTask.updateMany({
        where: { id: { in: input.completedTaskIds }, course: { semester: { userId } } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      for (const task of completedTasks) {
        await tx.semesterCourse.updateMany({ where: { id: task.courseId, semester: { userId } }, data: { lastStudyAt: new Date() } });
        if (task.lectureId) {
          await tx.lecture.updateMany({
            where: { id: task.lectureId, course: { semester: { userId } } },
            data: { state: 'STUDIED', studiedAt: new Date() },
          });
        }
      }
    }
    if (input.inProgressTaskIds.length) {
      await tx.studyTask.updateMany({
        where: { id: { in: input.inProgressTaskIds }, course: { semester: { userId } } },
        data: { status: 'IN_PROGRESS' },
      });
    }
    for (const id of input.deferredTaskIds) {
      await tx.studyTask.updateMany({
        where: { id, course: { semester: { userId } } },
        data: { status: 'DEFERRED', deferredCount: { increment: 1 } },
      });
    }
    if (input.courseId && input.misunderstoodTopics.length) {
      for (const name of input.misunderstoodTopics) {
        const topic = await tx.weakTopic.create({
          data: { courseId: input.courseId, topic: name, severity: 'MEDIUM', notes: 'Recorded during daily check-out' },
        });
        await tx.review.create({
          data: {
            courseId: input.courseId,
            weakTopicId: topic.id,
            type: 'WEAK_TOPIC_REVIEW',
            scheduledAt: new Date(Date.now() + 3 * 86_400_000),
          },
        });
      }
    }
    return tx.dailyCheckOut.upsert({
      where: { userId_date: { userId, date: input.date } },
      update: {
        stoppedAt: input.stoppedAt,
        misunderstoodTopics: input.misunderstoodTopics,
        notes: input.notes,
        selfRating: input.selfRating,
      },
      create: {
        userId,
        date: input.date,
        stoppedAt: input.stoppedAt,
        misunderstoodTopics: input.misunderstoodTopics,
        notes: input.notes,
        selfRating: input.selfRating,
      },
    });
  });
  response.status(201).json(ok(result));
});

planningRouter.get('/settings', async (_request, response) => {
  const user = authUser(response);
  const settings = await prisma.appSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, language: user.preferredLanguage, priorityWeights },
  });
  response.json(ok(settings));
});

planningRouter.patch('/settings', async (request, response) => {
  const userId = authUser(response).id;
  const input = settingsInput.parse(request.body);
  const settings = await prisma.appSettings.update({ where: { userId }, data: input });
  if (input.language) await prisma.user.update({ where: { id: userId }, data: { preferredLanguage: input.language } });
  response.json(ok(settings));
});
