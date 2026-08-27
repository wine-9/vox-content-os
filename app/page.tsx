import {dashboardStats,listContentLibrary} from '../lib/db';
import {SageCard,SagePageHeader,SageSectionLabel,SageStatus} from '../components/SageUI';
import SystemStatus from './SystemStatus';
export const dynamic='force-dynamic';
export default function Dashboard(){const items=listContentLibrary(60),pending=items.filter((x:any)=>x.statusLabel!=='已发布').slice(0,3),stats=dashboardStats();return <>
  <SagePageHeader eyebrow="Sinote / Workspace" title="工作台" description="从一个想法开始，沿着清楚的步骤把内容做到可以发布。" status={<SageStatus tone="warning">测试模式 · 不会写入外部平台</SageStatus>} />
  <div className="dashboard-metrics" aria-label="内容生产状态">
    <SageCard className="metric-card"><span className="metric-label">可选选题</span><strong>{stats.proposed}</strong><span className="muted">今日候选</span></SageCard>
    <SageCard className="metric-card metric-card-sage"><span className="metric-label">写作中</span><strong>{stats.awaiting + stats.generatingCandidates + stats.blindReview + stats.editing}</strong><span>从观点到定稿</span></SageCard>
    <SageCard className="metric-card"><span className="metric-label">已定稿</span><strong>{stats.finalApproved}</strong><span className="muted">等待发布准备</span></SageCard>
    <SageCard className="metric-card metric-card-clay"><span className="metric-label">待发布</span><strong>{stats.readyToPublish}</strong><span>素材已确认</span></SageCard>
  </div>
  <div className="section-heading-row"><SageSectionLabel detail="第一次使用时，从这里开始最稳妥">现在应该做什么</SageSectionLabel></div>
  <SageCard className="action-card" style={{marginBottom:16}}><div className="action-letter">1</div><h2>做一篇新内容</h2><p className="muted">先选一个话题，再和 Sinote 对齐想法、生成草稿、定稿并准备发布。</p><a className="button-link" href="/topics">开始选题 →</a></SageCard>
  <div className="grid workbench-actions"><section className="card span-6 action-card"><h2>发布已有成品</h2><p className="muted">已经有图片或视频时，直接进入发布中心。</p><a className="button-link secondary" href="/publish?tab=quick">发布已有成品 →</a></section><section className="card span-6 action-card"><h2>找以前的内容</h2><p className="muted">查看进行中、已定稿和已发布内容，并从原位置继续。</p><a className="button-link secondary" href="/content">打开内容库 →</a></section></div>
  {pending.length>0&&<SageCard className="pending-work"><div className="section-heading-row"><div><h2>继续上次的内容</h2><p className="muted" style={{margin:0}}>最近需要你继续一步的内容。</p></div><a href="/content" className="muted">查看全部 →</a></div><div className="pending-list">{pending.map((x:any)=><div className="pending-item" key={x.id}><div><strong>{x.title}</strong><div className="muted">{x.statusLabel} · {x.publishOutcome}</div></div><a className="button-link secondary" href={x.nextAction.href}>{x.nextAction.label}</a></div>)}</div></SageCard>}
  <SystemStatus />
</>}
