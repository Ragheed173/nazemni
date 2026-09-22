import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import type { CatalogEntryView, CourseSource, ExtractedCourse } from './types.js';

export interface CourseCatalogRepository {
  findFresh(universityNormalized: string, programNormalized: string, queryCode: string, queryText: string, staleAfter: Date): Promise<CatalogEntryView | null>;
  findById(id: string): Promise<CatalogEntryView | null>;
  save(input: {
    university: string;
    universityNormalized: string;
    program: string;
    programNormalized: string;
    extracted: NonNullable<ExtractedCourse['course']>;
    status: 'VERIFIED' | 'PARTIAL' | 'NOT_VERIFIED';
    officialUrl: string | null;
    sources: CourseSource[];
    checkedAt: Date;
  }): Promise<CatalogEntryView>;
}

const includeSources = {
  sources: { orderBy: [{ isOfficial: 'desc' as const }, { retrievedAt: 'desc' as const }] },
} satisfies Prisma.CourseCatalogEntryInclude;

export class PrismaCourseCatalogRepository implements CourseCatalogRepository {
  async findFresh(universityNormalized: string, programNormalized: string, queryCode: string, queryText: string, staleAfter: Date) {
    return prisma.courseCatalogEntry.findFirst({
      where: {
        universityNormalized,
        programNormalized,
        lastVerifiedAt: { gte: staleAfter },
        OR: [{ courseCodeNormalized: queryCode }, { courseName: { contains: queryText, mode: 'insensitive' } }],
      },
      include: includeSources,
      orderBy: { lastVerifiedAt: 'desc' },
    }) as Promise<CatalogEntryView | null>;
  }

  async findById(id: string) {
    return prisma.courseCatalogEntry.findUnique({ where: { id }, include: includeSources }) as Promise<CatalogEntryView | null>;
  }

  async save(input: Parameters<CourseCatalogRepository['save']>[0]) {
    const courseCodeNormalized = normalizeCourseCode(input.extracted.courseCode);
    const data = {
      university: input.university,
      universityNormalized: input.universityNormalized,
      program: input.program,
      programNormalized: input.programNormalized,
      courseCode: input.extracted.courseCode,
      courseCodeNormalized,
      courseName: input.extracted.courseName,
      credits: input.extracted.credits,
      description: input.extracted.description,
      prerequisites: input.extracted.prerequisites,
      topics: input.extracted.topics,
      assessmentInfo: input.extracted.assessmentInfo,
      officialUrl: input.officialUrl,
      status: input.status,
      confidence: input.extracted.confidence,
      lastVerifiedAt: input.checkedAt,
    } satisfies Prisma.CourseCatalogEntryUncheckedCreateInput;
    return prisma.$transaction(async (tx) => {
      const entry = await tx.courseCatalogEntry.upsert({
        where: { universityNormalized_programNormalized_courseCodeNormalized: {
          universityNormalized: input.universityNormalized,
          programNormalized: input.programNormalized,
          courseCodeNormalized,
        } },
        create: data,
        update: data,
      });
      await tx.courseCatalogSource.deleteMany({ where: { entryId: entry.id } });
      if (input.sources.length) {
        await tx.courseCatalogSource.createMany({ data: input.sources.map((source) => ({
          entryId: entry.id,
          url: source.url,
          title: source.title,
          excerpt: source.excerpt || null,
          sourceType: source.sourceType,
          isOfficial: source.isOfficial,
          retrievedAt: input.checkedAt,
        })) });
      }
      return tx.courseCatalogEntry.findUniqueOrThrow({ where: { id: entry.id }, include: includeSources }) as unknown as CatalogEntryView;
    });
  }
}

export function normalizeText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function normalizeCourseCode(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
