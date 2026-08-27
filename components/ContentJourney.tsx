const stepLabels:Record<string,string>={viewpoint:'观点/素材',draft:'草稿',choose:'选稿',final:'定稿',visual:'视觉',publish:'发布'};
const steps=[
  {key:'viewpoint',label:'观点/素材',href:(id:string)=>`/editor?id=${encodeURIComponent(id)}#viewpoint`},
  {key:'draft',label:'草稿',href:(id:string)=>`/editor?id=${encodeURIComponent(id)}#drafts`},
  {key:'choose',label:'选稿',href:(id:string)=>`/editor?id=${encodeURIComponent(id)}#choose`},
  {key:'final',label:'定稿',href:(id:string)=>`/editor?id=${encodeURIComponent(id)}#final`},
  {key:'visual',label:'视觉',href:(id:string)=>`/publish?id=${encodeURIComponent(id)}`},
  {key:'publish',label:'发布',href:(id:string)=>`/release/publish?id=${encodeURIComponent(id)}`}
];

export function ContentJourney({contentId,current,doneSteps=[]}:{contentId:string;current:string;doneSteps?:string[]}){
  const done=new Set(doneSteps);
  return <section className="content-journey" aria-label="这条内容的六步进度" data-testid="content-journey">
    <div className="journey-heading"><div><div className="eyebrow">Content Journey</div><strong>每一步都从这里继续</strong></div><span className="journey-note">当前：{stepLabels[current]||current}</span></div>
    <ol className="journey-steps">{steps.map((step,index)=>{const active=current===step.key,complete=done.has(step.key)&&!active;return <li key={step.key} className={active?'is-current':complete?'is-complete':''}><a href={step.href(contentId)} aria-current={active?'step':undefined}><span className="journey-number">{complete?'✓':index+1}</span><span>{step.label}</span></a></li>})}</ol>
  </section>;
}
