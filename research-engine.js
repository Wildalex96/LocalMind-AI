const https = require('https');
const { searchWeb } = require('./web-search');

function httpJson(url, body, headers = {}, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body == null ? null : JSON.stringify(body);
    const req = https.request({hostname:u.hostname,port:u.port||443,path:u.pathname+u.search,method:data?'POST':'GET',headers:{'User-Agent':'LocalMind-AI/9.3 research-engine',Accept:'application/json','Content-Type':'application/json',...(data?{'Content-Length':Buffer.byteLength(data)}:{}),...headers}}, res => {
      let out=''; res.setEncoding('utf8'); res.on('data',c=>out+=c); res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300)return reject(new Error(`HTTP ${res.statusCode}`));try{resolve(JSON.parse(out));}catch(e){reject(e);}});
    });
    req.setTimeout(timeout,()=>req.destroy(new Error('timeout'))); req.on('error',reject); if(data)req.write(data); req.end();
  });
}

async function arxiv(query){
  const url=`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5`;
  const raw=await new Promise((resolve,reject)=>{https.get(url,{headers:{'User-Agent':'LocalMind-AI/9.3'}},r=>{let s='';r.setEncoding('utf8');r.on('data',c=>s+=c);r.on('end',()=>r.statusCode===200?resolve(s):reject(new Error(`HTTP ${r.statusCode}`)));}).on('error',reject);});
  return raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,9000);
}

async function crossref(query){
  const j=await httpJson(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=5`);
  return (j.message?.items||[]).map(x=>`${x.title?.[0]||''} | ${x.author?.map(a=>`${a.given||''} ${a.family||''}`).join(', ')||''} | ${x.published?.['date-parts']?.[0]?.join('-')||''} | ${x.DOI||''}`).join('\n');
}

async function pubmed(query){
  const j=await httpJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5`);
  const ids=j.esearchresult?.idlist||[]; if(!ids.length)return '';
  const s=await httpJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
  return ids.map(id=>{const x=s.result?.[id]||{};return `${x.title||''} | ${x.pubdate||''} | PMID:${id}`;}).join('\n');
}

async function optionalAiJudges(prompt){
  const out=[];
  const keys=[
    ['OpenAI',process.env.OPENAI_API_KEY,'https://api.openai.com/v1/chat/completions',m=>m.choices?.[0]?.message?.content],
    ['Gemini',process.env.GEMINI_API_KEY,'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',m=>m.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')]
  ];
  for(const [name,key,url,read] of keys){
    if(!key)continue;
    try{
      const target=url+(name==='Gemini'?`?key=${encodeURIComponent(key)}`:'');
      const body=name==='OpenAI'?{model:'gpt-4o-mini',messages:[{role:'system',content:'You are an independent fact checker. Do not guess. Identify claims that are unsupported or contradicted. Return concise JSON with verdict, confidence, corrections.'},{role:'user',content:prompt}]}:{contents:[{parts:[{text:`You are an independent fact checker. Do not guess. Return concise JSON with verdict, confidence, corrections.\n${prompt}`}]}]};
      const j=await httpJson(target,body,name==='OpenAI'?{Authorization:`Bearer ${key}`}:{},25000); const text=read(j); if(text)out.push({source:name,text});
    }catch(e){out.push({source:name,error:e.message});}
  }
  return out;
}

async function research(query,{internet=true,includeAi=true}={}){
  if(!internet) return {query,answerStatus:'NO_RESEARCH',confidence:0,sources:[],evidence:''};
  const results=await Promise.allSettled([searchWeb(query),arxiv(query),crossref(query),pubmed(query)]);
  const names=['Web search (Google/Bing/Wikipedia)','arXiv','Crossref','PubMed'];
  const sources=[];
  results.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value)sources.push({source:names[i],text:String(r.value).slice(0,9000)});});
  const evidence=sources.map(s=>`SOURCE: ${s.source}\n${s.text}`).join('\n\n---\n\n').slice(0,32000);
  const judges=includeAi?await optionalAiJudges(`QUESTION:\n${query}\n\nEVIDENCE:\n${evidence}`):[];
  const uniqueDomains=sources.length;
  let confidence=Math.min(0.95,0.25+uniqueDomains*0.15);
  if(judges.length>=2)confidence=Math.min(0.98,confidence+0.12);
  const answerStatus=uniqueDomains>=3?'VERIFIED_CANDIDATE':uniqueDomains>=2?'CORROBORATED':'INSUFFICIENT_EVIDENCE';
  return {query,answerStatus,confidence,sources,judges,evidence};
}

module.exports={research};
