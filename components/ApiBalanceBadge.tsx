'use client';
import {useEffect,useState} from 'react';
export default function ApiBalanceBadge(){
  const[x,setX]=useState<any>(null);
  const load=()=>fetch('/api/system/balance',{cache:'no-store'}).then(r=>r.json()).then(setX).catch(()=>setX({ok:false}));
  useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[]);
  const title=x?.ok?`SiliconFlow 现金余额：${x.totalBalance??'—'}。代金券/赠送权益不在公开 API 返回范围内，因此这不是总可用额度。每30秒刷新。`:'现金余额读取失败';
  return <button className="balance-badge" onClick={load} title={title} aria-label={title}>
    <span className={`balance-dot ${x?.ok?'ok':'off'}`}/>
    <span>Kimi 余额</span>
    <strong>{x?.ok?(x.totalBalance??'—'):'—'}</strong>
    {x?.ok&&String(x.totalBalance)==='0'&&<span className="balance-note">代金券另计</span>}
  </button>
}
