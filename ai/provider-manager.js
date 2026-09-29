const DEFAULTS = {
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: process.env.OPENROUTER_MODEL || 'openrouter/free' },
  lmstudio: { baseUrl: process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1', model: process.env.LM_STUDIO_MODEL || 'local-model' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: process.env.OLLAMA_MODEL || 'qwen3:4b' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: process.env.OPENAI_MODEL || 'gpt-5' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5' }
};

class AIProviderManager {
  constructor({ getSettings, ensureOllamaReady, ollamaInstalled } = {}) { this.getSettings=getSettings; this.ensureOllamaReady=ensureOllamaReady; this.ollamaInstalled=ollamaInstalled; this.lastProvider=null; }
  config() {
    return {
      lmstudio:{name:'LM Studio',type:'local',free:true,configured:true,model:DEFAULTS.lmstudio.model},
      ollama:{name:'Ollama',type:'local',free:true,configured:Boolean(this.ollamaInstalled?.()),model:DEFAULTS.ollama.model},
      gemini:{name:'Gemini Free Tier',type:'cloud',free:true,configured:Boolean(process.env.GEMINI_API_KEY),model:DEFAULTS.gemini.model},
      groq:{name:'Groq Free Tier',type:'cloud',free:true,configured:Boolean(process.env.GROQ_API_KEY),model:DEFAULTS.groq.model},
      openrouter:{name:'OpenRouter Free',type:'cloud',free:true,configured:Boolean(process.env.OPENROUTER_API_KEY),model:DEFAULTS.openrouter.model},
      openai:{name:'OpenAI',type:'cloud',free:false,configured:Boolean(process.env.OPENAI_API_KEY),model:DEFAULTS.openai.model},
      claude:{name:'Claude',type:'cloud',free:false,configured:Boolean(process.env.ANTHROPIC_API_KEY),model:DEFAULTS.claude.model}
    };
  }
  order(selected='free-auto') {
    const free=['lmstudio','ollama','gemini','groq','openrouter'];
    if(selected==='auto'||selected==='free-auto') return free.filter(p=>this.config()[p].configured);
    if(selected&&selected!=='paid-auto') return [selected];
    return ['openai','claude','gemini','groq','openrouter','lmstudio','ollama'].filter(p=>this.config()[p].configured);
  }
  async chat(provider,messages) {
    if(provider==='ollama'){if(this.ensureOllamaReady)await this.ensureOllamaReady();return this.openAICompatible(DEFAULTS.ollama.baseUrl,'',DEFAULTS.ollama.model,messages,true);}
    if(provider==='lmstudio')return this.openAICompatible(DEFAULTS.lmstudio.baseUrl,'',DEFAULTS.lmstudio.model,messages,false);
    if(provider==='gemini')return this.gemini(messages);
    if(provider==='groq')return this.openAICompatible(DEFAULTS.groq.baseUrl,process.env.GROQ_API_KEY,DEFAULTS.groq.model,messages,false);
    if(provider==='openrouter')return this.openAICompatible(DEFAULTS.openrouter.baseUrl,process.env.OPENROUTER_API_KEY,DEFAULTS.openrouter.model,messages,false);
    if(provider==='openai')return this.openAICompatible(DEFAULTS.openai.baseUrl,process.env.OPENAI_API_KEY,DEFAULTS.openai.model,messages,false);
    if(provider==='claude')return this.anthropic(messages);
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  async openAICompatible(baseUrl,key,model,messages,ollama=false){const headers={'content-type':'application/json'};if(key)headers.authorization=`Bearer ${key}`;const url=ollama?`${baseUrl}/api/chat`:`${baseUrl}/chat/completions`;const body=ollama?{model,messages,stream:false}:{model,messages,temperature:0.2};const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);const data=await r.json();return ollama?(data.message?.content||''):(data.choices?.[0]?.message?.content||'');}
  async anthropic(messages){const key=process.env.ANTHROPIC_API_KEY;if(!key)throw new Error('ANTHROPIC_API_KEY не задан');const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const body={model:DEFAULTS.claude.model,max_tokens:4096,messages:messages.filter(m=>m.role!=='system')};if(system)body.system=system;const r=await fetch(`${DEFAULTS.claude.baseUrl}/messages`,{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);const data=await r.json();return data.content?.map(x=>x.text||'').join('')||'';}
  async gemini(messages){const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('GEMINI_API_KEY не задан');const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const body={contents,...(system?{systemInstruction:{parts:[{text:system}]}}:{})};const r=await fetch(`${DEFAULTS.gemini.baseUrl}/models/${DEFAULTS.gemini.model}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);const data=await r.json();return data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';}
  async generate(messages,{provider='free-auto',onStatus}={}){const errors=[];for(const name of this.order(provider)){try{onStatus?.(`AI: ${this.config()[name].name}…`);const text=await this.chat(name,messages);if(!text)throw new Error('Провайдер вернул пустой ответ');this.lastProvider=name;return{provider:name,text,attempts:errors,free:Boolean(this.config()[name].free)};}catch(e){errors.push({provider:name,error:e.message});onStatus?.(`${this.config()[name].name} недоступен — следующий бесплатный провайдер…`);}}throw new Error(`Все бесплатные AI-провайдеры недоступны: ${errors.map(e=>`${e.provider}: ${e.error}`).join(' | ')}`);}
}
module.exports={AIProviderManager,DEFAULTS};
