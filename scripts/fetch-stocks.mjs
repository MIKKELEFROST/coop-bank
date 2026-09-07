// Build-time fetch of Danish stock quotes.
//
// Runs in GitHub Actions, not in a browser, so there is no CORS restriction and
// no API key: Yahoo's chart endpoint answers plain HTTP requests from a server.
// The result is committed as data/aktier.json and the page reads that file, so
// the site stays a static deploy with nothing secret in it.
//
// Run locally with:  node scripts/fetch-stocks.mjs

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/aktier.json');

// Yahoo ticker → display name → market. Yahoo's own shortName wins when it has
// one; these are the fallback and the ordering. The market code drives the
// Danmark/USA filter on the page.
const TICKERS = [
  // ── Nasdaq København ──────────────────────────────────────────────────
  ['NOVO-B.CO',   'Novo Nordisk B',         'DK'],
  ['MAERSK-B.CO', 'A.P. Møller - Mærsk B',  'DK'],
  ['MAERSK-A.CO', 'A.P. Møller - Mærsk A',  'DK'],
  ['DSV.CO',      'DSV',                    'DK'],
  ['NSIS-B.CO',   'Novonesis B',            'DK'],
  ['VWS.CO',      'Vestas Wind Systems',    'DK'],
  ['ORSTED.CO',   'Ørsted',                 'DK'],
  ['DANSKE.CO',   'Danske Bank',            'DK'],
  ['COLO-B.CO',   'Coloplast B',            'DK'],
  ['GMAB.CO',     'Genmab',                 'DK'],
  ['CARL-B.CO',   'Carlsberg B',            'DK'],
  ['PNDORA.CO',   'Pandora',                'DK'],
  ['TRYG.CO',     'Tryg',                   'DK'],
  ['DEMANT.CO',   'Demant',                 'DK'],
  ['ROCK-B.CO',   'Rockwool B',             'DK'],
  ['AMBU-B.CO',   'Ambu B',                 'DK'],
  ['ZEAL.CO',     'Zealand Pharma',         'DK'],
  ['GN.CO',       'GN Store Nord',          'DK'],
  ['JYSK.CO',     'Jyske Bank',             'DK'],
  ['ISS.CO',      'ISS',                    'DK'],
  ['NKT.CO',      'NKT',                    'DK'],
  ['BAVA.CO',     'Bavarian Nordic',        'DK'],
  ['RBREW.CO',    'Royal Unibrew',          'DK'],
  ['NETC.CO',     'Netcompany Group',       'DK'],

  // ── USA (NasdaqGS / NYSE) ─────────────────────────────────────────────
  ['NVDA',  'NVIDIA',              'US'],
  ['AAPL',  'Apple',               'US'],
  ['MSFT',  'Microsoft',           'US'],
  ['GOOGL', 'Alphabet A',          'US'],
  ['GOOG',  'Alphabet C',          'US'],
  ['AMZN',  'Amazon.com',          'US'],
  ['META',  'Meta Platforms',      'US'],
  ['AVGO',  'Broadcom',            'US'],
  ['TSLA',  'Tesla',               'US'],
  ['LLY',   'Eli Lilly',           'US'],
  ['MU',    'Micron Technology',   'US'],
  ['BRK-A', 'Berkshire Hathaway A', 'US'],
  ['JPM',   'JPMorgan Chase',      'US'],
  ['V',     'Visa',                'US'],
  ['UNH',   'UnitedHealth Group',  'US'],
  ['WMT',   'Walmart',             'US'],
];

// Refuse to overwrite a good file with a mostly-broken one: a Yahoo-side
// hiccup should leave yesterday's data in place rather than gut the page.
const MIN_OK_RATIO = 0.7;

const SPARK_POINTS = 30;
const RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Number(n.toFixed(d)));

async function fetchTicker(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
    + encodeURIComponent(symbol) + '?interval=1d&range=3mo';

  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; coop-bank-kursliste/1.0)', accept: 'application/json' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const json = await res.json();
      if (json?.chart?.error) throw new Error(json.chart.error.description || 'chart error');

      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('tomt svar');
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) await sleep(attempt * 800);
    }
  }
  throw lastErr;
}

function normalise(result, fallbackName, market) {
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};

  // Keep only sessions that actually have a close; Yahoo pads holidays with null.
  const closes = (quote.close || []).filter((c) => c != null);
  if (closes.length < 2) throw new Error('for få lukkekurser');

  const price = meta.regularMarketPrice ?? closes[closes.length - 1];

  // The day's move is measured against the previous session's close. Yahoo's
  // chartPreviousClose is the close before the whole 3-month range starts, so
  // using it here would label a quarterly move as "i dag".
  const previousClose = closes[closes.length - 2];
  const change = price - previousClose;

  return {
    symbol:   meta.symbol || '',
    name:     meta.shortName || fallbackName,
    market,
    exchange: meta.fullExchangeName || 'Copenhagen',
    currency: meta.currency || 'DKK',
    price:          round(price),
    previous_close: round(previousClose),
    change:         round(change),
    percent_change: round(previousClose ? (change / previousClose) * 100 : null, 4),
    high:        round(meta.regularMarketDayHigh),
    low:         round(meta.regularMarketDayLow),
    volume:      meta.regularMarketVolume ?? null,
    week52_low:  round(meta.fiftyTwoWeekLow),
    week52_high: round(meta.fiftyTwoWeekHigh),
    // Daily closes, cheap here because this runs at build time rather than per
    // page view. Enough points for a sparkline, not so many that the JSON bloats.
    spark: closes.slice(-SPARK_POINTS).map((c) => round(c)),
    quote_time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
  };
}

async function main() {
  const stocks = [];
  const failed = [];

  for (const [symbol, name, market] of TICKERS) {
    try {
      stocks.push(normalise(await fetchTicker(symbol), name, market));
      process.stdout.write('  ✓ ' + symbol + '\n');
    } catch (err) {
      failed.push(symbol);
      process.stdout.write('  ✗ ' + symbol + ' — ' + err.message + '\n');
    }
    await sleep(250); // be a polite client
  }

  const ratio = stocks.length / TICKERS.length;
  console.log(`\n${stocks.length}/${TICKERS.length} hentet (${(ratio * 100).toFixed(0)}%)`);

  if (ratio < MIN_OK_RATIO) {
    let existing = false;
    try { await readFile(OUT); existing = true; } catch { /* ingen tidligere fil */ }
    console.error(`For mange fejlede (kræver ${MIN_OK_RATIO * 100}%).`
      + (existing ? ' Beholder den eksisterende data/aktier.json.' : ''));
    process.exit(1);
  }

  // Leave the file alone when no price moved. updated_at is a timestamp, so
  // rewriting unconditionally would dirty the file on every run and commit
  // three times a day forever — including holidays, when the exchange is shut
  // and every quote is identical. Comparing the payload minus the timestamp
  // means updated_at reads as "when the data last changed", which is what the
  // page's "opdateret for N siden" is actually claiming.
  const body = {
    source: 'Yahoo Finance',
    markets: [
      { code: 'DK', label: 'Danmark', exchange: 'Nasdaq København', currency: 'DKK' },
      { code: 'US', label: 'USA',     exchange: 'NasdaqGS / NYSE',  currency: 'USD' },
    ],
    failed,
    stocks,
  };

  try {
    const previous = JSON.parse(await readFile(OUT, 'utf8'));
    const { updated_at, ...previousBody } = previous;
    if (JSON.stringify(previousBody) === JSON.stringify(body)) {
      console.log('Ingen kursændringer — ' + OUT + ' er urørt.');
      return;
    }
  } catch { /* ingen brugbar tidligere fil; skriv en ny */ }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ updated_at: new Date().toISOString(), ...body }, null, 2) + '\n', 'utf8');
  console.log('Skrev ' + OUT);
}

main().catch((err) => { console.error(err); process.exit(1); });
