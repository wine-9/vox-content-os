'use client';
import {useRef,useState} from 'react';

type Props={files:File[];onChange:(files:File[])=>void;max?:number;label?:string;compact?:boolean};
const ok=(f:File)=>['image/png','image/jpeg','image/webp','image/gif'].includes(f.type);
export default function ImageDropPaste({files,onChange,max=6,label='参考图片',compact=false}:Props){
  const input=useRef<HTMLInputElement>(null),[drag,setDrag]=useState(false),[msg,setMsg]=useState('');
  const merge=(incoming:File[])=>{const valid=incoming.filter(ok);const all=[...files,...valid].filter((f,i,a)=>a.findIndex(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified)===i).slice(0,max);onChange(all);setMsg(incoming.length&&!valid.length?'没有识别到可用图片。':'')};
  return <div className={`image-drop ${drag?'is-dragging':''} ${compact?'compact':''}`}
    onDragEnter={e=>{e.preventDefault();setDrag(true)}} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={e=>{e.preventDefault();setDrag(false)}} onDrop={e=>{e.preventDefault();setDrag(false);merge(Array.from(e.dataTransfer.files))}}
    onPaste={e=>{const imgs=Array.from(e.clipboardData.files).filter(ok);if(imgs.length){e.preventDefault();merge(imgs)}}}
    onClick={()=>input.current?.click()} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')input.current?.click()}}>
    <input ref={input} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>merge(Array.from(e.target.files||[]))}/>
    <strong>{files.length?`${label} · ${files.length}/${max}`:label}</strong>
    <div className="muted" style={{marginTop:4,fontSize:13}}>拖图片到这里；点一下这个区域后可直接 ⌘V 粘贴，也可以选择文件。</div>
    {files.length>0&&<div className="file-chips" onClick={e=>e.stopPropagation()}>{files.map((f,i)=><span className="file-chip" key={`${f.name}-${f.lastModified}`}>{f.name}<button type="button" aria-label="移除" onClick={()=>onChange(files.filter((_,n)=>n!==i))}>×</button></span>)}<button className="secondary tiny" type="button" onClick={()=>onChange([])}>清空</button></div>}
    {msg&&<div className="muted" style={{marginTop:5}}>{msg}</div>}
  </div>
}
