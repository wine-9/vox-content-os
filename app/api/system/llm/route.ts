import {getLlmStatus,setActiveLlmProvider,type LlmProvider} from '../../../../lib/llm-config';
export const runtime='nodejs';
export async function GET(){return Response.json({ok:true,...getLlmStatus()})}
export async function POST(req:Request){
  try{const body=await req.json();return Response.json({ok:true,...setActiveLlmProvider(String(body?.provider||'') as LlmProvider)})}
  catch(e:any){const error=String(e?.message||'LLM_SWITCH_FAILED');return Response.json({ok:false,error,...getLlmStatus()},{status:error.endsWith('_API_KEY_MISSING')?409:400})}
}
