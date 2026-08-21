import { selectTopic } from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){const {topicId}=await req.json();if(!topicId)return Response.json({error:'topicId required'},{status:400});return Response.json({ok:true,contentId:selectTopic(topicId)})}
