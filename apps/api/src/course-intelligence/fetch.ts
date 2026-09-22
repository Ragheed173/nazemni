import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { PDFParse } from 'pdf-parse';
import { AppError } from '../errors.js';

type Resolver = (hostname: string) => Promise<string[]>;

const defaultResolver: Resolver = async (hostname) => {
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  return addresses.map((item) => item.address);
};

function blockedIpv4(ip: string) {
  const octets = ip.split('.').map(Number);
  const [a = 0, b = 0] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 192 && b === 2)
    || (a === 192 && b === 88)
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0);
}

function blockedIpv6(ip: string) {
  const normalized = ip.toLowerCase().split('%')[0] ?? '';
  if (normalized.startsWith('::ffff:')) return blockedIpv4(normalized.slice(7));
  return normalized === '::' || normalized === '::1'
    || normalized.startsWith('fc') || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized.startsWith('100:')
    || normalized.startsWith('2001:db8:');
}

export function isBlockedAddress(ip: string) {
  const family = net.isIP(ip);
  return family === 0 || (family === 4 ? blockedIpv4(ip) : blockedIpv6(ip));
}

export async function assertSafeSourceUrl(value: string, resolver: Resolver = defaultResolver) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError(400, 'Unsafe source URL', 'UNSAFE_SOURCE_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new AppError(400, 'Unsafe source URL', 'UNSAFE_SOURCE_URL');
  }
  if ((url.protocol === 'http:' && url.port && url.port !== '80') || (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw new AppError(400, 'Unsafe source URL', 'UNSAFE_SOURCE_URL');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new AppError(400, 'Unsafe source URL', 'UNSAFE_SOURCE_URL');
  }
  const direct = net.isIP(host) ? [host] : await resolver(host);
  if (direct.length === 0 || direct.some(isBlockedAddress)) throw new AppError(400, 'Unsafe source URL', 'UNSAFE_SOURCE_URL');
  return { url, address: direct[0]! };
}

type SafeFetchOptions = { timeoutMs: number; maxBytes: number; maxRedirects?: number; resolver?: Resolver };
type SafeResponse = { url: string; contentType: string; body: Buffer };

export async function safeFetchSource(value: string, options: SafeFetchOptions): Promise<SafeResponse> {
  const maxRedirects = options.maxRedirects ?? 3;
  let current = value;
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const { url, address } = await assertSafeSourceUrl(current, options.resolver);
    const response = await requestPinned(url, address, options);
    if (response.status >= 300 && response.status < 400 && response.location) {
      if (redirect === maxRedirects) throw new AppError(502, 'Too many source redirects', 'SOURCE_FETCH_FAILED');
      current = new URL(response.location, url).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new AppError(502, 'Source could not be retrieved', 'SOURCE_FETCH_FAILED');
    return { url: url.toString(), contentType: response.contentType, body: response.body };
  }
  throw new AppError(502, 'Source could not be retrieved', 'SOURCE_FETCH_FAILED');
}

function requestPinned(url: URL, address: string, options: SafeFetchOptions) {
  return new Promise<{ status: number; location?: string; contentType: string; body: Buffer }>((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, {
      method: 'GET',
      headers: { Accept: 'text/html,text/plain,application/pdf;q=0.9', 'User-Agent': 'Nazemni-Course-Intelligence/1.0' },
      lookup: (_hostname, _lookupOptions, callback) => callback(null, address, net.isIP(address) as 4 | 6),
      servername: url.hostname,
    }, (response) => {
      const declared = Number(response.headers['content-length'] ?? 0);
      if (declared > options.maxBytes) {
        response.destroy();
        reject(new AppError(502, 'Source response is too large', 'SOURCE_TOO_LARGE'));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > options.maxBytes) {
          response.destroy(new AppError(502, 'Source response is too large', 'SOURCE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        status: response.statusCode ?? 502,
        location: typeof response.headers.location === 'string' ? response.headers.location : undefined,
        contentType: String(response.headers['content-type'] ?? '').toLowerCase(),
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    request.setTimeout(options.timeoutMs, () => request.destroy(new AppError(504, 'Source request timed out', 'SOURCE_TIMEOUT')));
    request.on('error', reject);
    request.end();
  });
}

function decodeHtml(value: string) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export async function sourceToText(response: SafeResponse) {
  if (response.contentType.includes('application/pdf') || response.url.toLowerCase().endsWith('.pdf')) {
    const parser = new PDFParse({ data: response.body });
    try { return (await parser.getText()).text; } finally { await parser.destroy(); }
  }
  if (!response.contentType.includes('text/') && !response.contentType.includes('html')) {
    throw new AppError(502, 'Unsupported source content type', 'UNSUPPORTED_SOURCE_TYPE');
  }
  const html = response.body.toString('utf8');
  return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

export function relevantExcerpt(text: string, terms: string[], maxChars: number) {
  const needles = terms.map((term) => term.trim().toLowerCase()).filter((term) => term.length > 2);
  const lines = text.split(/\r?\n|(?<=[.!?])\s+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const keywords = ['credit', 'prerequisite', 'description', 'topic', 'assessment', 'syllabus', 'course', 'ساعة', 'متطلب', 'وصف', 'موضوع', 'تقييم', 'مساق', 'مقرر'];
  const selected = lines.filter((line) => {
    const lower = line.toLowerCase();
    return needles.some((needle) => lower.includes(needle)) || keywords.some((keyword) => lower.includes(keyword));
  });
  return [...new Set(selected)].join('\n').slice(0, maxChars);
}
