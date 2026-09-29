const https = require('https');

function fetchText(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'LocalMind-AI/9.3 (+desktop research)',
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
      }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchText(response.headers.location, timeout).then(resolve, reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        data += chunk;
        if (data.length > 800000) response.destroy();
      });
      response.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
    .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\s+/g, ' ')
    .trim();
}

function extractGoogle(html) {
  return stripHtml(html)
    .replace(/Google Search/gi, '')
    .slice(0, 9000);
}

function extractBing(html) {
  return stripHtml(html)
    .replace(/Bing/gi, '')
    .slice(0, 9000);
}

async function google(query) {
  return extractGoogle(await fetchText(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`));
}

async function bing(query) {
  return extractBing(await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`));
}

async function wikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
  const raw = await fetchText(url);
  const json = JSON.parse(raw);
  return (json.query?.search || []).map(item => {
    const text = stripHtml(item.snippet || '');
    return `${item.title}: ${text}`;
  }).join('\n');
}

async function searchWeb(query) {
  const sources = await Promise.allSettled([
    google(query),
    bing(query),
    wikipedia(query)
  ]);
  const names = ['Google', 'Bing', 'Wikipedia'];
  const parts = [];
  sources.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      parts.push(`SOURCE: ${names[index]}\n${result.value.slice(0, 9000)}`);
    }
  });
  if (!parts.length) throw new Error('Не удалось получить данные ни из одного поискового источника.');
  return parts.join('\n\n---\n\n').slice(0, 26000);
}

module.exports = { searchWeb };
