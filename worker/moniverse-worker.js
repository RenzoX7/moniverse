const FUND_LIST_URL = 'https://fund.eastmoney.com/js/fundcode_search.js';
const FUND_QUOTE_URL = 'https://fundgz.1234567.com.cn/js/';
const EASTMONEY_STOCK_URL = 'https://push2.eastmoney.com/api/qt/stock/get';
const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
const FX_URL = 'https://open.er-api.com/v6/latest/';

let cachedFundList = null;
let cachedFundListAt = 0;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === '/search') {
        return await handleSearch(url);
      }
      if (url.pathname === '/quote') {
        return await handleQuote(url);
      }
      if (url.pathname === '/fx') {
        return await handleFx(url);
      }
      return json({ error: 'not_found' }, 404);
    } catch (err) {
      return json({ error: 'internal_error', message: err?.message || 'unknown' }, 500);
    }
  }
};

async function handleSearch(url) {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) return json({ results: [] });

  const results = [];

  if (/^\d{5,6}$/.test(query)) {
    const fundMatches = await searchFundList(query);
    fundMatches.forEach(f => results.push(f));
  }

  const yahoo = await searchYahoo(query);
  yahoo.forEach(item => results.push(item));

  return json({ results: dedupeResults(results) });
}

async function handleQuote(url) {
  const symbol = (url.searchParams.get('symbol') || '').trim();
  if (!symbol) return json({ error: 'missing_symbol' }, 400);

  if (/^\d{6}$/.test(symbol)) {
    const fund = await quoteFund(symbol);
    if (fund) return json(fund);

    const stock = await quoteAStock(symbol);
    if (stock) return json(stock);
  }

  const yahoo = await quoteYahoo(symbol);
  if (yahoo) return json(yahoo);

  return json({ error: 'not_found' }, 404);
}

async function handleFx(url) {
  const base = (url.searchParams.get('base') || 'CNY').toUpperCase();
  const res = await fetch(`${FX_URL}${encodeURIComponent(base)}`);
  if (!res.ok) return json({ error: 'fx_unavailable' }, 502);
  const data = await res.json();
  return json({
    base: data.base_code,
    rates: {
      USD: data.rates.USD,
      HKD: data.rates.HKD,
      JPY: data.rates.JPY,
      CNY: data.base_code === 'CNY' ? 1 : data.rates.CNY
    }
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function searchYahoo(query) {
  const res = await fetch(`${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const quotes = data.quotes || [];
  return quotes
    .filter(q => q.symbol)
    .slice(0, 8)
    .map(q => ({
      name: q.shortname || q.longname || q.symbol,
      symbol: q.symbol,
      market: q.exchDisp || q.exchange || '',
      currency: q.currency || ''
    }));
}

async function quoteYahoo(symbol) {
  const res = await fetch(`${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(symbol)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const quote = data.quoteResponse?.result?.[0];
  if (!quote) return null;
  return {
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || quote.symbol,
    price: quote.regularMarketPrice,
    currency: quote.currency || '',
    market: quote.fullExchangeName || quote.exchange || ''
  };
}

async function loadFundList() {
  const now = Date.now();
  if (cachedFundList && now - cachedFundListAt < 12 * 60 * 60 * 1000) {
    return cachedFundList;
  }
  const res = await fetch(FUND_LIST_URL);
  if (!res.ok) return [];
  const text = await res.text();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  const jsonText = text.slice(start, end + 1);
  let data = [];
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }
  cachedFundList = data;
  cachedFundListAt = now;
  return data;
}

async function searchFundList(query) {
  const list = await loadFundList();
  const results = [];
  list.forEach(item => {
    const [code, abbr, name] = item;
    if (code.includes(query) || (name && name.includes(query)) || (abbr && abbr.includes(query))) {
      results.push({
        name: name || abbr || code,
        symbol: code,
        market: '基金',
        currency: 'CNY'
      });
    }
  });
  return results.slice(0, 8);
}

async function quoteFund(code) {
  const res = await fetch(`${FUND_QUOTE_URL}${code}.js`);
  if (!res.ok) return null;
  const text = await res.text();
  const start = text.indexOf('jsonpgz(');
  const end = text.lastIndexOf(');');
  if (start === -1 || end === -1) return null;
  const jsonText = text.slice(start + 8, end);
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return null;
  }
  return {
    symbol: code,
    name: data.name || code,
    price: Number(data.gsz || data.dwjz || 0),
    currency: 'CNY',
    market: '基金'
  };
}

async function quoteAStock(code) {
  const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
  const params = new URLSearchParams({
    secid,
    fields: 'f43,f57,f58'
  });
  const res = await fetch(`${EASTMONEY_STOCK_URL}?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data?.data;
  if (!raw) return null;
  let price = Number(raw.f43 || 0);
  if (price > 1000) price = price / 100;
  return {
    symbol: raw.f57 || code,
    name: raw.f58 || code,
    price,
    currency: 'CNY',
    market: code.startsWith('6') ? 'A股' : 'A股'
  };
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter(item => {
    const key = `${item.symbol}-${item.market}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
