import {setTopicSaved} from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){try{const {topicId,saved=true}=await req.json();if(!topicId)return Response.json({ok:false,error:'topicId required'},{status:400});return Response.json({ok:true,status:setTopicSaved(topicId,!!saved)})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
