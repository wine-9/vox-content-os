import {createImportedVideo,listSourceAssets} from '../../../../lib/db';
export const runtime='nodejs';
export async function GET(){return Response.json({ok:true,items:listSourceAssets()})}
export async function POST(req:Request){try{const x=await req.json(),name=String(x.name||''),type=String(x.type||'');if(!name||!type.startsWith('video/'))return Response.json({ok:false,error:'请选择视频文件'},{status:400});return Response.json({ok:true,...createImportedVideo({originalName:name,mimeType:type,sizeBytes:Number(x.size||0),title:x.title,notes:x.notes})})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
