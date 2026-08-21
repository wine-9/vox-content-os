import { setLabel,maybeCreateProposal } from '../../../../lib/db';
export const runtime='nodejs';
const allowed=new Set(['worth_learning','one_off','fact_correction']);
export async function POST(req:Request){const {contentId,label}=await req.json();if(!contentId||!allowed.has(label))return Response.json({ok:false,error:'invalid label'},{status:400});setLabel(contentId,label);const proposalId=label==='worth_learning'?maybeCreateProposal():null;return Response.json({ok:true,proposalId})}
