import fs from 'node:fs/promises';
import {getRenderedAsset} from '../../../../lib/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('id');if(!id)return new Response('id required',{status:400});const a:any=getRenderedAsset(id);if(!a)return new Response('not found',{status:404});try{const b=await fs.readFile(a.file_path);return new Response(b,{headers:{'content-type':'image/png','cache-control':'no-store'}})}catch{return new Response('file missing',{status:404})}}
