import { AppError } from '../errors.js';
import { relevantExcerpt, safeFetchSource, sourceToText } from './fetch.js';
import { normalizeCourseCode, normalizeText, type CourseCatalogRepository } from './repository.js';
import type { CourseExtractor } from './extract.js';
import type { CourseSearchProvider } from './search.js';
import type { CatalogEntryView, CourseIntelligenceRuntimeConfig, CourseSource, CourseSourceType, SearchResult } from './types.js';

type Dependencies = {
  search: CourseSearchProvider;
  extractor: CourseExtractor;
  repository: CourseCatalogRepository;
  fetchSource?: typeof safeFetchSource;
  now?: () => Date;
};

export type LookupResult =
  | { outcome: 'FOUND'; cached: boolean; entry: CatalogEntryView }
  | { outcome: 'AMBIGUOUS'; cached: false; alternatives: Array<{ courseCode: string; courseName: string }> }
  | { outcome: 'NOT_VERIFIED'; cached: false; alternatives: Array<{ courseCode: string; courseName: string }> };

export class CourseIntelligenceService {
  private readonly now: () => Date;
  private readonly fetchSource: typeof safeFetchSource;

  constructor(private readonly config: CourseIntelligenceRuntimeConfig, private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.fetchSource = dependencies.fetchSource ?? safeFetchSource;
  }

  async lookup(input: { university: string; program: string; query: string; refresh?: boolean }): Promise<LookupResult> {
    const universityNormalized = normalizeText(input.university);
    const programNormalized = normalizeText(input.program);
    const queryCode = normalizeCourseCode(input.query);
    const queryText = normalizeText(input.query);
    const checkedAt = this.now();
    if (!input.refresh) {
      const staleAfter = new Date(checkedAt.getTime() - this.config.cacheDays * 86_400_000);
      const cached = await this.dependencies.repository.findFresh(universityNormalized, programNormalized, queryCode, queryText, staleAfter);
      if (cached) return { outcome: 'FOUND', cached: true, entry: cached };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let results: SearchResult[];
    try {
      const searchQuery = `"${input.university}" "${input.program}" "${input.query}" course catalog syllabus`;
      results = await this.dependencies.search.search(searchQuery, this.config.maxSearchResults, controller.signal);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'Course search is temporarily unavailable', 'COURSE_SEARCH_UNAVAILABLE');
    } finally { clearTimeout(timer); }
    if (!results.length) return { outcome: 'NOT_VERIFIED', cached: false, alternatives: [] };

    const sources = await this.prepareSources(results, input);
    if (!sources.length) return { outcome: 'NOT_VERIFIED', cached: false, alternatives: [] };
    const extracted = await this.dependencies.extractor.extract({ ...input, sources });
    if (extracted.match === 'AMBIGUOUS') return { outcome: 'AMBIGUOUS', cached: false, alternatives: extracted.alternatives };
    if (extracted.match === 'NONE' || !extracted.course) return { outcome: 'NOT_VERIFIED', cached: false, alternatives: extracted.alternatives };

    const courseCode = normalizeCourseCode(extracted.course.courseCode);
    const courseName = normalizeText(extracted.course.courseName);
    const requestedMatch = courseCode === queryCode || courseName.includes(queryText) || queryText.includes(courseName);
    const evidenceIndexesValid = extracted.course.evidenceSourceIndexes.every((index) => index <= sources.length);
    if (!requestedMatch || !evidenceIndexesValid) return { outcome: 'NOT_VERIFIED', cached: false, alternatives: extracted.alternatives };
    const evidenceSources = extracted.course.evidenceSourceIndexes.map((index) => sources[index - 1]!);
    const officialSources = evidenceSources.filter((source) => source.isOfficial);
    const status = officialSources.length === 0
      ? 'NOT_VERIFIED'
      : extracted.course.conflicting || extracted.course.confidence < 0.8
        ? 'PARTIAL'
        : 'VERIFIED';
    const entry = await this.dependencies.repository.save({
      university: input.university,
      universityNormalized,
      program: input.program,
      programNormalized,
      extracted: extracted.course,
      status,
      officialUrl: officialSources[0]?.url ?? null,
      sources,
      checkedAt,
    });
    return { outcome: 'FOUND', cached: false, entry };
  }

  async refresh(id: string) {
    const entry = await this.dependencies.repository.findById(id);
    if (!entry) throw new AppError(404, 'Course catalog entry not found', 'NOT_FOUND');
    return this.lookup({ university: entry.university, program: entry.program, query: entry.courseCode, refresh: true });
  }

  async get(id: string) {
    const entry = await this.dependencies.repository.findById(id);
    if (!entry) throw new AppError(404, 'Course catalog entry not found', 'NOT_FOUND');
    return entry;
  }

  async answer(id: string, question: string, language: 'ar' | 'en') {
    if (isTutoringRequest(question)) throw new AppError(400, language === 'ar' ? 'هذه الميزة تعرض معلومات المادة المنشورة فقط، وليست للتدريس أو حل الأسئلة.' : 'This feature only provides published course facts; it does not teach or solve questions.', 'COURSE_INTELLIGENCE_SCOPE');
    const entry = await this.get(id);
    const lower = normalizeText(question);
    const ar = language === 'ar';
    if (/متطلب|prerequisite/.test(lower)) return factAnswer(entry.prerequisites, ar ? 'لا توجد متطلبات منشورة في المصادر المحفوظة.' : 'No prerequisites are published in the stored sources.');
    if (/ساع|credit/.test(lower)) return entry.credits == null ? (ar ? 'عدد الساعات غير موثّق.' : 'The credit count is not verified.') : (ar ? `${entry.credits} ساعات معتمدة.` : `${entry.credits} credits.`);
    if (/موضوع|محتو|topic|content/.test(lower)) return factAnswer(entry.topics, ar ? 'لا توجد موضوعات منشورة في المصادر المحفوظة.' : 'No topics are published in the stored sources.');
    if (/تقييم|امتحان|assessment|exam/.test(lower)) return factAnswer(entry.assessmentInfo, ar ? 'لا توجد معلومات تقييم منشورة.' : 'No assessment information is published.');
    if (/وصف|description/.test(lower)) return entry.description ?? (ar ? 'لا يوجد وصف رسمي محفوظ.' : 'No official description is stored.');
    if (/مصدر|رابط|source|link/.test(lower)) return entry.sources.map((source) => `${source.title}: ${source.url}`).join('\n');
    const haystack = normalizeText([entry.description, ...entry.topics, ...entry.prerequisites, ...entry.assessmentInfo].filter(Boolean).join(' '));
    const meaningful = lower.replace(/هل|مدرج|مذكور|listed|published|is|the|in|course/g, '').trim();
    if (meaningful.length >= 3) return haystack.includes(meaningful) ? (ar ? 'نعم، هذا مذكور في المعلومات المنشورة المحفوظة.' : 'Yes, it is listed in the stored published information.') : (ar ? 'لم أجده في المعلومات المنشورة المحفوظة.' : 'It was not found in the stored published information.');
    return ar ? 'اسأل عن الساعات أو المتطلبات أو الموضوعات أو الوصف أو المصادر.' : 'Ask about credits, prerequisites, topics, the description, or sources.';
  }

  private async prepareSources(results: SearchResult[], input: { university: string; program: string; query: string }) {
    const classified = results.map((result) => classifySource(result, input.university));
    classified.sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || sourceRank(a.sourceType) - sourceRank(b.sourceType));
    const fetched = await Promise.all(classified.slice(0, this.config.maxFetchedPages).map(async (source) => {
      try {
        const response = await this.fetchSource(source.url, { timeoutMs: this.config.timeoutMs, maxBytes: this.config.maxSourceBytes });
        const text = await sourceToText(response);
        return { ...source, url: response.url, excerpt: relevantExcerpt(text, [input.query, input.program, input.university], this.config.maxExtractedChars) || source.description };
      } catch (error) {
        if (error instanceof AppError && error.code === 'UNSAFE_SOURCE_URL') return null;
        return { ...source, excerpt: source.description };
      }
    }));
    return deduplicateSources(fetched.filter((source): source is CourseSource => source !== null))
      .map((source) => ({ ...source, excerpt: source.excerpt.slice(0, this.config.maxExtractedChars) }));
  }
}

function factAnswer(items: string[], empty: string) { return items.length ? items.join('\n• ') : empty; }

function isTutoringRequest(value: string) {
  return /\b(explain|teach|solve|quiz|homework|derive|calculate|chapter)\b|اشرح|علمني|علّمني|حل|اختبرني|الفصل|واجب/iu.test(value);
}

function classifySource(result: SearchResult, university: string): CourseSource {
  let hostname = '';
  let pathname = '';
  try { const url = new URL(result.url); hostname = url.hostname.toLowerCase(); pathname = url.pathname.toLowerCase(); } catch { /* kept secondary; fetch validation rejects it */ }
  const tokens = normalizeText(university).split(' ').filter((token) => token.length >= 4 && !['university', 'college', 'جامعة', 'كلية'].includes(token));
  const academicHost = /\.edu(?:\.[a-z]{2})?$|\.ac\.[a-z]{2}$/.test(hostname);
  const universityHostMatch = tokens.length > 0 && tokens.some((token) => normalizeText(hostname).includes(token));
  const isOfficial = academicHost && universityHostMatch;
  let sourceType: CourseSourceType = 'SECONDARY';
  if (isOfficial && /catalog|course-catalog|catalogue/.test(`${pathname} ${result.title.toLowerCase()}`)) sourceType = 'OFFICIAL_CATALOG';
  else if (isOfficial && (/syllabus/.test(`${pathname} ${result.title.toLowerCase()}`) || pathname.endsWith('.pdf'))) sourceType = 'OFFICIAL_SYLLABUS';
  else if (isOfficial && /department|faculty|college/.test(`${pathname} ${result.title.toLowerCase()}`)) sourceType = 'OFFICIAL_DEPARTMENT';
  else if (isOfficial) sourceType = 'UNIVERSITY_DOCUMENT';
  return { ...result, sourceType, isOfficial, excerpt: result.description };
}

function sourceRank(type: CourseSourceType) {
  return ['OFFICIAL_CATALOG', 'OFFICIAL_DEPARTMENT', 'OFFICIAL_SYLLABUS', 'UNIVERSITY_DOCUMENT', 'SECONDARY'].indexOf(type);
}

function deduplicateSources(sources: CourseSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url.replace(/#.*$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
