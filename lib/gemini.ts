import {GEMINI_MODEL} from './llm-config';

function safeError(raw:string){
  try{return String(JSON.parse(raw)?.error?.message||'').replace(/[A-Za-z0-9_-]{30,}/g,'[REDACTED]').slice(0,260)}catch{return''}
}
function responseText(data:any){
  const parts=data?.candidates?.[0]?.content?.parts;
  if(!Array.isArray(parts))return '';
  return parts.map((p:any)=>typeof p?.text==='string'?p.text:'').join('').trim();
}
export async function geminiComplete(system:string,user:string,temperature=.65,maxTokens=3072){
  const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(!key)throw new Error('GEMINI_API_KEY_MISSING');
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),300000);
  try{
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{temperature,maxOutputTokens:maxTokens}}),signal:controller.signal});
    const raw=await res.text();
    if(!res.ok)throw new Error(`GEMINI_${res.status}${safeError(raw)?`: ${safeError(raw)}`:''}`);
    let data:any;try{data=JSON.parse(raw)}catch{throw new Error('GEMINI_INVALID_RESPONSE')}
    const text=responseText(data);if(!text)throw new Error('GEMINI_INVALID_RESPONSE');
    return {text,model:GEMINI_MODEL};
  }catch(e:any){if(e?.name==='AbortError')throw new Error('GEMINI_TIMEOUT');throw e}finally{clearTimeout(timer)}
}
