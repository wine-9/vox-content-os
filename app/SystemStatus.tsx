'use client';
import {useEffect,useState} from 'react';
function CopyLink({url,label}:{url?:string|null,label:string}){const[copied,setCopied]=useState(false);if(!url)return null;const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1200)}catch{}};return <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',margin:'8px 0'}}><span className="muted" style={{minWidth:88}}>{label}</span><a href={url} target="_blank" rel="noreferrer" style={{wordBreak:'break-all'}}>{url}</a><button className="secondary" onClick={copy} style={{padding:'5px 9px'}}>{copied?'已复制':'复制'}</button></div>}
export default function SystemStatus(){
  const[s,setS]=useState<any>(null),[balance,setBalance]=useState<any>(null),[access,setAccess]=useState<any>(null);
  const loadStatus=()=>fetch('/api/system/status',{cache:'no-store'}).then(r=>r.json()).then(setS).catch(()=>{});
  const loadBalance=()=>fetch('/api/system/balance',{cache:'no-store'}).then(r=>r.json()).then(setBalance).catch(()=>setBalance({ok:false,error:'BALANCE_FAILED'}));
  const loadAccess=()=>fetch('/api/system/access',{cache:'no-store'}).then(r=>r.json()).then(setAccess).catch(()=>{});
  useEffect(()=>{loadStatus();loadBalance();loadAccess();const b=setInterval(loadBalance,30000),a=setInterval(loadAccess,60000);return()=>{clearInterval(b);clearInterval(a)}},[]);
  if(!s)return null;
  const xhs=s.tools?.opencliChannels?.xiaohongshu?.status==='ok',dy=s.tools?.opencliChannels?.douyin?.status==='ok';
  return <div style={{marginTop:16}}>
    <div className="card">
      <h2>系统连接状态</h2><div className="meta"><span className="pill">Agent-Reach {s.tools?.reach?'已安装':'异常'}</span><span className="pill">OpenCLI Bridge {s.tools?.browserBridge?'已连接':'待连接'}</span><span className="pill">OmniSeek {s.tools?.omniseek?.status==='ok'?'在线':'离线'}</span><span className="pill">小红书 {xhs?'可搜索':'不可用'}</span><span className="pill">抖音 {dy?'可搜索':'不可用'}</span><span className="pill">Kimi {s.kimiConfigured?`${s.kimiModel||''} 已配置`:'缺 API Key'}</span><span className="pill">Thinking {s.kimiThinking?'ON':'默认'}</span><span className="pill">Dry Run {s.dryRun?'ON':'OFF'}</span></div>
      <p className="muted">研究库 {s.stats?.research||0} · 候选 {s.stats?.topics||0} · 内容任务 {s.stats?.content||0} · Final {s.stats?.finals||0}</p>
      {s.tools?.reach?.xiaohongshu?.status==='off'&&xhs&&<p className="muted" style={{marginBottom:0}}>Agent Reach doctor 未识别小红书后端，但 OpenCLI Browser Bridge 已连接；系统以 OpenCLI 实际能力为准。</p>}
    </div>
    <div className="grid" style={{marginTop:16}}>
      <div className="card span-6">
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}}><div><h2>API 账户 · 现金余额</h2><p className="muted">SiliconFlow /user/info · 每 30 秒刷新；不包含代金券/赠送权益</p></div><button className="secondary" onClick={loadBalance}>刷新</button></div>
        {balance?.ok?<><div className="kpi">{balance.totalBalance??'—'}</div><div className="muted">现金余额</div><div className="meta" style={{marginTop:10}}><span className="pill">充值余额 {balance.chargeBalance??'—'}</span><span className="pill">其他余额 {balance.balance??'—'}</span>{balance.accountStatus&&<span className="pill">账户 {balance.accountStatus}</span>}</div><p className="muted">最近更新 {balance.updatedAt?new Date(balance.updatedAt).toLocaleTimeString():'—'}</p>{String(balance.totalBalance)==="0"&&<p className="muted" style={{marginBottom:0}}>当前公开账户接口返回现金余额 0；代金券/赠送权益不会出现在 /user/info，因此这不是“总可用额度”。请以 SiliconFlow 控制台的代金券/账户总览为准。</p>}</>:<p className="muted">{balance?`余额读取失败：${balance.error||'unknown'}`:'正在读取余额…'}</p>}
      </div>
      <div className="card span-6">
        <h2>其他电脑访问</h2><p className="muted">同一 Wi‑Fi 用 LAN；不同网络优先用 Tailscale 私网。</p>
        <CopyLink label="局域网" url={access?.lan?.url}/><CopyLink label="Tailscale" url={access?.tailscale?.url}/>
        <div className="meta" style={{marginTop:10}}><span className="pill">服务端口 3000</span><span className="pill">Tailscale {access?.tailscale?.running?'在线':'未连接'}</span></div>
        <p className="muted" style={{marginBottom:0}}>跨网络访问时，两台电脑登录同一 Tailscale 网络即可。局域网入口只建议在可信 Wi‑Fi 使用；不要把 3000 端口直接映射到公网。</p>
      </div>
    </div>
  </div>
}
