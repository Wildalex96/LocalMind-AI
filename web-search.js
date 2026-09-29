const https = require('https');
const { verifyEvidence } = require('./truth-engine');

function fetchText(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'LocalMind-AI/9.3 research', Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) return fetchText(response.headers.location, timeout).then(resolve, reject);
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
      let data = ''; response.setEncoding('utf8'); response.on('data', chunk => { data += chunk; if (data.length > 800000) response.destroy(); }); response.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout'))); req.on('error', reject);
  });
}
function stripHtml(html) { return String(html).replace(/<script[\\s\\S]*?<\\/script>/gi,' ').replace(/<style[\\s\\S]*?<\\/style>/gi,' ').replace(/<noscript[\\s\\S]*?<\\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\\s+/g,' ').trim(); }
function getJson(url, timeout=15000) { return fetchText(url,timeout).then(JSON.parse); }
async function google(query){return `SOURCE: Google\\n${stripHtml(await fetchText(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`)).slice(0,7000)}`;}
async function bing(query){return `SOURCE: Bing\\n${stripHtml(await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`)).slice(0,7000)}`;}
async function wikipedia(query){const j=await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`);return `SOURCE: Wikipedia\\n${(j.query?.search||[]).map(x=>`${x.title}: ${stripHtml(x.snippet||'')}`).join('\\n').slice(0,7000)}`;}
async function arxiv(query){const raw=await fetchText(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5`);return `SOURCE: arXiv\\n${stripHtml(raw).slice(0,7000)}`;}
async function crossref(query){const j=await getJson(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=5`);return `SOURCE: Crossref\\n${(j.message?.items||[]).map(x=>`${x.title?.[0]||''} | DOI:${x.DOI||''} | ${x.published?.['date-parts']?.[0]?.join('-')||''}`).join('\\n').slice(0,7000)}`;}
async function pubmed(query){const j=await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5`);const ids=j.esearchresult?.idlist||[];if(!ids.length)return 'SOURCE: PubMed\\nNo matching records';const s=await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);return `SOURCE: PubMed\\n${ids.map(id=>`${s.result?.[id]?.title||''} | ${s.result?.[id]?.pubdate||''} | PMID:${id}`).join('\\n')}`;}

async function searchWeb(query){
  const results=await Promise.allSettled([google(query),bing(query),wikipedia(query),arxiv(query),crossref(query),pubmed(query)]);
  const parts=results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);
  if(!parts.length)throw new Error('Не удалось получить данные из доступных источников.');
  const evidence=parts.join('\\n\\n---\\n\\n').slice(0,38000);
  let verification;
  try { verification = await verifyEvidence(query, evidence); } catch (e) { verification = { status:'UNVERIFIED', reason:`Verifier error: ${e.message}`, verifiers:{openai:false,gemini:false} }; }
  const independentSources=parts.length;
  const sourceStatus=independentSources>=5?'HIGH_CORROBORATION':independentSources>=3?'CORROBORATED':'INSUFFICIENT_EVIDENCE';
  const strictRule='STRICT MODE: LocalMind must never present a claim as established fact unless CLAIM-LEVEL VERIFICATION is VERIFIED. If status is UNVERIFIED or CONFLICTING, answer that the evidence is insufficient/conflicting and do not guess.';
  const verifierSummary=`CLAIM-LEVEL VERIFICATION: ${verification.status}\\nSOURCE CORROBORATION: ${sourceStatus}\\nINDEPENDENT SOURCE GROUPS: ${independentSources}\\nVERIFIERS: OpenAI=${verification.verifiers.openai ? 'OK':'MISSING'}; Gemini=${verification.verifiers.gemini ? 'OK':'MISSING'}\\nVERIFIER REASON: ${verification.reason}\\n${verification.claims?.length ? `VERIFIED CLAIMS:\\n${verification.claims.map(c=>`- ${c.claim} [confidence ${c.confidence}] [${c.support.join(', ')}]`).join('\\n')}` : 'VERIFIED CLAIMS: none'}\\n${strictRule}`;
  return `${verifierSummary}\\n\\n${evidence}`.slice(0,45000);
}
module.exports={searchWeb};
