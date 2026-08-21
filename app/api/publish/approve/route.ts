import {approvePublishPackage} from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){try{const {id}=await req.json();if(!id)return Response.json({ok:false,error:'id required'},{status:400});return Response.json({ok:true,publishState:approvePublishPackage(id),rendered:false,renderMode:'html_first'})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
