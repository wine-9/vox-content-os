import { createManualTopic } from '../../../../lib/db';

export const runtime='nodejs';

export async function POST(req:Request){
  try{
    const body=await req.json(),title=String(body?.title||'').trim(),notes=String(body?.notes||'').trim();
    if([...title].length<2)return Response.json({ok:false,error:'请先写下一句你想讨论的话题。'},{status:400});
    if([...title].length>140)return Response.json({ok:false,error:'话题请控制在 140 字以内。'},{status:400});
    if([...notes].length>3000)return Response.json({ok:false,error:'补充说明请控制在 3000 字以内。'},{status:400});
    const created=createManualTopic({title,notes});
    return Response.json({ok:true,...created});
  }catch(error:any){
    return Response.json({ok:false,error:String(error?.message||'创建我的选题失败，请重试。').slice(0,500)},{status:400});
  }
}
