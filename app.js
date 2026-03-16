const STATE_KEY = 'moniverse_state_v1';

const CATEGORY_ORDER = ['美股', '港股', 'A股', '日股', '欧股', '黄金', '债券', '基金'];
const CATEGORY_COLORS = {
  '美股': '#5b8cff',
  '港股': '#ff8a00',
  'A股': '#2fbf71',
  '日股': '#ff6b6b',
  '欧股': '#8d6bff',
  '黄金': '#f5a524',
  '债券': '#1f6feb',
  '基金': '#6c7a90'
};

const API_CONFIG = {
  apiBase: 'https://white-pine-2b8e.renzo-xu.workers.dev',
  fxBase: 'https://white-pine-2b8e.renzo-xu.workers.dev'
};

let state = loadState();
let charts = {};

function loadState() {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) {
    return {
      accounts: [],
      assets: [],
      trades: [],
      settings: {
        displayCurrency: 'CNY',
        fx: { CNY: 1, USD: 6.9, HKD: 0.88, JPY: 0.04 }
      }
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return {
      accounts: [],
      assets: [],
      trades: [],
      settings: {
        displayCurrency: 'CNY',
        fx: { CNY: 1, USD: 6.9, HKD: 0.88, JPY: 0.04 }
      }
    };
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function formatMoney(value, currency = 'CNY') {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
  return `${sign}${symbol}${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function convertToDisplay(value, fromCurrency) {
  const fx = state.settings.fx || { CNY: 1 };
  const target = state.settings.displayCurrency;
  if (!fx[fromCurrency] || !fx[target]) return value;
  const cnyValue = fromCurrency === 'CNY' ? value : value * fx[fromCurrency];
  if (target === 'CNY') return cnyValue;
  return cnyValue / fx[target];
}

function toCny(value, fromCurrency) {
  const fx = state.settings.fx || { CNY: 1 };
  if (!fx[fromCurrency]) return value;
  return fromCurrency === 'CNY' ? value : value * fx[fromCurrency];
}

function getAverageCost(assetId) {
  const trades = state.trades.filter(t => t.assetId === assetId);
  if (!trades.length) return null;
  const totalQty = trades.reduce((sum, t) => sum + Number(t.qty || 0), 0);
  if (!totalQty) return null;
  const totalCost = trades.reduce((sum, t) => sum + Number(t.qty || 0) * Number(t.price || 0), 0);
  return { qty: totalQty, cost: totalCost / totalQty };
}

function computeAssetMetrics(asset) {
  const avg = getAverageCost(asset.id);
  const qty = avg ? avg.qty : Number(asset.quantity || 0);
  const cost = avg ? avg.cost : Number(asset.cost || 0);
  const price = Number(asset.price || cost || 0);
  const marketValue = price * qty;
  const pnl = (price - cost) * qty;
  const ret = cost ? pnl / (cost * qty) : 0;
  return { qty, cost, price, marketValue, pnl, ret };
}

function classifyAsset(asset) {
  if (asset.tag) return asset.tag;
  const market = (asset.market || '').toUpperCase();
  if (market.includes('US')) return '美股';
  if (market.includes('HK')) return '港股';
  if (market.includes('CN') || market.includes('SH') || market.includes('SZ')) return 'A股';
  if (market.includes('JP')) return '日股';
  if (market.includes('EU') || market.includes('FR') || market.includes('DE')) return '欧股';
  if (market.includes('GOLD')) return '黄金';
  if (market.includes('BOND')) return '债券';
  if (market.includes('FUND')) return '基金';
  return '未分类';
}

function renderAccounts() {
  const tbody = document.querySelector('#accounts-table tbody');
  tbody.innerHTML = '';

  const totals = { principal: 0, cash: 0, holding: 0, holdingPnl: 0, assets: 0 };

  state.accounts.forEach(acc => {
    const assets = state.assets.filter(a => a.accountId === acc.id);
    const holding = assets.reduce((sum, a) => sum + toCny(computeAssetMetrics(a).marketValue, a.currency || 'CNY'), 0);
    const holdingPnl = assets.reduce((sum, a) => sum + toCny(computeAssetMetrics(a).pnl, a.currency || 'CNY'), 0);
    const accountValue = Number(acc.cash || 0) + holding;
    const totalPnl = accountValue - Number(acc.principal || 0);
    const totalReturn = acc.principal ? totalPnl / Number(acc.principal) : 0;

    totals.principal += Number(acc.principal || 0);
    totals.cash += Number(acc.cash || 0);
    totals.holding += holding;
    totals.holdingPnl += holdingPnl;
    totals.assets += accountValue;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${acc.name}</td>
      <td>${formatMoney(convertToDisplay(acc.principal || 0, 'CNY'), state.settings.displayCurrency)}</td>
      <td>${formatMoney(convertToDisplay(acc.cash || 0, 'CNY'), state.settings.displayCurrency)}</td>
      <td>${formatMoney(convertToDisplay(holding, 'CNY'), state.settings.displayCurrency)}</td>
      <td class="${holdingPnl >= 0 ? 'positive' : 'negative'}">${formatMoney(convertToDisplay(holdingPnl, 'CNY'), state.settings.displayCurrency)}</td>
      <td>${formatMoney(convertToDisplay(accountValue, 'CNY'), state.settings.displayCurrency)}</td>
      <td class="${totalPnl >= 0 ? 'positive' : 'negative'}">${formatMoney(convertToDisplay(totalPnl, 'CNY'), state.settings.displayCurrency)}</td>
      <td class="${totalReturn >= 0 ? 'positive' : 'negative'}">${(totalReturn * 100).toFixed(2)}%</td>
      <td><button data-action="remove-account" data-id="${acc.id}">删除</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelector('#total-assets').textContent = formatMoney(convertToDisplay(totals.assets, 'CNY'), state.settings.displayCurrency);
  document.querySelector('#total-pnl').textContent = formatMoney(convertToDisplay(totals.assets - totals.principal, 'CNY'), state.settings.displayCurrency);
  document.querySelector('#total-principal').textContent = formatMoney(convertToDisplay(totals.principal, 'CNY'), state.settings.displayCurrency);
}

function renderAssets() {
  const tbody = document.querySelector('#assets-table tbody');
  tbody.innerHTML = '';

  const grouped = {};
  CATEGORY_ORDER.forEach(cat => grouped[cat] = []);
  state.assets.forEach(asset => {
    const category = classifyAsset(asset);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(asset);
  });

  Object.entries(grouped).forEach(([category, assets]) => {
    if (!assets.length) return;
    const metrics = assets.map(computeAssetMetrics);
    const totalValue = assets.reduce((sum, a, i) => sum + toCny(metrics[i].marketValue, a.currency || 'CNY'), 0);
    const totalPnl = assets.reduce((sum, a, i) => sum + toCny(metrics[i].pnl, a.currency || 'CNY'), 0);
    const totalReturn = totalValue ? totalPnl / totalValue : 0;

    const header = document.createElement('tr');
    header.className = 'group-row';
    header.innerHTML = `
      <td colspan="6"><span class="badge" style="background:${CATEGORY_COLORS[category] || '#eef2f7'}">${category}</span></td>
      <td>${formatMoney(convertToDisplay(totalValue, 'CNY'), state.settings.displayCurrency)}</td>
      <td class="${totalPnl >= 0 ? 'positive' : 'negative'}">${formatMoney(convertToDisplay(totalPnl, 'CNY'), state.settings.displayCurrency)}</td>
      <td class="${totalPnl >= 0 ? 'positive' : 'negative'}">${(totalReturn * 100).toFixed(2)}%</td>
      <td colspan="2"></td>
    `;
    tbody.appendChild(header);

    assets.forEach(asset => {
      const m = computeAssetMetrics(asset);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td title="${asset.displayName || asset.nameOrCode}">${truncateName(asset.displayName || asset.nameOrCode)}</td>
        <td>${accountName(asset.accountId)}</td>
        <td>${asset.currency || '-'}</td>
        <td>${m.qty}</td>
        <td>${m.cost.toFixed(2)}</td>
        <td>${m.price.toFixed(2)}</td>
        <td>${formatMoney(convertToDisplay(m.marketValue, asset.currency || 'CNY'), state.settings.displayCurrency)}</td>
        <td class="${m.pnl >= 0 ? 'positive' : 'negative'}">${formatMoney(convertToDisplay(m.pnl, asset.currency || 'CNY'), state.settings.displayCurrency)}</td>
        <td class="${m.pnl >= 0 ? 'positive' : 'negative'}">${(m.ret * 100).toFixed(2)}%</td>
        <td>${classifyAsset(asset)}</td>
        <td><button data-action="remove-asset" data-id="${asset.id}">删除</button></td>
      `;
      tbody.appendChild(row);
    });
  });
}

function renderTrades() {
  const tbody = document.querySelector('#trades-table tbody');
  tbody.innerHTML = '';
  state.trades.forEach(trade => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${assetName(trade.assetId)}</td>
      <td>${trade.qty}</td>
      <td>${trade.price}</td>
      <td>${trade.date || ''}</td>
      <td><button data-action="remove-trade" data-id="${trade.id}">删除</button></td>
    `;
    tbody.appendChild(row);
  });
}

function renderCharts() {
  const categoryTotals = CATEGORY_ORDER.map(cat => {
    const assets = state.assets.filter(a => classifyAsset(a) === cat);
    return assets.reduce((sum, a) => sum + toCny(computeAssetMetrics(a).marketValue, a.currency || 'CNY'), 0);
  });

  const currencyMap = {};
  state.assets.forEach(a => {
    const m = computeAssetMetrics(a);
    const curr = a.currency || 'CNY';
    currencyMap[curr] = (currencyMap[curr] || 0) + toCny(m.marketValue, curr);
  });

  const accountMap = {};
  state.assets.forEach(a => {
    const m = computeAssetMetrics(a);
    const name = accountName(a.accountId);
    accountMap[name] = (accountMap[name] || 0) + toCny(m.marketValue, a.currency || 'CNY');
  });

  const chartData = [
    { id: 'chart-category', labels: CATEGORY_ORDER, data: categoryTotals, colors: CATEGORY_ORDER.map(c => CATEGORY_COLORS[c]) },
    { id: 'chart-currency', labels: Object.keys(currencyMap), data: Object.values(currencyMap), colors: ['#ff6b6b', '#f5a524', '#1f6feb', '#2fbf71', '#6c7a90'] },
    { id: 'chart-account', labels: Object.keys(accountMap), data: Object.values(accountMap), colors: ['#5b8cff', '#8d6bff', '#ff8a00', '#2fbf71', '#1f6feb'] }
  ];

  chartData.forEach(cfg => {
    if (charts[cfg.id]) charts[cfg.id].destroy();
    const ctx = document.getElementById(cfg.id);
    charts[cfg.id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cfg.labels,
        datasets: [{ data: cfg.data, backgroundColor: cfg.colors }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  });
}

function accountName(id) {
  return state.accounts.find(a => a.id === id)?.name || '-';
}

function assetName(id) {
  return state.assets.find(a => a.id === id)?.displayName || state.assets.find(a => a.id === id)?.nameOrCode || '-';
}

function truncateName(name) {
  if (!name) return '-';
  return name.length > 6 ? `${name.slice(0, 6)}…` : name;
}

async function refreshData() {
  await updateFxRates();
  for (const asset of state.assets) {
    if (!asset.symbol) continue;
    const quote = await fetchQuote(asset.symbol);
    if (quote) {
      asset.price = quote.price;
      asset.currency = quote.currency || asset.currency;
      asset.market = quote.market || asset.market;
      asset.displayName = quote.name || asset.displayName;
      asset.updatedAt = new Date().toISOString();
    }
  }
  saveState();
  renderAll();
}

async function fetchQuote(symbol) {
  if (!API_CONFIG.apiBase) return null;
  try {
    const res = await fetch(`${API_CONFIG.apiBase}/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchSearch(query) {
  if (!API_CONFIG.apiBase) return [];
  try {
    const res = await fetch(`${API_CONFIG.apiBase}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function updateFxRates() {
  if (!API_CONFIG.fxBase) return;
  try {
  const res = await fetch(`${API_CONFIG.fxBase}/fx?base=CNY`);
    if (!res.ok) return;
    const data = await res.json();
    state.settings.fx = { CNY: 1, USD: data.rates.USD, HKD: data.rates.HKD, JPY: data.rates.JPY };
    const usdEl = document.getElementById('fx-usd');
    const hkdEl = document.getElementById('fx-hkd');
    const jpyEl = document.getElementById('fx-jpy');
    if (usdEl) usdEl.textContent = state.settings.fx.USD.toFixed(2);
    if (hkdEl) hkdEl.textContent = state.settings.fx.HKD.toFixed(2);
    if (jpyEl) jpyEl.textContent = state.settings.fx.JPY.toFixed(2);
  } catch {}
}

function bindEvents() {
  document.getElementById('add-account').addEventListener('click', () => {
    const name = document.getElementById('account-name').value.trim();
    const principal = Number(document.getElementById('account-principal').value || 0);
    const cash = Number(document.getElementById('account-cash').value || 0);
    if (!name) return;
    state.accounts.push({ id: crypto.randomUUID(), name, principal, cash });
    saveState();
    renderAll();
    document.getElementById('account-name').value = '';
    document.getElementById('account-principal').value = '';
    document.getElementById('account-cash').value = '';
  });

  document.getElementById('accounts-table').addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (action === 'remove-account') {
      const id = e.target.dataset.id;
      state.accounts = state.accounts.filter(a => a.id !== id);
      state.assets = state.assets.filter(a => a.accountId !== id);
      saveState();
      renderAll();
    }
  });

  document.getElementById('add-asset').addEventListener('click', () => {
    const input = document.getElementById('asset-search');
    const nameOrCode = input.value.trim();
    const accountId = document.getElementById('asset-account').value;
    const quantity = Number(document.getElementById('asset-qty').value || 0);
    const cost = Number(document.getElementById('asset-cost').value || 0);
    const tag = document.getElementById('asset-tag').value;
    if (!nameOrCode || !accountId) return;

    state.assets.push({
      id: crypto.randomUUID(),
      nameOrCode,
      symbol: input.dataset.symbol || nameOrCode,
      displayName: input.dataset.name || nameOrCode,
      accountId,
      quantity,
      cost,
      tag,
      currency: input.dataset.currency || 'CNY',
      market: input.dataset.market || ''
    });
    saveState();
    renderAll();
    input.value = '';
    input.dataset.symbol = '';
    input.dataset.name = '';
  });

  document.getElementById('assets-table').addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (action === 'remove-asset') {
      const id = e.target.dataset.id;
      state.assets = state.assets.filter(a => a.id !== id);
      state.trades = state.trades.filter(t => t.assetId !== id);
      saveState();
      renderAll();
    }
  });

  document.getElementById('add-trade').addEventListener('click', () => {
    const assetId = document.getElementById('trade-asset').value;
    const qty = Number(document.getElementById('trade-qty').value || 0);
    const price = Number(document.getElementById('trade-price').value || 0);
    const date = document.getElementById('trade-date').value;
    if (!assetId || !qty || !price) return;
    state.trades.push({ id: crypto.randomUUID(), assetId, qty, price, date });
    saveState();
    renderAll();
    document.getElementById('trade-qty').value = '';
    document.getElementById('trade-price').value = '';
    document.getElementById('trade-date').value = '';
  });

  document.getElementById('trades-table').addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (action === 'remove-trade') {
      const id = e.target.dataset.id;
      state.trades = state.trades.filter(t => t.id !== id);
      saveState();
      renderAll();
    }
  });

  document.getElementById('refresh').addEventListener('click', refreshData);

  document.getElementById('display-currency').addEventListener('change', e => {
    state.settings.displayCurrency = e.target.value;
    saveState();
    renderAll();
  });

  document.getElementById('export-csv').addEventListener('click', exportCsv);
  document.getElementById('import-csv').addEventListener('click', () => document.getElementById('csv-file').click());
  document.getElementById('csv-file').addEventListener('change', importCsv);

  const searchInput = document.getElementById('asset-search');
  const suggestions = document.getElementById('asset-suggestions');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    const query = searchInput.value.trim();
    if (!query) {
      suggestions.style.display = 'none';
      return;
    }
    debounce = setTimeout(async () => {
      const results = await fetchSearch(query);
      suggestions.innerHTML = '';
      results.forEach(r => {
        const item = document.createElement('div');
        item.className = 'item';
        item.textContent = `${r.name} (${r.symbol}) - ${r.market}`;
        item.addEventListener('click', () => {
          searchInput.value = r.name;
          searchInput.dataset.symbol = r.symbol;
          searchInput.dataset.name = r.name;
          searchInput.dataset.currency = r.currency;
          searchInput.dataset.market = r.market;
          suggestions.style.display = 'none';
        });
        suggestions.appendChild(item);
      });
      suggestions.style.display = results.length ? 'block' : 'none';
    }, 300);
  });

  document.addEventListener('click', e => {
    if (!document.querySelector('.lookup').contains(e.target)) {
      document.getElementById('asset-suggestions').style.display = 'none';
    }
  });
}

function exportCsv() {
  const lines = [];
  const esc = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('\"') || str.includes('\n')) {
      return `\"${str.replace(/\"/g, '\"\"')}\"`;
    }
    return str;
  };
  lines.push('#ACCOUNTS');
  lines.push('id,name,principal,cash');
  state.accounts.forEach(a => {
    lines.push([a.id, a.name, a.principal, a.cash].map(esc).join(','));
  });
  lines.push('#ASSETS');
  lines.push('id,nameOrCode,symbol,accountId,quantity,cost,tag,currency,market');
  state.assets.forEach(a => {
    lines.push([a.id, a.nameOrCode, a.symbol, a.accountId, a.quantity, a.cost, a.tag || '', a.currency || '', a.market || ''].map(esc).join(','));
  });
  lines.push('#TRADES');
  lines.push('id,assetId,qty,price,date');
  state.trades.forEach(t => {
    lines.push([t.id, t.assetId, t.qty, t.price, t.date || ''].map(esc).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'moniverse_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    let section = '';
    state.accounts = [];
    state.assets = [];
    state.trades = [];
    for (const line of lines) {
      if (line.startsWith('#')) {
        section = line.replace('#', '').trim();
        continue;
      }
      if (line.startsWith('id,')) continue;
      const parts = parseCsvLine(line);
      if (section === 'ACCOUNTS') {
        const [id, name, principal, cash] = parts;
        state.accounts.push({ id, name, principal: Number(principal), cash: Number(cash) });
      }
      if (section === 'ASSETS') {
        const [id, nameOrCode, symbol, accountId, quantity, cost, tag, currency, market] = parts;
        state.assets.push({ id, nameOrCode, symbol, accountId, quantity: Number(quantity), cost: Number(cost), tag, currency, market });
      }
      if (section === 'TRADES') {
        const [id, assetId, qty, price, date] = parts;
        state.trades.push({ id, assetId, qty: Number(qty), price: Number(price), date });
      }
    }
    saveState();
    renderAll();
  };
  reader.readAsText(file);
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\"') {
      if (inQuotes && line[i + 1] === '\"') {
        current += '\"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function renderAll() {
  syncAccountOptions();
  syncTradeOptions();
  renderAccounts();
  renderAssets();
  renderTrades();
  renderCharts();
}

function syncAccountOptions() {
  const select = document.getElementById('asset-account');
  select.innerHTML = '';
  state.accounts.forEach(acc => {
    const option = document.createElement('option');
    option.value = acc.id;
    option.textContent = acc.name;
    select.appendChild(option);
  });
}

function syncTradeOptions() {
  const select = document.getElementById('trade-asset');
  select.innerHTML = '';
  state.assets.forEach(asset => {
    const option = document.createElement('option');
    option.value = asset.id;
    option.textContent = asset.displayName || asset.nameOrCode;
    select.appendChild(option);
  });
}

function init() {
  document.getElementById('display-currency').value = state.settings.displayCurrency || 'CNY';
  const usdEl = document.getElementById('fx-usd');
  const hkdEl = document.getElementById('fx-hkd');
  const jpyEl = document.getElementById('fx-jpy');
  if (usdEl) usdEl.textContent = (state.settings.fx?.USD || 0).toFixed(2);
  if (hkdEl) hkdEl.textContent = (state.settings.fx?.HKD || 0).toFixed(2);
  if (jpyEl) jpyEl.textContent = (state.settings.fx?.JPY || 0).toFixed(2);
  renderAll();
  bindEvents();
}

init();
