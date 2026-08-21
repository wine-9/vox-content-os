import fs from 'node:fs/promises';
import path from 'node:path';
import {ensureCoverSpec,getPublishPackage} from '../../../../lib/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
const types:any={html:'text/html; charset=utf-8',visual:'image/png',png:'image/png'};
export async function GET(req:Request){const u=new URL(req.url),packageId=u.searchParams.get('packageId')||'',kind=u.searchParams.get('kind')||'';if(!packageId||!getPublishPackage(packageId))return new Response('not found',{status:404});let fp='',type='';if(kind==='logo'){fp=path.join(process.cwd(),'public','brand','vox-music-school-logo.png');type='image/png'}else{if(!types[kind])return new Response('invalid kind',{status:400});const c:any=ensureCoverSpec(packageId),field=kind==='html'?'cover_html_path':kind==='visual'?'visual_asset_path':'cover_png_path',rp=String(c?.[field]||'');if(!rp)return new Response('file missing',{status:404});fp=path.resolve(process.cwd(),rp);type=types[kind]}try{const b=await fs.readFile(fp);return new Response(b,{headers:{'content-type':type,'cache-control':'no-store'}})}catch{return new Response('file missing',{status:404})}}
