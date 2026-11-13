import { LinkPreview } from '../types/attachment';

const UNSAFE_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:'];
const URL_REGEX = /\b(https?:\/\/[^\s<>"'{}|\\^`]+)/gi;

export class LinkPreviewService {
  private previewCache = new Map<string, LinkPreview>();

  public detectUrls(text: string): { validUrls: string[]; unsafeUrls: string[] } {
    const validUrls: string[] = [];
    const unsafeUrls: string[] = [];

    // Check for explicit unsafe scheme usage
    for (const scheme of UNSAFE_SCHEMES) {
      const schemeRegex = new RegExp(`\\b${scheme}\\S*`, 'gi');
      const matches = text.match(schemeRegex);
      if (matches) {
        unsafeUrls.push(...matches);
      }
    }

    const matches = text.match(URL_REGEX);
    if (matches) {
      for (const m of matches) {
        // Strip trailing punctuation like ., ), ,, ;
        const cleaned = m.replace(/[.,;:)]+$/, '');
        try {
          const parsed = new URL(cleaned);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            if (!validUrls.includes(cleaned)) {
              validUrls.push(cleaned);
            }
          } else {
            if (!unsafeUrls.includes(cleaned)) {
              unsafeUrls.push(cleaned);
            }
          }
        } catch {
          // invalid url ignored
        }
      }
    }

    return { validUrls, unsafeUrls };
  }

  public async getPreview(urlStr: string): Promise<LinkPreview> {
    const cached = this.previewCache.get(urlStr);
    if (cached) return cached;

    let domain = '';
    try {
      const parsed = new URL(urlStr);
      domain = parsed.hostname;
    } catch {
      return {
        url: urlStr,
        domain: 'invalid-url',
        status: 'error',
        error: 'Malformed URL',
      };
    }

    const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(urlStr, {
        signal: controller.signal,
        headers: { Accept: 'text/html,application/xhtml+xml' },
      }).catch((e) => {
        // Handle CORS or network reachability failures gracefully
        return null;
      });

      clearTimeout(timeoutId);

      if (!res || !res.ok) {
        const fallback: LinkPreview = {
          url: urlStr,
          domain,
          siteName: domain,
          favicon: fallbackFavicon,
          status: 'fallback',
          error: 'External site CORS or network boundary: fallback domain link displayed safely.',
        };
        this.previewCache.set(urlStr, fallback);
        return fallback;
      }

      const html = await res.text();
      const meta = this.parseHtmlMetadata(html, urlStr, domain);
      this.previewCache.set(urlStr, meta);
      return meta;
    } catch (err: any) {
      const fallback: LinkPreview = {
        url: urlStr,
        domain,
        siteName: domain,
        favicon: fallbackFavicon,
        status: 'fallback',
        error: err?.message || 'Network limitation prevented scraping OpenGraph data.',
      };
      this.previewCache.set(urlStr, fallback);
      return fallback;
    }
  }

  public async getPreviewsForText(text: string): Promise<LinkPreview[]> {
    const { validUrls } = this.detectUrls(text);
    if (validUrls.length === 0) return [];

    const promises = validUrls.map((u) => this.getPreview(u));
    return Promise.all(promises);
  }

  public parseHtmlMetadata(html: string, url: string, domain: string): LinkPreview {
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
    const titleTagMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
    const nameDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    const ogSiteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["'](.*?)["']/i);

    const title = this.escapeHtml(ogTitleMatch?.[1] || titleTagMatch?.[1] || domain);
    const description = this.escapeHtml(ogDescMatch?.[1] || nameDescMatch?.[1]);
    const siteName = this.escapeHtml(ogSiteNameMatch?.[1] || domain);
    const image = ogImageMatch?.[1];
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    return {
      url,
      domain,
      title: title || domain,
      description,
      siteName,
      image,
      favicon,
      status: 'loaded',
    };
  }

  private escapeHtml(str?: string): string | undefined {
    if (!str) return undefined;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const linkPreviewService = new LinkPreviewService();
