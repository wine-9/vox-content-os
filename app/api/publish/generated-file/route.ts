import fs from 'node:fs/promises';
import path from 'node:path';
import {getPublishPackage} from '../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const types:Record<string,string>={
  '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8',
  '.md':'text/markdown; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.avif':'image/avif'
};
function safeRelative(s:string){const n=path.posix.normalize('/'+s).slice(1);return !n||n.startsWith('..')||path.isAbsolute(n)?null:n}
function fileUrl(packageId:string,rel:string){return `/api/publish/generated-file?packageId=${encodeURIComponent(packageId)}&file=${encodeURIComponent(rel)}`}
function rewriteHtml(html:string,packageId:string,relFile:string){
  const dir=path.posix.dirname(relFile);
  const rewrite=(raw:string)=>{
    const v=raw.trim();
    if(!v||v.startsWith('/')||/^(?:https?:|data:|blob:|mailto:|tel:|#|javascript:)/i.test(v))return raw;
    const [pathname,...rest]=v.split(/([?#].*)/,2);
    const resolved=safeRelative(path.posix.join(dir,pathname));
    if(!resolved)return raw;
    return fileUrl(packageId,resolved)+(rest[0]||'');
  };
  let out=html.replace(/\b(src|href)=(['"])(.*?)\2/gi,(_m,a,q,v)=>`${a}=${q}${rewrite(v)}${q}`);
  out=out.replace(/url\((['"]?)([^)'"\s]+)\1\)/gi,(_m,q,v)=>`url(${q}${rewrite(v)}${q})`);
  return out;
}
export async function GET(req:Request){
  const u=new URL(req.url),packageId=u.searchParams.get('packageId')||'',requested=u.searchParams.get('file')||'';
  if(!packageId||!getPublishPackage(packageId))return new Response('not found',{status:404});
  const rel=safeRelative(requested);if(!rel)return new Response('invalid file',{status:400});
  const root=path.resolve(process.cwd(),'public','generated',packageId),fp=path.resolve(root,rel);
  if(fp!==root&&!fp.startsWith(root+path.sep))return new Response('invalid file',{status:400});
  try{
    const ext=path.extname(fp).toLowerCase(),type=types[ext]||'application/octet-stream';
    if(ext==='.html'||ext==='.htm'){
      const html=await fs.readFile(fp,'utf8');
      return new Response(rewriteHtml(html,packageId,rel),{headers:{'content-type':type,'cache-control':'no-store'}});
    }
    const b=await fs.readFile(fp);
    return new Response(b,{headers:{'content-type':type,'cache-control':'no-store'}});
  }catch{return new Response('file missing',{status:404})}
}
