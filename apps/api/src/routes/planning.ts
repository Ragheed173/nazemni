import { Router } from 'express';
import { prisma } from '../db.js';
import { checkOutInput, settingsInput } from '../schemas.js';
import { getBacklog, getDailyPlan, getDashboard, getWeeklyReview } from '../services/study.js';

export const planningRouter = Router();
const ok = (data: unknown) => ({ ok: true, data });

planningRouter.get('/dashboard', async (_req, res) => res.json(ok(await getDashboard())));
planningRouter.get('/daily-plan', async (_req, res) => res.json(ok(await getDailyPlan())));
planningRouter.get('/backlog', async (_req, res) => res.json(ok(await getBacklog())));
planningRouter.get('/weekly-review', async (_req, res) => res.json(ok(await getWeeklyReview())));

planningRouter.post('/daily-checkouts', async (req, res) => {
  const input = checkOutInput.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    if (input.completedTaskIds.length) {
      const completedTasks = await tx.studyTask.findMany({
        where: { id: { in: input.completedTaskIds } },
        select: { lectureId: true, courseId: true },
      });
      await tx.studyTask.updateMany({
        where: { id: { in: input.completedTaskIds } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      for (const task of completedTasks) {
        await tx.course.update({ where: { id: task.courseId }, data: { lastStudyAt: new Date() } });
        if (task.lectureId) {
          await tx.lecture.update({
            where: { id: task.lectureId },
            data: { state: 'STUDIED', studiedAt: new Date() },
          });
        }
      }
    }
    if (input.inProgressTaskIds.length) {
      await tx.studyTask.updateMany({
        where: { id: { in: input.inProgressTaskIds } },
        data: { status: 'IN_PROGRESS' },
      });
    }
    for (const id of input.deferredTaskIds) {
      await tx.studyTask.update({
        where: { id },
        data: { status: 'DEFERRED', deferredCount: { increment: 1 } },
      });
    }
    if (input.courseId && input.misunderstoodTopics.length) {
      for (const name of input.misunderstoodTopics) {
        const topic = await tx.weakTopic.create({
          data: {
          courseId: input.courseId!,
          topic: name,
          severity: 'MEDIUM',
          notes: 'Recorded during daily check-out',
          },
        });
        await tx.review.create({
          data: {
            courseId: input.courseId!,
            weakTopicId: topic.id,
            type: 'WEAK_TOPIC_REVIEW',
            scheduledAt: new Date(Date.now() + 3 * 86_400_000),
          },
        });
      }
    }
    return tx.dailyCheckOut.upsert({
      where: { date: input.date },
      update: {
        stoppedAt: input.stoppedAt,
        misunderstoodTopics: input.misunderstoodTopics,
        notes: input.notes,
        selfRating: input.selfRating,
      },
      create: {
        date: input.date,
        stoppedAt: input.stoppedAt,
        misunderstoodTopics: input.misunderstoodTopics,
        notes: input.notes,
        selfRating: input.selfRating,
      },
    });
  });
  res.status(201).json(ok(result));
});

planningRouter.get('/settings', async (_req, res) => {
  res.json(ok(await prisma.appSettings.findUniqueOrThrow({ where: { id: 'settings' } })));
});

planningRouter.patch('/settings', async (req, res) => {
  const input = settingsInput.parse(req.body);
  res.json(ok(await prisma.appSettings.update({ where: { id: 'settings' }, data: input })));
});
