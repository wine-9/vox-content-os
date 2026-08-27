import fs from 'node:fs';
import path from 'node:path';

export type LlmProvider='kimi'|'gemini';
export const GEMINI_MODEL=process.env.GEMINI_MODEL||'gemini-2.5-pro';
const STATE_DIR=path.join(process.cwd(),'.sinote-runtime');
const STATE_FILE=path.join(STATE_DIR,'llm.json');

function configured(provider:LlmProvider){
  return provider==='kimi'
    ? Boolean(process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY)
    : Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY);
}

export function getActiveLlmProvider():LlmProvider{
  try{
    const raw=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
    if(raw?.provider==='gemini'||raw?.provider==='kimi')return raw.provider;
  }catch{}
  return 'kimi';
}

export function getLlmStatus(){
  const activeProvider=getActiveLlmProvider();
  return {activeProvider,options:[
    {provider:'kimi' as const,label:'Kimi 2.6',model:process.env.KIMI_MODEL||'kimi-k2.6',configured:configured('kimi')},
    {provider:'gemini' as const,label:'Gemini 2.5 Pro',model:GEMINI_MODEL,configured:configured('gemini')}
  ]};
}

export function setActiveLlmProvider(provider:LlmProvider){
  if(provider!=='kimi'&&provider!=='gemini')throw new Error('LLM_PROVIDER_INVALID');
  if(!configured(provider))throw new Error(provider==='gemini'?'GEMINI_API_KEY_MISSING':'KIMI_API_KEY_MISSING');
  fs.mkdirSync(STATE_DIR,{recursive:true});
  fs.writeFileSync(STATE_FILE,JSON.stringify({provider,updatedAt:new Date().toISOString()},null,2)+'\n','utf8');
  return getLlmStatus();
}
