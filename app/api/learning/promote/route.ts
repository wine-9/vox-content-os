import { promoteProposal } from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){try{const {id,body}=await req.json();if(!id||!body)return Response.json({ok:false,error:'id and body required'},{status:400});const skill=promoteProposal(id,body);return Response.json({ok:true,skill})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
