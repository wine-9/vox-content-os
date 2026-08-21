'use client';
import {useEffect,useState} from 'react';
function TopicCard({t,saved,onSave,onSelect}:{t:any;saved:boolean;onSave:(id:string,v:boolean)=>Promise<void>;onSelect:(id:string)=>Promise<void>}){
  return <div className="card span-6 topic">
    <div className="meta"><span className="pill">{t.column==='yueli'?'乐里':'乐室'}</span><span className="pill">综合 {t.score??'—'}</span><span className="pill">音乐匹配 {t.voxFit}</span><span className="pill">互动热度 {t.audible}</span><span className="pill">时效 {t.freshness}</span>{saved&&<span className="pill">已保存</span>}</div>
    <h2>{t.title}</h2><div><strong>为什么现在：</strong>{t.whyNow}</div><div><strong>VOX 角度：</strong>{t.voxAngle}</div><div className="muted" style={{wordBreak:'break-all'}}>来源：{t.source}</div><div className="muted">方向：{t.format}</div>
    <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}><button onClick={()=>onSelect(t.id)}>就写这个</button><button className="secondary" onClick={()=>onSave(t.id,!saved)}>{saved?'取消保存':'保存选题'}</button>{t.sourceUrl&&<a className="button-link secondary" href={t.sourceUrl} target="_blank" rel="noreferrer">查看原文 ↗</a>}</div>
  </div>
}
export default function TopicsClient(){
  const[items,setItems]=useState<any[]>([]),[saved,setSaved]=useState<any[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const load=async()=>{const x=await (await fetch('/api/topics',{cache:'no-store'})).json();setItems(x.items||[]);setSaved(x.saved||[])};
  useEffect(()=>{load()},[]);
  const refresh=async()=>{setBusy(true);setMsg('正在从小红书、抖音、行业源和 OmniSeek 搜索音乐热点…');try{const r=await fetch('/api/research/run',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const x=await r.json();await load();setMsg(`抓到 ${x.fetched||0} 条，当前展示前 ${Math.min(20,(x.top20||[]).length)} 条。${x.omniseek?' OmniSeek 已参与检索。':' OmniSeek 本轮没有返回材料。'}${x.browserBridge?' 小红书/抖音已接入。':' 小红书/抖音等待 Chrome Bridge。'} ${(x.errors||[]).join('；')}`)}catch(e:any){setMsg(e.message)}finally{setBusy(false)}};
  const select=async(id:string)=>{const x=await (await fetch('/api/topics/select',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topicId:id})})).json();if(x.contentId)location.href=`/editor?id=${x.contentId}`};
  const saveTopic=async(id:string,v:boolean)=>{const x=await (await fetch('/api/topics/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topicId:id,saved:v})})).json();if(x.ok){setMsg(v?'选题已保存，后续刷新热点不会消失。':'已取消保存。');await load()}else setMsg('保存失败：'+x.error)};
  return <>
    <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}><button onClick={refresh} disabled={busy}>{busy?'研究中…':'刷新真实热点'}</button><span className="muted">音乐 / 音乐行业 / 乐队 / 摇滚历史优先；效果器与器材评测降权。综合分 = 互动热度 40% + 音乐匹配 38% + 时效 22%。</span></div>
    {msg&&<div className="card" style={{marginBottom:16}}>{msg}</div>}
    {saved.length>0&&<section style={{marginBottom:28}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'end',marginBottom:12}}><div><h2 style={{fontSize:22,marginBottom:4}}>已保存选题</h2><div className="muted">{saved.length} 个 · 不受热点刷新影响</div></div></div><div className="grid">{saved.map(t=><TopicCard key={t.id} t={t} saved onSave={saveTopic} onSelect={select}/>)}</div></section>}
    <section><div style={{display:'flex',justifyContent:'space-between',alignItems:'end',marginBottom:12}}><div><h2 style={{fontSize:22,marginBottom:4}}>今日候选 Top 20</h2><div className="muted">优先看有真实点赞、评论、回复、分享、浏览/播放信号的音乐选题。</div></div></div><div className="grid">{items.slice(0,20).map(t=><TopicCard key={t.id} t={t} saved={false} onSave={saveTopic} onSelect={select}/>)}</div>{items.length===0&&<div className="card muted">当前没有未保存候选，点“刷新真实热点”获取新选题。</div>}</section>
  </>
}
