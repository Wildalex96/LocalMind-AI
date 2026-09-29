const https = require('https');

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'LocalMind-AI/9.3 CryptoEngine', Accept: 'application/json', ...headers } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON response')); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
  });
}

function sma(values, period) { return values.map((_, i) => i + 1 < period ? null : values.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period); }
function ema(values, period) { const out = Array(values.length).fill(null), k = 2 / (period + 1); if (values.length < period) return out; let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period; out[period - 1] = prev; for (let i = period; i < values.length; i++) { prev = values[i] * k + prev * (1 - k); out[i] = prev; } return out; }
function rsi(values, period = 14) { const out = Array(values.length).fill(null); if (values.length <= period) return out; let gains = 0, losses = 0; for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; if (d >= 0) gains += d; else losses -= d; } let avgGain = gains / period, avgLoss = losses / period; out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); for (let i = period + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period; out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); } return out; }

async function market(symbol = 'BTCUSDT', interval = '1d', limit = 365) { const rows = await requestJson(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol.toUpperCase())}&interval=${encodeURIComponent(interval)}&limit=${Math.min(limit, 1000)}`); const candles = rows.map(r => ({ time: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] })); const closes = candles.map(c => c.close); return { source: 'Binance public market API', symbol, interval, candles, indicators: { sma20: sma(closes, 20).at(-1), sma50: sma(closes, 50).at(-1), ema20: ema(closes, 20).at(-1), rsi14: rsi(closes).at(-1) } }; }

async function coin(symbol = 'bitcoin') { const data = await requestJson(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(symbol)}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true`); return { source: 'CoinGecko', id: data.id, market: data.market_data, community: data.community_data, developer: data.developer_data }; }
async function defillama(protocol) { const url = protocol ? `https://api.llama.fi/protocol/${encodeURIComponent(protocol)}` : 'https://api.llama.fi/protocols'; return { source: 'DefiLlama', data: await requestJson(url) }; }
async function etherscan(address, chainid = '1') { const key = process.env.ETHERSCAN_API_KEY; if (!key) throw new Error('ETHERSCAN_API_KEY не задан'); const data = await requestJson(`https://api.etherscan.io/v2/api?chainid=${encodeURIComponent(chainid)}&module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest&apikey=${encodeURIComponent(key)}`); return { source: 'Etherscan', address, chainid, data }; }
async function alchemy(address, network = 'eth-mainnet') { const key = process.env.ALCHEMY_API_KEY; if (!key) throw new Error('ALCHEMY_API_KEY не задан'); const data = await requestJson(`https://${encodeURIComponent(network)}.g.alchemy.com/v2/${encodeURIComponent(key)}`, { 'content-type': 'application/json' }); return { source: 'Alchemy', address, network, data }; }
async function news(query = 'bitcoin cryptocurrency', limit = 10) { return { source: 'Google News search', query, url: `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(query)}&num=${Math.min(limit, 20)}` }; }

function backtest(candles, strategy = {}) { const fast = strategy.fast || 20, slow = strategy.slow || 50, fee = strategy.fee ?? 0.001; const closes = candles.map(c => c.close), fastE = ema(closes, fast), slowE = ema(closes, slow); let cash = 1, units = 0, trades = 0, entry = null, peak = 1, maxDrawdown = 0; for (let i = 1; i < candles.length; i++) { if (fastE[i] == null || slowE[i] == null || fastE[i - 1] == null || slowE[i - 1] == null) continue; const up = fastE[i] > slowE[i] && fastE[i - 1] <= slowE[i - 1], down = fastE[i] < slowE[i] && fastE[i - 1] >= slowE[i - 1]; if (!units && up) { units = cash * (1 - fee) / closes[i]; cash = 0; entry = closes[i]; trades++; } if (units && down) { cash = units * closes[i] * (1 - fee); units = 0; entry = null; trades++; } const equity = cash + units * closes[i]; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak); } const finalEquity = cash + units * closes.at(-1); return { strategy: { fast, slow, fee }, initial: 1, final: finalEquity, returnPct: (finalEquity - 1) * 100, trades, maxDrawdownPct: maxDrawdown * 100, openPosition: !!units, lastEntry: entry }; }

function paperTrade(candles, strategy = {}, initialCash = 10000) { const result = backtest(candles, strategy); return { mode: 'paper', simulatedOnly: true, initialCash, simulatedFinalCash: initialCash * result.final, ...result, warning: 'No real orders are submitted. Live trading is intentionally disabled.' }; }

module.exports = { market, coin, onchain: coin, defillama, etherscan, alchemy, news, backtest, paperTrade, indicators: { sma, ema, rsi } };
