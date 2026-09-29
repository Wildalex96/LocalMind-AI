const https = require('https');

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
async function google(query){return `SOURCE: Google\n${stripHtml(await fetchText(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`)).slice(0,7000)}`;}
async function bing(query){return `SOURCE: Bing\n${stripHtml(await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`)).slice(0,7000)}`;}
async function wikipedia(query){const j=await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`);return `SOURCE: Wikipedia\n${(j.query?.search||[]).map(x=>`${x.title}: ${stripHtml(x.snippet||'')}`).join('\n').slice(0,7000)}`;}
async function arxiv(query){const raw=await fetchText(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5`);return `SOURCE: arXiv\n${stripHtml(raw).slice(0,7000)}`;}
async function crossref(query){const j=await getJson(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=5`);return `SOURCE: Crossref\n${(j.message?.items||[]).map(x=>`${x.title?.[0]||''} | DOI:${x.DOI||''} | ${x.published?.['date-parts']?.[0]?.join('-')||''}`).join('\n').slice(0,7000)}`;}
async function pubmed(query){const j=await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5`);const ids=j.esearchresult?.idlist||[];if(!ids.length)return 'SOURCE: PubMed\nNo matching records';const s=await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);return `SOURCE: PubMed\n${ids.map(id=>`${s.result?.[id]?.title||''} | ${s.result?.[id]?.pubdate||''} | PMID:${id}`).join('\n')}`;}
async function optionalAiReview(evidence,query){const out=[];if(process.env.OPENAI_API_KEY){try{const j=await postJson('https://api.openai.com/v1/chat/completions',{model:'gpt-4o-mini',messages:[{role:'system',content:'Independent fact checker. Do not guess. Compare evidence, identify contradictions, missing support, and return a concise verdict. You are a verifier, not an authority.'},{role:'user',content:`QUESTION:\n${query}\nEVIDENCE:\n${evidence}`}],temperature:0},{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`});out.push(`AI REVIEW: OpenAI\n${j.choices?.[0]?.message?.content||''}`);}catch(e){out.push(`AI REVIEW: OpenAI unavailable (${e.message})`);}}
if(process.env.GEMINI_API_KEY){try{const j=await postJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{contents:[{parts:[{text:`Independent fact checker. Do not guess. Compare evidence, identify contradictions and missing support.\nQUESTION:\n${query}\nEVIDENCE:\n${evidence}`}]}]});out.push(`AI REVIEW: Gemini\n${j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||''}`);}catch(e){out.push(`AI REVIEW: Gemini unavailable (${e.message})`);}}
return out;}
function postJson(url,body,headers={}){return new Promise((resolve,reject)=>{const u=new URL(url),data=JSON.stringify(body);const req=https.request({hostname:u.hostname,port:u.port||443,path:u.pathname+u.search,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),...headers}},r=>{let s='';r.setEncoding('utf8');r.on('data',c=>s+=c);r.on('end',()=>{if(r.statusCode<200||r.statusCode>=300)return reject(new Error(`HTTP ${r.statusCode}`));try{resolve(JSON.parse(s));}catch(e){reject(e);}})});req.setTimeout(25000,()=>req.destroy(new Error('timeout')));req.on('error',reject);req.write(data);req.end();});}
async function searchWeb(query){
  const results=await Promise.allSettled([google(query),bing(query),wikipedia(query),arxiv(query),crossref(query),pubmed(query)]);
  const parts=results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);
  if(!parts.length)throw new Error('Не удалось получить данные из доступных источников.');
  const evidence=parts.join('\n\n---\n\n').slice(0,38000);
  const reviews=await optionalAiReview(evidence,query);
  const independentSources=parts.length;
  const status=independentSources>=5?'HIGH_CORROBORATION':independentSources>=3?'CORROBORATED':'INSUFFICIENT_EVIDENCE';
  const verification=`VERIFICATION STATUS: ${status}\nINDEPENDENT SOURCES: ${independentSources}\nRULE: Never present an unsupported claim as certain. If sources conflict or evidence is insufficient, explicitly say that the answer is uncertain and explain what is missing. Prefer primary/official/research sources over aggregators. AI reviews are advisory evidence, not proof.\n\n${evidence}${reviews.length?'\n\n---\n\n'+reviews.join('\n\n---\n\n'):''}`;
  return verification.slice(0,45000);
}
module.exports={searchWeb};
