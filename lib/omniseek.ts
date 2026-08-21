import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ResearchItem } from './db';

const execFileAsync=promisify(execFile);
const root=path.join(process.cwd(),'vendor','omniseek');
const python=process.env.OMNISEEK_PYTHON||'/Users/voxrockschool/Projects/_skill_installs/omniseek-venv/bin/python';
const script=path.join(process.cwd(),'scripts','omniseek-query.py');
const runtimeHome=path.join(root,'.runtime-home');

export async function omniseekHealth(){
  try{
    const r=await fetch(process.env.OMNISEEK_HEALTH_URL||'http://127.0.0.1:8765/healthz',{signal:AbortSignal.timeout(1800),cache:'no-store'});
    return r.ok;
  }catch{return false}
}

export async function omniseekResearch(queries:string[]):Promise<{items:ResearchItem[];errors:string[]}> {
  try{
    const payload=JSON.stringify({queries:queries.slice(0,6),sources:['tieba','sogou_weixin'],limit:4});
    const{stdout}=await execFileAsync(python,[script,payload],{timeout:45000,maxBuffer:8*1024*1024,env:{...process.env,HOME:runtimeHome}});
    const parsed=JSON.parse(stdout||'{}');
    const items=(Array.isArray(parsed.items)?parsed.items:[]).map((x:any)=>({
      id:'',source:String(x.source||'OmniSeek'),title:String(x.title||''),url:x.url?String(x.url):undefined,
      author:x.author?String(x.author):undefined,summary:x.summary?String(x.summary):undefined,
      publishedAt:x.publishedAt?String(x.publishedAt):undefined,query:x.query?String(x.query):undefined,
      engagement:x.engagement&&typeof x.engagement==='object'?x.engagement:{},
    })) as ResearchItem[];
    return{items,errors:Array.isArray(parsed.errors)?parsed.errors.map(String):[]};
  }catch(e:any){return{items:[],errors:[`OmniSeek: ${String(e?.message||e)}`]}}
}
