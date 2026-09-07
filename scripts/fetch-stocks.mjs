// Build-time fetch of Danish and US stock quotes.
//
// Runs in GitHub Actions, not in a browser, so there is no CORS restriction and
// no API key: Yahoo's chart endpoint and the ECB rates behind Frankfurter both
// answer plain HTTP requests from a server. Results are committed as JSON and
// the pages read those files, so the site stays a static deploy with nothing
// secret in it.
//
// Writes two files, kept apart so the list page does not have to parse the
// full price history it never draws:
//   data/aktier.json          – one row per company, plus a 30-point sparkline
//   data/historik/<SYM>.json  – two years of daily closes, one file per company,
//                               so a detail page fetches ~10 KB instead of all 40
//
// Run locally with:  node scripts/fetch-stocks.mjs

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_LIST    = resolve(ROOT, 'data/aktier.json');
const OUT_HISTORY_DIR = resolve(ROOT, 'data/historik');

// Yahoo ticker → display name → market. Yahoo's own shortName wins when it has
// one; these are the fallback and the ordering. The market code drives the
// Danmark/USA filter on the pages.
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
  ['NVDA',  'NVIDIA',               'US'],
  ['AAPL',  'Apple',                'US'],
  ['MSFT',  'Microsoft',            'US'],
  ['GOOGL', 'Alphabet A',           'US'],
  ['GOOG',  'Alphabet C',           'US'],
  ['AMZN',  'Amazon.com',           'US'],
  ['META',  'Meta Platforms',       'US'],
  ['AVGO',  'Broadcom',             'US'],
  ['TSLA',  'Tesla',                'US'],
  ['LLY',   'Eli Lilly',            'US'],
  ['MU',    'Micron Technology',    'US'],
  ['BRK-A', 'Berkshire Hathaway A', 'US'],
  ['JPM',   'JPMorgan Chase',       'US'],
  ['V',     'Visa',                 'US'],
  ['UNH',   'UnitedHealth Group',   'US'],
  ['WMT',   'Walmart',              'US'],
];

// Refuse to overwrite a good file with a mostly-broken one: a Yahoo-side
// hiccup should leave yesterday's data in place rather than gut the pages.
const MIN_OK_RATIO = 0.7;

const SPARK_POINTS = 30;
const RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Number(n.toFixed(d)));

// ── FX ───────────────────────────────────────────────────────────────────
// ECB reference rates via Frankfurter: keyless, and quoted against EUR, so
// USD→DKK is derived by dividing the two legs. Published on weekdays around
// 16:00 CET, which is why the rate carries its own date rather than "now".
async function fetchUsdDkk() {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=DKK,USD', {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error('FX HTTP ' + res.status);

  const { date, rates } = await res.json();
  if (!rates?.DKK || !rates?.USD) throw new Error('FX mangler DKK eller USD');

  return { rate: Number((rates.DKK / rates.USD).toFixed(6)), date, source: 'ECB via Frankfurter' };
}

// ── Quotes ───────────────────────────────────────────────────────────────
async function fetchTicker(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
    + encodeURIComponent(symbol) + '?interval=1d&range=2y';

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

function normalise(result, fallbackName, market, usdDkk) {
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};

  // Yahoo pads non-trading days with nulls; drop those, keeping dates aligned.
  const stamps = result.timestamp || [];
  const rawCloses = quote.close || [];
  const rawVolumes = quote.volume || [];
  const series = [];
  const volumes = [];
  for (let i = 0; i < rawCloses.length; i++) {
    if (rawCloses[i] == null || stamps[i] == null) continue;
    series.push({ date: new Date(stamps[i] * 1000).toISOString().slice(0, 10), close: round(rawCloses[i]) });
    if (rawVolumes[i] != null) volumes.push(rawVolumes[i]);
  }
  if (series.length < 2) throw new Error('for få lukkekurser');

  // Yahoo's chart meta carries no average volume, so it is the mean of the
  // daily volumes over the last 60 sessions — a computed statistic over real
  // values, labelled as such on the page rather than passed off as a source
  // field. Bounded to a quarter so a two-year window does not average away
  // what the stock trades at now.
  const recentVolumes = volumes.slice(-60);
  const averageVolume = recentVolumes.length
    ? Math.round(recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length)
    : null;

  const closes = series.map((p) => p.close);
  const price = round(meta.regularMarketPrice ?? closes[closes.length - 1]);

  // Longer-horizon moves, measured off the same series rather than fetched
  // separately. ~252 sessions is a trading year; when the history is shorter
  // than a window the field stays null instead of quietly using a shorter one.
  const moveOver = (sessions) => {
    if (closes.length <= sessions) return null;
    const then = closes[closes.length - 1 - sessions];
    return then ? round(((price - then) / then) * 100, 4) : null;
  };

  // The day's move is measured against the previous session's close. Yahoo's
  // chartPreviousClose is the close before the whole 3-month range starts, so
  // using it here would label a quarterly move as "i dag".
  const previousClose = closes[closes.length - 2];
  const change = price - previousClose;

  const currency = meta.currency || (market === 'DK' ? 'DKK' : 'USD');
  // A single derived field, kept beside the untouched native price rather than
  // replacing it, so the pages can offer a DKK view without any figure in the
  // table ever being a conversion the reader did not ask for.
  const toDkk = (n) => (n == null ? null : currency === 'DKK' ? n : round(n * usdDkk));

  return {
    row: {
      symbol:   meta.symbol || '',
      name:     meta.shortName || fallbackName,
      market,
      exchange: meta.fullExchangeName || (market === 'DK' ? 'Copenhagen' : ''),
      currency,
      price,
      price_dkk:      toDkk(price),
      previous_close: round(previousClose),
      change:         round(change),
      percent_change: round(previousClose ? (change / previousClose) * 100 : null, 4),
      change_1y:  moveOver(252),
      change_6m:  moveOver(126),
      high:        round(meta.regularMarketDayHigh),
      low:         round(meta.regularMarketDayLow),
      volume:      meta.regularMarketVolume ?? null,
      average_volume: averageVolume,
      average_volume_days: recentVolumes.length,
      week52_low:  round(meta.fiftyTwoWeekLow),
      week52_high: round(meta.fiftyTwoWeekHigh),
      week52_low_dkk:  toDkk(round(meta.fiftyTwoWeekLow)),
      week52_high_dkk: toDkk(round(meta.fiftyTwoWeekHigh)),
      spark: closes.slice(-SPARK_POINTS),
      quote_time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    },
    history: {
      dates:  series.map((p) => p.date),
      closes,
    },
  };
}

// ── Output ───────────────────────────────────────────────────────────────
// Leave a file alone when nothing but the timestamp would change. updated_at
// is a clock reading, so rewriting unconditionally would dirty the file on
// every run and commit three times a day forever — including holidays, when
// the exchanges are shut and every quote is identical.
async function writeIfChanged(path, body, label) {
  try {
    const { updated_at, ...previousBody } = JSON.parse(await readFile(path, 'utf8'));
    if (JSON.stringify(previousBody) === JSON.stringify(body)) {
      if (label) console.log('  ' + label + ': uændret');
      return false;
    }
  } catch { /* ingen brugbar tidligere fil; skriv en ny */ }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ updated_at: new Date().toISOString(), ...body }, null, 2) + '\n', 'utf8');
  if (label) console.log('  ' + label + ': skrevet');
  return true;
}

async function main() {
  const fx = await fetchUsdDkk();
  console.log(`USD→DKK ${fx.rate} (ECB ${fx.date})\n`);

  const rows = [];
  const history = {};
  const failed = [];

  for (const [symbol, name, market] of TICKERS) {
    try {
      const { row, history: h } = normalise(await fetchTicker(symbol), name, market, fx.rate);
      rows.push(row);
      history[row.symbol] = h;
      process.stdout.write('  ✓ ' + symbol + '\n');
    } catch (err) {
      failed.push(symbol);
      process.stdout.write('  ✗ ' + symbol + ' — ' + err.message + '\n');
    }
    await sleep(250); // be a polite client
  }

  const ratio = rows.length / TICKERS.length;
  console.log(`\n${rows.length}/${TICKERS.length} hentet (${(ratio * 100).toFixed(0)}%)`);

  if (ratio < MIN_OK_RATIO) {
    let existing = false;
    try { await readFile(OUT_LIST); existing = true; } catch { /* ingen tidligere fil */ }
    console.error(`For mange fejlede (kræver ${MIN_OK_RATIO * 100}%).`
      + (existing ? ' Beholder de eksisterende datafiler.' : ''));
    process.exit(1);
  }

  await writeIfChanged(OUT_LIST, {
    source: 'Yahoo Finance',
    markets: [
      { code: 'DK', label: 'Danmark', exchange: 'Nasdaq København', currency: 'DKK' },
      { code: 'US', label: 'USA',     exchange: 'NasdaqGS / NYSE',  currency: 'USD' },
    ],
    fx: { pair: 'USD/DKK', ...fx },
    failed,
    stocks: rows,
  }, 'aktier.json');

  // One file per symbol. A detail page then downloads only the company it
  // shows, and a day that moves three stocks rewrites three small files
  // instead of one large one.
  await mkdir(OUT_HISTORY_DIR, { recursive: true });
  let written = 0;
  for (const [symbol, h] of Object.entries(history)) {
    const file = resolve(OUT_HISTORY_DIR, symbol + '.json');
    if (await writeIfChanged(file, { source: 'Yahoo Finance', range: '2y', symbol, ...h }, null)) written++;
  }
  console.log('  historik: ' + written + ' af ' + Object.keys(history).length + ' filer opdateret');
}

main().catch((err) => { console.error(err); process.exit(1); });
