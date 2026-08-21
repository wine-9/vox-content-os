import { chooseCandidate } from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){try{const {contentId,setId,choice}=await req.json();if(!contentId||!setId||!choice)return Response.json({ok:false,error:'contentId setId choice required'},{status:400});const set:any=chooseCandidate(contentId,setId,choice);return Response.json({ok:true,set})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
