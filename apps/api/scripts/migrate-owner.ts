import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { priorityWeights } from '@nazemni/shared';

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.OWNER_USERNAME ?? process.env.AUTH_USERNAME ?? 'ragheed').trim().toLowerCase();
  const email = (process.env.OWNER_EMAIL ?? 'ragheed@nazemni.online').trim().toLowerCase();
  const passwordHash = process.env.AUTH_PASSWORD_HASH;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { OR: [{ username }, { email }] } });
    const ownerId = existing?.id ?? randomUUID();
    const owner = existing
      ? await tx.user.update({
          where: { id: ownerId },
          data: { email, username, displayUsername: username, name: username, role: 'ADMIN', status: 'ACTIVE' },
        })
      : await tx.user.create({
          data: {
            id: ownerId,
            email,
            username,
            displayUsername: username,
            name: username,
            role: 'ADMIN',
            status: 'ACTIVE',
            preferredLanguage: 'ar',
          },
        });

    const credentialAccount = await tx.account.findUnique({
      where: { providerId_accountId: { providerId: 'credential', accountId: owner.id } },
    });
    if (!credentialAccount) {
      if (!passwordHash?.match(/^\$2[aby]\$\d{2}\$.{53}$/)) {
        throw new Error('AUTH_PASSWORD_HASH must contain the existing bcrypt password hash for the first owner migration');
      }
      await tx.account.create({
        data: { providerId: 'credential', accountId: owner.id, userId: owner.id, password: passwordHash },
      });
    }
    await tx.semester.updateMany({ where: { userId: null }, data: { userId: owner.id } });
    await tx.dailyCheckOut.updateMany({ where: { userId: null }, data: { userId: owner.id } });
    await tx.weeklyReview.updateMany({ where: { userId: null }, data: { userId: owner.id } });
    const settings = await tx.appSettings.findFirst({ where: { userId: null } });
    if (settings) {
      await tx.appSettings.update({ where: { id: settings.id }, data: { userId: owner.id } });
    } else {
      await tx.appSettings.upsert({
        where: { userId: owner.id },
        update: {},
        create: { userId: owner.id, language: 'ar', defaultTarget: 'B+', priorityWeights },
      });
    }
    return {
      owner: { id: owner.id, username: owner.username, email: owner.email, role: owner.role },
      semesters: await tx.semester.count({ where: { userId: owner.id } }),
      enrollments: await tx.semesterCourse.count({ where: { semester: { userId: owner.id } } }),
      studyTasks: await tx.studyTask.count({ where: { course: { semester: { userId: owner.id } } } }),
      unownedSemesters: await tx.semester.count({ where: { userId: null } }),
      unownedCheckouts: await tx.dailyCheckOut.count({ where: { userId: null } }),
      unownedWeeklyReviews: await tx.weeklyReview.count({ where: { userId: null } }),
      unownedSettings: await tx.appSettings.count({ where: { userId: null } }),
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
