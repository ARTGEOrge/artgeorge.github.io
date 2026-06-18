/*
 * Scholar AI — WSJ feed builder (runs in GitHub Actions, no Cloudflare needed).
 * Fetches WSJ's public RSS feeds server-side and writes scholar-ai/wsj.json so the
 * static site can read it same-origin (no CORS). Stores ONLY the syndicated
 * headline + short summary + link — never full (paywalled) article text.
 *
 * Run locally:  node scholar-ai/build-wsj.mjs
 */
import { writeFileSync } from 'node:fs';

const FEEDS = [
  'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',   // Markets
  'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',  // Business
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',      // World
];

const clean = (s) => (s || '')
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#\d+;/g, ' ')
  .replace(/\s+/g, ' ').trim();

const pick = (item, tag) => {
  const m = item.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? clean(m[1]) : '';
};

const out = [];
const seen = new Set();
for (const url of FEEDS) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Scholar AI RSS reader)' } });
    if (!r.ok) { console.error('skip', url, r.status); continue; }
    const xml = await r.text();
    for (const item of xml.split(/<item>/i).slice(1, 12)) {
      const title = pick(item, 'title');
      const summary = pick(item, 'description').slice(0, 360); // short syndicated summary only
      const link = pick(item, 'link');
      const date = pick(item, 'pubDate');
      if (title && summary && !seen.has(title)) { seen.add(title); out.push({ title, summary, link, date }); }
    }
  } catch (e) { console.error('error', url, e.message); }
}

writeFileSync(new URL('./wsj.json', import.meta.url), JSON.stringify(out));
console.log('wrote scholar-ai/wsj.json with', out.length, 'items');
