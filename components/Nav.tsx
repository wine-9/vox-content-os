import ApiBalanceBadge from './ApiBalanceBadge';
export function Nav(){return <div className="topbar">
  <div><div className="brand">VOX Content OS</div><div className="muted" style={{fontSize:12}}>Blind Writer Loop · K2.6 Thinking</div></div>
  <div className="topbar-right"><ApiBalanceBadge/><div className="nav"><a href="/">Dashboard</a><a href="/topics">选题</a><a href="/ingest">已有内容</a><a href="/quick-publish">一键发布台</a><a href="/editor">编辑</a><a href="/learning">学习中心</a><a href="/growth">增长飞轮</a><a href="/publish">公众号母版</a><a href="/release">发布</a><a href="/history">发布历史</a></div></div>
</div>}
