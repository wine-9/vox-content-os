'use client';
import { useEffect,useState } from 'react';

function ProposalCard({p,onChanged}:{p:any,onChanged:()=>Promise<void>}){
  const[detail,setDetail]=useState<any>(null),[note,setNote]=useState(p.review_note||''),[skillBody,setSkillBody]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const recommendations=p.proposal?.recommendations||[
    '只学习跨样本反复出现的修改方向，不把单篇特殊修改写进正式 Skill。',
    '优先检查人工 Final 反复补充或重写的具体场景、可执行验证与自然表达。',
    '事实纠错与 one_off 不进入风格学习。'
  ];
  const loadEvidence=async()=>{const x=await (await fetch(`/api/learning/proposal?id=${encodeURIComponent(p.id)}`,{cache:'no-store'})).json();setDetail(x.item||null);if(!skillBody)setSkillBody(recommendations.map((x:string,i:number)=>`${i+1}. ${x}`).join('\n'))};
  const review=async(action:'approve'|'reject')=>{setBusy(true);setMsg('');const x=await (await fetch('/api/learning/proposal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:p.id,action,note})})).json();setMsg(x.ok?(action==='approve'?'已批准，下一步可晋升为正式 Skill。':'已驳回。'):`失败：${x.error}`);setBusy(false);await onChanged()};
  const promote=async()=>{setBusy(true);setMsg('');const x=await (await fetch('/api/learning/promote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:p.id,body:skillBody})})).json();setMsg(x.ok?`已晋升：${x.skill.version}`:`失败：${x.error}`);setBusy(false);await onChanged()};
  return <div className="card span-6">
    <div className="meta"><span className="pill">{p.status}</span><span className="pill">{p.batch_key}</span></div>
    <h2>{p.proposal?.rule}</h2>
    <p className="muted">证据样本：{p.proposal?.evidenceCount} 篇</p>
    <div>{recommendations.map((r:string,i:number)=><p key={i} style={{margin:'8px 0'}}>{i+1}. {r}</p>)}</div>
    <button className="secondary" onClick={loadEvidence} style={{marginTop:8}}>{detail?'刷新证据':'查看 Diff 证据'}</button>
    {detail&&<div style={{marginTop:12,maxHeight:300,overflow:'auto'}}>{(detail.evidence||[]).slice(0,12).map((e:any,i:number)=><div key={i} style={{padding:'10px 0',borderTop:'1px solid var(--line)'}}><div className="muted">{e.title} · {e.category}</div><div><span className="diff-old">{e.before_text||'∅'}</span> → <span className="diff-new">{e.after_text||'∅'}</span></div></div>)}</div>}
    {p.status==='pending'&&<div style={{marginTop:14}}><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="审核备注（可选）" style={{minHeight:80}}/><div style={{display:'flex',gap:8,marginTop:8}}><button disabled={busy} onClick={()=>review('approve')}>批准 Proposal</button><button disabled={busy} className="secondary" onClick={()=>review('reject')}>驳回</button></div></div>}
    {p.status==='approved'&&<div style={{marginTop:14}}><p><strong>拟晋升 Skill 正文</strong></p><textarea value={skillBody} onChange={e=>setSkillBody(e.target.value)} placeholder="先查看证据，再编辑正式 Skill 规则" style={{minHeight:180}}/><button disabled={busy||!skillBody.trim()} onClick={promote} style={{marginTop:8}}>晋升为 Active Skill</button></div>}
    {p.review_note&&<p className="muted">审核备注：{p.review_note}</p>}
    {msg&&<p className="muted">{msg}</p>}
  </div>
}

export default function LearningClient(){
  const[data,setData]=useState<any>(null);
  const load=async()=>setData(await (await fetch('/api/learning',{cache:'no-store'})).json());
  useEffect(()=>{load()},[]);
  if(!data)return <div className="card">加载中…</div>;
  return <>
    <div className="card" style={{marginBottom:16}}><h2>学习批次</h2><p>当前真正可学习的 Blind Winner → Final：<strong>{data.eligible}</strong> 篇；下一次风格提案阈值：<strong>{data.nextBatchAt}</strong> 篇。</p><p className="muted">旧单稿验证数据已从新学习口径排除。</p></div><div className="card" style={{marginBottom:16}}><h2>Writer Router · 盲选胜率</h2><div className="meta">{(data.writerPreferences?.wins||[]).map((w:any)=><span className="pill" key={w.writer}>{w.writer==='control'?'Control':w.writer==='human_writing'?'Human Writing':'Ultimate Fusion'}：{w.wins} 胜</span>)}<span className="pill">都不行：{data.writerPreferences?.none||0}</span><span className="pill">总盲选：{data.writerPreferences?.total||0}</span></div><p className="muted">这里训练的是“什么内容该由哪个 Writer 起稿”，不会直接写进风格 Skill。</p></div>
    <div className="grid">{(data.proposals||[]).map((p:any)=><ProposalCard p={p} key={p.id} onChanged={load}/>)}</div>
    <div className="card" style={{marginTop:16}}><h2>正式 Skill Versions</h2>{(data.skills||[]).length===0?<p className="muted">还没有已晋升的正式 Skill。Proposal 必须先人工批准。</p>:(data.skills||[]).map((s:any)=><div key={s.id} style={{padding:'10px 0',borderTop:'1px solid var(--line)'}}><div className="meta"><span className="pill">{s.status}</span><span className="pill">{s.version}</span></div><pre style={{whiteSpace:'pre-wrap'}}>{s.body}</pre></div>)}</div>
    <div className="card" style={{marginTop:16}}><h2>最近 Diff 观察</h2>{(data.recent||[]).length===0?<p className="muted">还没有 Final 差异数据。</p>:(data.recent||[]).slice(0,15).map((o:any)=><p key={o.id}><strong>{o.title}</strong><br/><span className="diff-old">{o.before_text}</span> → <span className="diff-new">{o.after_text}</span></p>)}</div>
  </>
}
