import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DRY_RUN } from './platform-publish';
import { checkSauAccount, localPublisherStatus } from './local-social-publish';
const run=promisify(execFile),ROOT=process.cwd(),DATA_DIR=path.join(ROOT,'data','quick-publish'),SAU_CWD=path.join(ROOT,'vendor','social-auto-upload'),SAU_BIN=process.env.SAU_BIN||path.join(ROOT,'.venv-sau','bin','sau'),ACCOUNT=process.env.SOCIAL_PUBLISH_ACCOUNT||'vox';
const FIXED_TAGS=['VOX音乐教室','武汉学音乐','组乐队','武汉组乐队','成人学音乐'],PLATFORMS=['xiaohongshu','douyin','wechat'] as const;
export type DirectPlatform=typeof PLATFORMS[number];
type InputFile={name:string;type:string;size:number};type JobFile=InputFile&{id:string;path:string;ready:boolean;role:'video'|'image'|'cover'};type Result={status:'pending'|'running'|'succeeded'|'failed'|'skipped';message?:string;remoteId?:string|null;finishedAt?:string};
export type DirectJob={id:string;kind:'video'|'images';title:string;body:string;tags:string[];platforms:DirectPlatform[];files:JobFile[];createdAt:string;updatedAt:string;status:'uploading'|'ready'|'publishing'|'completed'|'partial'|'failed';results:Record<DirectPlatform,Result>};
fs.mkdirSync(DATA_DIR,{recursive:true});
function safeName(name:string){return path.basename(name).replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(-120)||'file'}
function manifestPath(id:string){return path.join(DATA_DIR,id,'manifest.json')}
function writeJob(j:DirectJob){j.updatedAt=new Date().toISOString();fs.mkdirSync(path.dirname(manifestPath(j.id)),{recursive:true});fs.writeFileSync(manifestPath(j.id),JSON.stringify(j,null,2));return j}
export function getDirectJob(id:string):DirectJob|null{try{return JSON.parse(fs.readFileSync(manifestPath(id),'utf8'))}catch{return null}}
export function listDirectJobs(limit=20){return fs.readdirSync(DATA_DIR,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>getDirectJob(x.name)).filter(Boolean).sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,limit) as DirectJob[]}
function normalizeTags(tags:any){const vals=Array.isArray(tags)?tags:String(tags||'').split(/[，,\s#]+/);return vals.map((x:any)=>String(x).replace(/^#/,'').trim()).filter(Boolean).filter((x:string,i:number,a:string[])=>a.indexOf(x)===i).slice(0,12)}
export function createDirectJob(input:{title:string;body?:string;tags?:any;platforms?:string[];files:InputFile[]}){const title=String(input.title||'').trim(),body=String(input.body||'').trim();if(!title)throw Error('请填写标题');if([...title].length>20)throw Error('标题需控制在 20 个字以内，才能同时兼容小红书和抖音');if([...body].length>1000)throw Error('正文需控制在 1000 字以内，才能同时兼容小红书和抖音');const raw=input.files||[],videos=raw.filter(f=>String(f.type||'').startsWith('video/')),images=raw.filter(f=>String(f.type||'').startsWith('image/'));if(!raw.length)throw Error('请先上传视频或图片');if(raw.some(f=>!String(f.type||'').match(/^(video|image)\//)))throw Error('只支持视频和图片文件');if(videos.length>1)throw Error('一次只能发布 1 个视频');if(videos.length&&images.length>1)throw Error('视频模式最多再带 1 张封面图');if(!videos.length&&images.length>18)throw Error('图文一次最多 18 张图片');const kind:DirectJob['kind']=videos.length?'video':'images',platforms=(input.platforms||PLATFORMS).filter((x:any)=>PLATFORMS.includes(x)) as DirectPlatform[];if(!platforms.length)throw Error('至少选择一个发布平台');const id=randomUUID(),dir=path.join(DATA_DIR,id);fs.mkdirSync(dir,{recursive:true});const files:JobFile[]=raw.map((f,i)=>{const role:JobFile['role']=String(f.type).startsWith('video/')?'video':kind==='video'?'cover':'image';return{id:randomUUID(),name:safeName(f.name),type:f.type,size:Number(f.size||0),path:path.join(dir,`${String(i+1).padStart(2,'0')}-${safeName(f.name)}`),ready:false,role}});const init=()=>({status:'skipped'} as Result),results:any={xiaohongshu:init(),douyin:init(),wechat:init()};platforms.forEach(p=>results[p]={status:'pending'});return writeJob({id,kind,title,body,tags:normalizeTags(input.tags),platforms,files,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'uploading',results})}
export function directUploadPath(jobId:string,fileId:string){const j=getDirectJob(jobId);if(!j)throw Error('发布任务不存在');const f=j.files.find(x=>x.id===fileId);if(!f)throw Error('上传文件不存在');return f.path}
export function markDirectFileReady(jobId:string,fileId:string){const j=getDirectJob(jobId);if(!j)throw Error('发布任务不存在');const f=j.files.find(x=>x.id===fileId);if(!f)throw Error('上传文件不存在');f.ready=true;j.status=j.files.every(x=>x.ready)?'ready':'uploading';return writeJob(j)}
function clip(x:any,n=1800){return String(x||'').slice(-n)}function allTags(j:DirectJob){return[...FIXED_TAGS,...j.tags].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,16)}
async function ensureVideoCover(j:DirectJob){const cover=j.files.find(x=>x.role==='cover'&&x.ready);if(cover)return cover.path;const video=j.files.find(x=>x.role==='video'&&x.ready);if(!video)throw Error('视频文件缺失');const out=path.join(DATA_DIR,j.id,'auto-cover');fs.mkdirSync(out,{recursive:true});try{await run('/usr/bin/qlmanage',['-t','-s','1400','-o',out,video.path],{timeout:60000,maxBuffer:1024*1024});const png=fs.readdirSync(out).find(x=>x.toLowerCase().endsWith('.png'));if(png)return path.join(out,png)}catch{}throw Error('无法自动提取视频首帧，请给视频再上传 1 张封面图')}
async function publishSocial(j:DirectJob,platform:'xiaohongshu'|'douyin'){const status=localPublisherStatus();if(DRY_RUN)throw Error('当前仍是 DRY RUN，真实发布已锁定');if(!status.sau.installed)throw Error('social-auto-upload 未安装');const auth=await checkSauAccount(platform);if(!auth.valid)throw Error(`${platform==='douyin'?'抖音':'小红书'}登录态失效，请先刷新登录`);const tags=allTags(j),args:string[]=[platform];if(j.kind==='video'){const video=j.files.find(x=>x.role==='video'&&x.ready);if(!video)throw Error('视频文件缺失');const cover=await ensureVideoCover(j);args.push('upload-video','--account',ACCOUNT,'--file',video.path,'--title',j.title,...(j.body?['--desc',j.body]:[]),...(tags.length?['--tags',tags.join(',')]:[]),'--thumbnail',cover,'--headless')}else{const images=j.files.filter(x=>x.role==='image'&&x.ready).map(x=>x.path);if(!images.length)throw Error('图片文件缺失');args.push('upload-note','--account',ACCOUNT,'--images',...images,'--title',j.title,...(j.body?['--note',j.body]:[]),...(tags.length?['--tags',tags.join(',')]:[]),...(platform==='douyin'?['--bgm','Cory Wong']:[]),'--headless')}const{stdout,stderr}=await run(SAU_BIN,args,{cwd:SAU_CWD,timeout:15*60*1000,maxBuffer:4*1024*1024,env:{...process.env}});return clip(`${stdout||''}\n${stderr||''}`)}
async function wxJson(url:string,init?:RequestInit){const r=await fetch(url,init),x:any=await r.json();if(!r.ok||x.errcode)throw Error(`WECHAT_${x.errcode||r.status}: ${x.errmsg||r.statusText}`);return x}
async function wechatToken(){const appid=process.env.WECHAT_APP_ID,secret=process.env.WECHAT_APP_SECRET;if(!appid||!secret)throw Error('微信公众号 AppID / AppSecret 未配置');const u=new URL('https://api.weixin.qq.com/cgi-bin/token');u.searchParams.set('grant_type','client_credential');u.searchParams.set('appid',appid);u.searchParams.set('secret',secret);const x:any=await wxJson(u.toString());if(!x.access_token)throw Error('公众号 access_token 获取失败');return String(x.access_token)}
async function uploadWxInline(access:string,fp:string){const fd=new FormData(),b=fs.readFileSync(fp);fd.append('media',new Blob([b]),path.basename(fp));const x:any=await wxJson(`https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(access)}`,{method:'POST',body:fd});if(!x.url)throw Error('公众号正文图片上传失败');return x.url as string}
async function uploadWxCover(access:string,fp:string){const fd=new FormData(),b=fs.readFileSync(fp);fd.append('media',new Blob([b]),path.basename(fp));const x:any=await wxJson(`https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(access)}&type=image`,{method:'POST',body:fd});if(!x.media_id)throw Error('公众号封面上传失败');return x.media_id as string}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
async function publishWechatDraft(j:DirectJob){if(DRY_RUN)throw Error('当前仍是 DRY RUN，公众号草稿写入已锁定');const access=await wechatToken(),sourceImages=j.kind==='images'?j.files.filter(x=>x.role==='image'&&x.ready).map(x=>x.path):[await ensureVideoCover(j)];if(!sourceImages.length)throw Error('公众号草稿缺少封面');const cover=await uploadWxCover(access,sourceImages[0]),urls=[];for(const fp of sourceImages)urls.push(await uploadWxInline(access,fp));const paras=j.body.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>`<p style="font-size:16px;line-height:1.9;color:#222;margin:0 0 16px;">${esc(x)}</p>`).join(''),media=urls.map((u,i)=>`<p style="margin:18px 0;"><img src="${u}" style="max-width:100%;height:auto;display:block;" /></p>${j.kind==='video'&&i===0?'<p style="font-size:13px;color:#888;line-height:1.7;">视频成片已同步发布到短视频平台；公众号草稿保留封面与同版文案。</p>':''}`).join(''),content=`<section style="padding:4px 0 24px;">${paras}${media}</section>`,digest=j.body.replace(/\s+/g,' ').slice(0,110),payload={articles:[{article_type:'news',title:j.title,author:'VOX音乐教室',digest,content,content_source_url:'',thumb_media_id:cover,need_open_comment:0,only_fans_can_comment:0}]};const out:any=await wxJson(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(access)}`,{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify(payload)});return String(out.media_id||'')}
export function directPublishStatus(){const local=localPublisherStatus();return{dryRun:DRY_RUN,account:ACCOUNT,sau:local.sau,wechat:{configured:!!process.env.WECHAT_APP_ID&&!!process.env.WECHAT_APP_SECRET},host:os.hostname()}}
export async function runDirectPublish(id:string){
  const j=getDirectJob(id);
  if(!j) throw Error('发布任务不存在');
  if(!j.files.length||j.files.some(x=>!x.ready)) throw Error('还有文件没有上传完成');
  if(j.status==='publishing') throw Error('发布任务正在执行中');
  j.status='publishing';
  writeJob(j);
  for(const p of j.platforms){
    j.results[p]={status:'running'};
    writeJob(j);
    try{
      if(p==='wechat'){
        const remoteId=await publishWechatDraft(j);
        j.results[p]={status:'succeeded',remoteId,message:j.kind==='video'?'公众号图文草稿已生成（封面/首帧 + 同版文案）':'公众号草稿已生成',finishedAt:new Date().toISOString()};
      }else{
        const output=await publishSocial(j,p);
        j.results[p]={status:'succeeded',message:clip(output,900)||'发布成功',finishedAt:new Date().toISOString()};
      }
    }catch(e:any){
      j.results[p]={status:'failed',message:clip(e?.stderr||e?.stdout||e?.message||e,1200),finishedAt:new Date().toISOString()};
    }
    writeJob(j);
  }
  const selected=j.platforms.map(p=>j.results[p]);
  const ok=selected.filter(x=>x.status==='succeeded').length;
  j.status=ok===selected.length?'completed':ok?'partial':'failed';
  return writeJob(j);
}
