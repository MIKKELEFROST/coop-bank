// Vercel serverless function: proxies Twelve Data quotes.
//
// The API key lives here, in the TWELVEDATA_API_KEY environment variable, and
// never reaches the browser. The page calls /api/quote on its own origin, so
// there is no CORS involved either.
//
// Set the key once in the Vercel dashboard:
//   Settings → Environment Variables → TWELVEDATA_API_KEY
// Get a free key at https://twelvedata.com/pricing (Basic plan).

// Only these symbols may be requested. Without a whitelist the endpoint is an
// open proxy and anyone could spend the account's 800 daily credits.
const ALLOWED = new Map([
  ['NVDA',  'NVIDIA'],
  ['AAPL',  'Apple'],
  ['MSFT',  'Microsoft'],
  ['GOOGL', 'Alphabet A'],
  ['AMZN',  'Amazon.com'],
  ['META',  'Meta Platforms'],
  ['AVGO',  'Broadcom'],
  ['TSLA',  'Tesla'],
  ['LLY',   'Eli Lilly'],
  ['MU',    'Micron Technology'],
  ['JPM',   'JPMorgan Chase'],
  ['V',     'Visa'],
]);

// The free plan allows 8 credits/minute and one quote costs one credit per
// symbol, so a single request can never ask for more than 8.
const MAX_SYMBOLS = 8;

// Serving a recent response instead of re-fetching keeps repeated loads — and
// several visitors at once — from burning the daily budget. Per-instance only;
// a cold start simply starts with an empty cache.
const CACHE_MS = 60_000;
let cache = { at: 0, key: '', body: null };

function toNum(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Twelve Data returns a bare object for one symbol and a symbol-keyed map for
// several. Normalise both into a list.
function toList(payload, symbols) {
  if (payload && payload.symbol) return [payload];
  return symbols.map((s) => payload && payload[s]).filter(Boolean);
}

function normalise(q) {
  const fw = q.fifty_two_week || {};
  return {
    symbol:   q.symbol,
    name:     ALLOWED.get(q.symbol) || q.name || q.symbol,
    exchange: q.exchange || null,
    currency: q.currency || 'USD',
    price:          toNum(q.close),
    change:         toNum(q.change),
    percent_change: toNum(q.percent_change),
    open:           toNum(q.open),
    high:           toNum(q.high),
    low:            toNum(q.low),
    previous_close: toNum(q.previous_close),
    volume:         toNum(q.volume),
    average_volume: toNum(q.average_volume),
    week52_low:     toNum(fw.low),
    week52_high:    toNum(fw.high),
    is_market_open: Boolean(q.is_market_open),
    datetime:       q.datetime || null,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'TWELVEDATA_API_KEY er ikke sat. Tilføj den under Vercel → Settings → Environment Variables.',
    });
  }

  // Fall back to the whole whitelist when the caller names no symbols.
  const requested = String(req.query.symbols || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const symbols = (requested.length ? requested.filter((s) => ALLOWED.has(s)) : [...ALLOWED.keys()])
    .slice(0, MAX_SYMBOLS);

  if (!symbols.length) {
    return res.status(400).json({
      error: 'bad_symbols',
      message: 'Ingen gyldige symboler. Tilladte: ' + [...ALLOWED.keys()].join(', '),
    });
  }

  const cacheKey = symbols.join(',');
  if (cache.body && cache.key === cacheKey && Date.now() - cache.at < CACHE_MS) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.body);
  }

  try {
    const url = 'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(cacheKey)
      + '&apikey=' + encodeURIComponent(apiKey);

    const upstream = await fetch(url, { headers: { accept: 'application/json' } });
    const payload = await upstream.json();

    // Twelve Data signals errors in the body with HTTP 200, so check the body
    // rather than upstream.ok. Never echo its message back verbatim — a Twelve
    // Data error can quote the request URL, and that carries the key.
    if (payload && payload.status === 'error') {
      const code = Number(payload.code) || 502;
      return res.status(code === 429 ? 429 : 502).json({
        error: code === 429 ? 'rate_limited' : 'upstream_error',
        message: code === 429
          ? 'Kvoten er brugt op (8 credits/min, 800/dag på gratisplanen). Prøv igen om lidt.'
          : 'Datakilden svarede med en fejl (kode ' + code + ').',
      });
    }

    const quotes = toList(payload, symbols).map(normalise);
    if (!quotes.length) {
      return res.status(502).json({ error: 'empty', message: 'Datakilden returnerede ingen kurser.' });
    }

    const body = { quotes, fetched_at: new Date().toISOString(), source: 'Twelve Data' };
    cache = { at: Date.now(), key: cacheKey, body };
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(body);
  } catch (err) {
    return res.status(502).json({ error: 'fetch_failed', message: 'Kunne ikke nå datakilden.' });
  }
};
