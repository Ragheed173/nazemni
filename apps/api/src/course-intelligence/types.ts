export type CourseSourceType =
  | 'OFFICIAL_CATALOG'
  | 'OFFICIAL_DEPARTMENT'
  | 'OFFICIAL_SYLLABUS'
  | 'UNIVERSITY_DOCUMENT'
  | 'SECONDARY';

export type SearchResult = { title: string; url: string; description: string };

export type CourseSource = SearchResult & {
  sourceType: CourseSourceType;
  isOfficial: boolean;
  excerpt: string;
};

export type ExtractedCourse = {
  match: 'EXACT' | 'AMBIGUOUS' | 'NONE';
  course?: {
    courseCode: string;
    courseName: string;
    credits: number | null;
    description: string | null;
    prerequisites: string[];
    topics: string[];
    assessmentInfo: string[];
    confidence: number;
    conflicting: boolean;
    evidenceSourceIndexes: number[];
  };
  alternatives: Array<{ courseCode: string; courseName: string }>;
};

export type CatalogEntryView = {
  id: string;
  university: string;
  program: string;
  courseCode: string;
  courseName: string;
  credits: number | null;
  description: string | null;
  prerequisites: string[];
  topics: string[];
  assessmentInfo: string[];
  officialUrl: string | null;
  status: 'VERIFIED' | 'PARTIAL' | 'NOT_VERIFIED';
  confidence: number;
  lastVerifiedAt: Date | null;
  sources: Array<{
    url: string;
    title: string;
    excerpt: string | null;
    sourceType: CourseSourceType;
    isOfficial: boolean;
    retrievedAt: Date;
  }>;
};

export type CourseIntelligenceRuntimeConfig = {
  enabled: boolean;
  cacheDays: number;
  maxSearchResults: number;
  maxFetchedPages: number;
  maxSourceBytes: number;
  maxExtractedChars: number;
  aiContextChars: number;
  aiMaxOutputTokens: number;
  timeoutMs: number;
  requestsPerMinute: number;
};

export const defaultCourseIntelligenceConfig: CourseIntelligenceRuntimeConfig = {
  enabled: false,
  cacheDays: 30,
  maxSearchResults: 5,
  maxFetchedPages: 3,
  maxSourceBytes: 512_000,
  maxExtractedChars: 12_000,
  aiContextChars: 9000,
  aiMaxOutputTokens: 1200,
  timeoutMs: 10_000,
  requestsPerMinute: 3,
};
