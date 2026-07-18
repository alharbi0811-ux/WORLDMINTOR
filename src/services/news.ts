// ============================================
// WORLDMINTOR — Multi-Source News Aggregator
// HIGH-SPEED INGESTION + SMART DEDUPLICATION
// ============================================

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceIcon?: string;
  publishedAt: string;
  category: 'military' | 'political' | 'conflicts';
  severity: 'critical' | 'high' | 'medium' | 'low';
  region?: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
}

// Merged article after dedup
export interface MergedArticle extends NewsArticle {
  relatedSources: { name: string; url: string }[];
  mergedCount: number;
}

// ============================================
// 1) HIGH-SPEED INGESTION ENGINE
// ============================================
type IngestionCallback = (articles: MergedArticle[]) => void;

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let articleCache: MergedArticle[] = [];
let lastFetchTime = 0;

const POLL_INTERVAL_MS = 30_000; // 30s between full cycles
const STALE_THRESHOLD_MS = 60_000; // refetch if >60s old
const SOURCE_TIMEOUT_MS = 8_000;

export function startIngestion(lang: string, onUpdate: IngestionCallback): () => void {
  let active = true;

  const run = async () => {
    if (!active) return;
    const now = Date.now();
    if (now - lastFetchTime < STALE_THRESHOLD_MS && articleCache.length > 0) {
      onUpdate(articleCache);
    } else {
      const fresh = await fetchAllNews(lang);
      if (active) {
        articleCache = fresh;
        lastFetchTime = Date.now();
        onUpdate(fresh);
      }
    }
    if (active) {
      pollingTimer = setTimeout(run, POLL_INTERVAL_MS);
    }
  };

  run();

  return () => {
    active = false;
    if (pollingTimer) { clearTimeout(pollingTimer); pollingTimer = null; }
  };
}

export function invalidateCache() {
  lastFetchTime = 0;
  articleCache = [];
}

// ============================================
// 2) SMART DEDUPLICATION ENGINE
// ============================================
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function deduplicateAndMerge(articles: NewsArticle[]): MergedArticle[] {
  const SIMILARITY_THRESHOLD = 0.45;
  const merged: MergedArticle[] = [];
  const used = new Set<number>();

  // Pre-tokenize all
  const tokens = articles.map(a => tokenize(a.title + ' ' + a.description));

  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue;

    const primary = articles[i];
    const relatedSources: { name: string; url: string }[] = [];
    let bestSeverity = primary.severity;
    let bestImage = primary.imageUrl;
    let bestDesc = primary.description;

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue;

      const sim = jaccardSimilarity(tokens[i], tokens[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        used.add(j);
        relatedSources.push({
          name: articles[j].source,
          url: articles[j].url,
        });
        // Keep the more severe rating
        if (severityRank(articles[j].severity) > severityRank(bestSeverity)) {
          bestSeverity = articles[j].severity;
        }
        // Keep longer description
        if ((articles[j].description?.length || 0) > (bestDesc?.length || 0)) {
          bestDesc = articles[j].description;
        }
        // Keep any image
        if (!bestImage && articles[j].imageUrl) {
          bestImage = articles[j].imageUrl;
        }
      }
    }

    used.add(i);
    merged.push({
      ...primary,
      severity: bestSeverity,
      description: bestDesc,
      imageUrl: bestImage,
      relatedSources,
      mergedCount: relatedSources.length + 1,
    });
  }

  return merged;
}

function severityRank(s: string): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s] || 0;
}

// ============================================
// SOURCE FETCHERS
// ============================================

// ---- GDELT (free, no key, real-time) ----
async function fetchGDELT(lang: string): Promise<NewsArticle[]> {
  const queries = [
    'military OR army OR navy OR airforce OR missile OR defense',
    'war OR conflict OR battle OR troops OR weapons',
    'politics OR election OR sanctions OR diplomacy OR government',
  ];

  const results: NewsArticle[] = [];

  const fetches = queries.map(async (query) => {
    try {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=40&format=json&sourcelang=${lang === 'ar' ? 'arabic' : 'english'}&timespan=1440`;
      const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.articles) return;

      for (const art of data.articles) {
        results.push({
          id: `gdelt-${hashCode(art.url)}`,
          title: art.title || '',
          description: art.title || '',
          url: art.url || '',
          source: extractDomain(art.domain || art.url || ''),
          publishedAt: formatGDELTDate(art.seendate),
          category: detectCategory(art.title || ''),
          severity: detectSeverity(art.title || ''),
          region: detectRegion(art.title || '', art.sourcecountry || ''),
          imageUrl: art.socialimage || undefined,
          lat: art.latitude ? parseFloat(art.latitude) : undefined,
          lng: art.longitude ? parseFloat(art.longitude) : undefined,
        });
      }
    } catch { /* timeout or network */ }
  });

  await Promise.allSettled(fetches);
  return results;
}

// ---- NewsData.io (free 200 req/day) ----
async function fetchNewsDataIO(apiKey: string, lang: string): Promise<NewsArticle[]> {
  if (!apiKey) return [];
  const results: NewsArticle[] = [];
  const langParam = lang === 'ar' ? 'ar' : 'en';

  try {
    const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&category=politics,world&language=${langParam}&q=military OR war OR army OR politics OR sanctions OR conflict&size=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();

    if (data.results) {
      for (const art of data.results) {
        results.push({
          id: `nd-${hashCode(art.article_id || art.link)}`,
          title: art.title || '',
          description: art.description || art.title || '',
          url: art.link || '',
          source: art.source_name || art.source_id || 'NewsData',
          sourceIcon: art.source_icon || undefined,
          publishedAt: art.pubDate || new Date().toISOString(),
          category: detectCategory(art.title + ' ' + (art.description || '')),
          severity: detectSeverity(art.title + ' ' + (art.description || '')),
          region: detectRegion(art.title || '', art.country?.[0] || ''),
          imageUrl: art.image_url || undefined,
        });
      }
    }
  } catch { /* skip */ }
  return results;
}

// ---- RSS Feeds (direct, free) ----
const RSS_FEEDS: { url: string; name: string; lang: string }[] = [
  { url: 'https://feeds.reuters.com/reuters/worldNews', name: 'Reuters', lang: 'en' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NY Times', lang: 'en' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', lang: 'en' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera EN', lang: 'en' },
  { url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945', name: 'US DoD', lang: 'en' },
  { url: 'https://www.janes.com/feeds/news', name: 'Janes Defence', lang: 'en' },
  { url: 'https://www.aljazeera.net/feed/all', name: 'الجزيرة', lang: 'ar' },
  { url: 'https://www.bbc.com/arabic/rss.xml', name: 'BBC عربي', lang: 'ar' },
  { url: 'https://www.skynewsarabia.com/web/rss', name: 'سكاي نيوز', lang: 'ar' },
  { url: 'https://www.france24.com/ar/rss', name: 'فرانس24', lang: 'ar' },
];

async function fetchRSSFeeds(lang: string): Promise<NewsArticle[]> {
  const feeds = RSS_FEEDS.filter(f => f.lang === lang || f.lang === 'en');
  const results: NewsArticle[] = [];

  const fetches = feeds.map(async (feed) => {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
      if (!res.ok) return;
      const text = await res.text();
      const parsed = parseRSSXML(text, feed.name);
      results.push(...parsed);
    } catch { /* timeout */ }
  });

  await Promise.allSettled(fetches);
  return results;
}

function parseRSSXML(xml: string, sourceName: string): NewsArticle[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item, entry');
  const results: NewsArticle[] = [];

  items.forEach((item, i) => {
    if (i >= 20) return;
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent
      || item.querySelector('link')?.getAttribute('href') || '';
    const desc = item.querySelector('description, summary, content')?.textContent || '';
    const pubDate = item.querySelector('pubDate, published, updated')?.textContent || '';

    const combined = (title + ' ' + desc).toLowerCase();
    const isMilPol = /military|army|war|conflict|battle|troops|missile|defense|attack|strike|bomb|weapon|sanction|politic|election|diplomat|govern|treaty|nuclear|navy|airforce|tank|drone|ceasefire|عسكر|حرب|جيش|صاروخ|دفاع|هجوم|قصف|سلاح|عقوب|سياس|انتخاب|دبلوماس|حكوم|اتفاق|نوو|بحري|طائر|دبابة|مسيّر|وقف/.test(combined);

    if (!isMilPol) return;

    const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);

    results.push({
      id: `rss-${sourceName}-${hashCode(link || title)}`,
      title: stripHTML(title),
      description: stripHTML(desc).slice(0, 250),
      url: link,
      source: sourceName,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      category: detectCategory(combined),
      severity: detectSeverity(combined),
      region: detectRegion(combined, ''),
      imageUrl: imgMatch?.[1] || undefined,
    });
  });

  return results;
}

// ---- ACLED Conflict Data (free) ----
async function fetchACLEDConflicts(): Promise<NewsArticle[]> {
  try {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const dateFrom = weekAgo.toISOString().split('T')[0];
    const url = `https://api.acleddata.com/acled/read?event_date=${dateFrom}&event_date_where=%3E&limit=50&fields=event_id_cnty|event_date|event_type|sub_event_type|actor1|country|location|latitude|longitude|fatalities|notes`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data) return [];

    return data.data.map((ev: any) => ({
      id: `acled-${ev.event_id_cnty}`,
      title: `${ev.event_type}: ${ev.location}, ${ev.country}`,
      description: ev.notes || `${ev.sub_event_type} — ${ev.actor1} — ${ev.location}, ${ev.country}${ev.fatalities > 0 ? ` | Fatalities: ${ev.fatalities}` : ''}`,
      url: 'https://acleddata.com/',
      source: 'ACLED',
      publishedAt: new Date(ev.event_date).toISOString(),
      category: 'conflicts' as const,
      severity: ev.fatalities > 10 ? 'critical' : ev.fatalities > 0 ? 'high' : 'medium',
      region: detectRegion('', ev.country || ''),
      lat: parseFloat(ev.latitude),
      lng: parseFloat(ev.longitude),
    }));
  } catch {
    return [];
  }
}

// ---- GNews.io (free 100 req/day, backup) ----
async function fetchGNews(lang: string): Promise<NewsArticle[]> {
  const apiKey = import.meta.env.VITE_GNEWS_API_KEY;
  if (!apiKey) return [];
  try {
    const langParam = lang === 'ar' ? 'ar' : 'en';
    const url = `https://gnews.io/api/v4/search?q=military OR war OR politics&lang=${langParam}&max=20&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.articles) return [];

    return data.articles.map((art: any) => ({
      id: `gnews-${hashCode(art.url)}`,
      title: art.title || '',
      description: art.description || '',
      url: art.url || '',
      source: art.source?.name || 'GNews',
      publishedAt: art.publishedAt || new Date().toISOString(),
      category: detectCategory(art.title + ' ' + (art.description || '')),
      severity: detectSeverity(art.title + ' ' + (art.description || '')),
      region: detectRegion(art.title || '', ''),
      imageUrl: art.image || undefined,
    }));
  } catch {
    return [];
  }
}

// ============================================
// MAIN AGGREGATOR
// ============================================
export async function fetchAllNews(lang: string): Promise<MergedArticle[]> {
  const newsDataKey = import.meta.env.VITE_NEWSDATA_API_KEY || '';

  const [gdelt, newsData, rss, acled, gnews] = await Promise.allSettled([
    fetchGDELT(lang),
    fetchNewsDataIO(newsDataKey, lang),
    fetchRSSFeeds(lang),
    fetchACLEDConflicts(),
    fetchGNews(lang),
  ]);

  const all: NewsArticle[] = [
    ...(gdelt.status === 'fulfilled' ? gdelt.value : []),
    ...(newsData.status === 'fulfilled' ? newsData.value : []),
    ...(rss.status === 'fulfilled' ? rss.value : []),
    ...(acled.status === 'fulfilled' ? acled.value : []),
    ...(gnews.status === 'fulfilled' ? gnews.value : []),
  ];

  // Sort newest first before dedup (so primary = newest)
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Run smart deduplication
  const merged = deduplicateAndMerge(all);

  return merged;
}

// ============================================
// HELPERS
// ============================================
function detectCategory(text: string): 'military' | 'political' | 'conflicts' {
  const t = text.toLowerCase();
  if (/conflict|war|battle|clash|fight|attack|strike|bomb|casualt|killed|فتال|حرب|هجوم|قصف|اشتباك/.test(t)) return 'conflicts';
  if (/military|army|navy|airforce|troops|weapon|missile|defense|tank|drone|عسكر|جيش|صاروخ|دفاع|سلاح|بحري/.test(t)) return 'military';
  return 'political';
}

function detectSeverity(text: string): 'critical' | 'high' | 'medium' | 'low' {
  const t = text.toLowerCase();
  if (/nuclear|invasion|massacre|catastroph|نوو|غزو|مجزر|كارث/.test(t)) return 'critical';
  if (/killed|dead|bomb|strike|attack|casualt|قتل|قصف|هجوم|ضرب/.test(t)) return 'high';
  if (/sanction|tension|deploy|threat|عقوب|توتر|نشر|تهديد/.test(t)) return 'medium';
  return 'low';
}

function detectRegion(text: string, country: string): string {
  const c = (text + ' ' + country).toLowerCase();
  if (/iraq|iran|syria|yemen|lebanon|saudi|kuwait|qatar|bahrain|oman|jordan|palestine|israel|egypt|turkey|عراق|إيران|سوري|يمن|لبنان|سعود|كويت|قطر|بحرين|عمان|أردن|فلسطين|إسرائيل|مصر|ترك/.test(c)) return 'middleEast';
  if (/ukrain|russia|france|germany|uk|britain|poland|nato|أوكران|روسي|فرنس|ألمان|بريطان|بولند|ناتو/.test(c)) return 'europe';
  if (/china|japan|korea|india|pakistan|taiwan|afghan|الصين|ياباني|كوري|هند|باكستان|تايوان|أفغان/.test(c)) return 'asia';
  if (/nigeria|sudan|ethiopia|congo|somalia|mali|niger|libya|نيجير|سودان|إثيوبي|كونغو|صومال|مالي|نيجر|ليبي/.test(c)) return 'africa';
  return 'americas';
}

function formatGDELTDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const y = dateStr.slice(0, 4), m = dateStr.slice(4, 6), d = dateStr.slice(6, 8);
    const h = dateStr.slice(8, 10) || '00', min = dateStr.slice(10, 12) || '00';
    return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`).toISOString();
  } catch { return new Date().toISOString(); }
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function extractDomain(d: string): string {
  return d.replace(/^(www\.)?/, '').split('/')[0];
}
