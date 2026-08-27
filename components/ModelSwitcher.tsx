'use client';
import {useEffect,useState} from 'react';
type Option={provider:'kimi'|'gemini';label:string;model:string;configured:boolean};
type State={activeProvider:'kimi'|'gemini';options:Option[]};
export default function ModelSwitcher(){
  const [state,setState]=useState<State|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=()=>fetch('/api/system/llm',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(x?.ok)setState(x)}).catch(()=>{});
  useEffect(()=>{load()},[]);
  async function choose(provider:'kimi'|'gemini'){
    if(!state||busy||provider===state.activeProvider)return;
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/system/llm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider})});
      const data=await res.json();
      if(!res.ok){setError(data?.error==='GEMINI_API_KEY_MISSING'?'Gemini API Key 未配置':data?.error==='KIMI_API_KEY_MISSING'?'Kimi API Key 未配置':'模型切换失败');return}
      setState(data);
    }catch{setError('模型切换失败')}finally{setBusy(false)}
  }
  if(!state)return <div className="model-switcher model-switcher-loading" aria-label="模型加载中">模型…</div>;
  return <div className="model-switch-wrap" title={error||'切换 Sinote 后台文字模型'}>
    <div className="model-switcher" role="group" aria-label="后台文字模型">
      {state.options.map(option=><button key={option.provider} type="button" className={state.activeProvider===option.provider?'is-active':''} onClick={()=>choose(option.provider)} disabled={busy} aria-pressed={state.activeProvider===option.provider} title={option.configured?option.model:`${option.label} · API Key 未配置`}>
        {option.provider==='kimi'?'Kimi 2.6':'Gemini 2.5 Pro'}
      </button>)}
    </div>
    {error&&<span className="model-switch-error" role="status">{error}</span>}
  </div>;
}
