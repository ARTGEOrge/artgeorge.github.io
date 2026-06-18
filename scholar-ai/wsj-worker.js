/*
 * Scholar AI — WSJ RSS proxy (Cloudflare Worker)
 * ------------------------------------------------
 * WSJ's public RSS feeds (free headlines + short summaries) send no CORS header,
 * so a static site can't fetch them from the browser. This tiny Worker fetches
 * them server-side and re-serves them as JSON with CORS enabled.
 *
 * It returns ONLY the publicly-syndicated RSS title + short summary + link —
 * never full (paywalled) article text. Each item links back to wsj.com.
 *
 * ── Deploy (free, ~5 min, no credit card) ───────────────────────────────────
 * Option A — dashboard:
 *   1. Go to https://dash.cloudflare.com  →  Workers & Pages  →  Create  →  Worker
 *   2. Name it e.g. "wsj-rss", click Deploy, then "Edit code"
 *   3. Replace the editor contents with this whole file, click Deploy
 *   4. Copy the URL (e.g. https://wsj-rss.YOURNAME.workers.dev)
 *
 * Option B — CLI:
 *   npm i -g wrangler && wrangler login
 *   wrangler deploy scholar-ai/wsj-worker.js --name wsj-rss
 *
 * ── Then connect it ─────────────────────────────────────────────────────────
 *   In scholar-ai/index.html set:   const WSJ_WORKER = 'https://wsj-rss.YOURNAME.workers.dev';
 *   Retrain Scholar AI — WSJ headlines now appear, tagged "Wall Street Journal".
 */

const FEEDS = [
  'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',   // Markets
  'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',  // Business
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',      // World
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=600', // 10-minute edge cache
};

function clean(s) {
  return (s || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function pick(item, tag) {
  const m = item.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? clean(m[1]) : '';
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const out = [];
    await Promise.all(FEEDS.map(async (url) => {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Scholar AI RSS reader)' },
          cf: { cacheTtl: 600, cacheEverything: true },
        });
        if (!r.ok) return;
        const xml = await r.text();
        for (const item of xml.split(/<item>/i).slice(1, 11)) {
          const title = pick(item, 'title');
          const summary = pick(item, 'description');
          const link = pick(item, 'link');
          const date = pick(item, 'pubDate');
          if (title && summary) out.push({ title, summary, link, date });
        }
      } catch (e) { /* skip a failing feed */ }
    }));

    return new Response(JSON.stringify(out), { headers: CORS });
  },
};
