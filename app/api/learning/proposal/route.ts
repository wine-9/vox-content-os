import { proposalEvidence,reviewProposal } from '../../../../lib/db';
export const runtime='nodejs';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('id');if(!id)return Response.json({ok:false,error:'id required'},{status:400});const item=proposalEvidence(id);return item?Response.json({ok:true,item}):Response.json({ok:false,error:'proposal not found'},{status:404})}
export async function POST(req:Request){try{const {id,action,note}=await req.json();if(!id||!['approve','reject'].includes(action))return Response.json({ok:false,error:'id and valid action required'},{status:400});const status=reviewProposal(id,action,note||'');return Response.json({ok:true,status})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
