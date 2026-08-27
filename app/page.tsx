import {dashboardStats,listContentLibrary} from '../lib/db';
import {SageCard,SagePageHeader,SageSectionLabel,SageStatus} from '../components/SageUI';
import SystemStatus from './SystemStatus';
export const dynamic='force-dynamic';
export default function Dashboard(){const items=listContentLibrary(60),pending=items.filter((x:any)=>x.statusLabel!=='已发布').slice(0,3),stats=dashboardStats();return <>
  <SagePageHeader eyebrow="Sinote / Workspace" title="工作台" description="从一个想法开始，沿着清楚的步骤把内容做到可以发布。" status={<SageStatus tone="warning">测试模式 · 不会写入外部平台</SageStatus>} />
  <div className="dashboard-metrics" aria-label="内容生产状态">
    <SageCard className="metric-card"><span className="metric-label">可选选题</span><strong>{stats.proposed}</strong><span className="muted">今日候选</span></SageCard>
    <SageCard className="metric-card metric-card-sage"><span className="metric-label">写作中</span><strong>{stats.awaiting + stats.generatingCandidates + stats.blindReview + stats.editing}</strong><span>从观点到定稿</span></SageCard>
    <SageCard className="metric-card"><span className="metric-label">已定稿</span><strong>{stats.finalApproved}</strong><span className="muted">等待视觉制作</span></SageCard>
    <SageCard className="metric-card metric-card-clay"><span className="metric-label">待发布</span><strong>{stats.readyToPublish}</strong><span>素材已确认</span></SageCard>
  </div>
  <div className="section-heading-row"><SageSectionLabel detail="选择一个入口，继续你的内容工作">开始下一步</SageSectionLabel></div>
  <div className="grid workbench-actions"><section className="card span-4 action-card"><div className="action-letter">A</div><h2>做一篇新内容</h2><p className="muted">从今天的选题里挑一个，先写下你的观点和素材。</p><a className="button-link" href="/topics">开始选题 →</a></section><section className="card span-4 action-card"><div className="action-letter">B</div><h2>发布已有成品</h2><p className="muted">上传已经做好的图片或视频，进入独立的发布流程。</p><a className="button-link" href="/quick-publish">上传成品 →</a></section><section className="card span-4 action-card"><div className="action-letter">C</div><h2>找以前的内容</h2><p className="muted">在一个内容库里查看进度、结果，或继续上次没做完的内容。</p><a className="button-link" href="/content">打开内容库 →</a></section></div>
  {pending.length>0&&<SageCard className="pending-work"><div className="section-heading-row"><div><h2>正在处理</h2><p className="muted" style={{margin:0}}>下面是最近需要你继续一步的内容。</p></div><a href="/content" className="muted">查看全部 →</a></div><div className="pending-list">{pending.map((x:any)=><div className="pending-item" key={x.id}><div><strong>{x.title}</strong><div className="muted">{x.statusLabel} · {x.publishOutcome}</div></div><a className="button-link secondary" href={x.nextAction.href}>{x.nextAction.label}</a></div>)}</div></SageCard>}
  <SystemStatus />
</>}
