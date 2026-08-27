import PublishClient from './PublishClient';
import QuickPublishClient from '../quick-publish/QuickPublishClient';
import HistoryPanel from './HistoryPanel';
export const dynamic='force-dynamic';
export default async function PublishPage({searchParams}:{searchParams:Promise<{tab?:string}>}){const q=await searchParams,tab=q?.tab==='quick'?'quick':q?.tab==='history'?'history':'pending';return <><div className="card" style={{marginBottom:16}}><div className="eyebrow">发布中心</div><h1>发布</h1><p className="muted">在一个地方完成待发布内容、已有成品直发和发布记录查询。</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><a className={`button-link ${tab==='pending'?'':'secondary'}`} href="/publish">待发布内容</a><a className={`button-link ${tab==='quick'?'':'secondary'}`} href="/publish?tab=quick">成品直发</a><a className={`button-link ${tab==='history'?'':'secondary'}`} href="/publish?tab=history">发布历史</a></div></div>{tab==='quick'?<QuickPublishClient/>:tab==='history'?<HistoryPanel/>:<PublishClient/>}</>}
