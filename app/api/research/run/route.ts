import { runResearch } from '../../../../lib/research';
import { upsertResearch,upsertTopics,listTopics,clearProposedTopics } from '../../../../lib/db';
export const runtime='nodejs';
export async function POST(req:Request){try{const body=await req.json().catch(()=>({}));const r=await runResearch(Array.isArray(body.keywords)&&body.keywords.length?body.keywords:undefined);upsertResearch(r.items);clearProposedTopics();upsertTopics(r.topics);return Response.json({ok:true,fetched:r.items.length,top20:listTopics(20),errors:r.errors,browserBridge:r.browserBridge,omniseek:r.omniseek})}catch(e:any){return Response.json({ok:false,error:e.message},{status:500})}}
