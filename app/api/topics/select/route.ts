import { selectTopic } from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){try{const {topicId}=await req.json();if(!topicId)return Response.json({ok:false,error:'请选择一个有效选题'},{status:400});const contentId=selectTopic(String(topicId));return Response.json({ok:true,contentId})}catch(e:any){return Response.json({ok:false,error:String(e?.message||e||'创建内容任务失败').slice(0,500)},{status:409})}}
