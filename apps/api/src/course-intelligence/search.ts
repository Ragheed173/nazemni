import { AppError } from '../errors.js';
import type { SearchResult } from './types.js';

export interface CourseSearchProvider {
  search(query: string, count: number, signal: AbortSignal): Promise<SearchResult[]>;
}

export class BraveCourseSearchProvider implements CourseSearchProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl: string) {}

  async search(query: string, count: number, signal: AbortSignal) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));
    url.searchParams.set('safesearch', 'moderate');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': this.apiKey },
      signal,
    });
    if (!response.ok) throw new AppError(502, 'Course search is temporarily unavailable', 'COURSE_SEARCH_UNAVAILABLE');
    const payload = await response.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
    return (payload.web?.results ?? []).flatMap((item) => {
      if (!item.title || !item.url || !isHttpUrl(item.url)) return [];
      return [{ title: item.title.slice(0, 500), url: item.url, description: (item.description ?? '').slice(0, 2000) }];
    }).slice(0, count);
  }
}

export class TavilyCourseSearchProvider implements CourseSearchProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl: string) {}

  async search(query: string, count: number, signal: AbortSignal) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.slice(0, 400),
        search_depth: 'basic',
        max_results: count,
        topic: 'general',
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_usage: true,
        safe_search: true,
      }),
      signal,
    });
    if (!response.ok) throw new AppError(502, 'Course search is temporarily unavailable', 'COURSE_SEARCH_UNAVAILABLE');
    const payload = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return (payload.results ?? []).flatMap((item) => {
      if (!item.title || !item.url || !isHttpUrl(item.url)) return [];
      return [{ title: item.title.slice(0, 500), url: item.url, description: (item.content ?? '').slice(0, 2000) }];
    }).slice(0, count);
  }
}

export function createCourseSearchProvider(provider: 'brave' | 'tavily', apiKey: string, baseUrl: string): CourseSearchProvider {
  return provider === 'tavily'
    ? new TavilyCourseSearchProvider(apiKey, baseUrl)
    : new BraveCourseSearchProvider(apiKey, baseUrl);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export class MockCourseSearchProvider implements CourseSearchProvider {
  calls = 0;
  constructor(private readonly results: SearchResult[]) {}
  async search(_query: string, count: number) {
    this.calls += 1;
    return this.results.slice(0, count);
  }
}
