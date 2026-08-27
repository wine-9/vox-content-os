import { beginCandidateSet,candidateWriterKeys,finalizeCandidateSet,getActiveSkill,getContent,resolveGenerationContext,saveCandidateVariant } from '../../../../lib/db';
import { kimiWriterCandidate } from '../../../../lib/kimi';
import type { WriterKey } from '../../../../lib/writer-skills';
export const runtime='nodejs';
const writers:WriterKey[]=['control','human_writing','ultimate_fusion'];
export async function POST(req:Request){
  const {contentId,viewpoint}=await req.json();if(!contentId)return Response.json({ok:false,error:'contentId required'},{status:400});
  const item:any=getContent(contentId);if(!item)return Response.json({ok:false,error:'content not found'},{status:404});
  try{
    // Resolve on the server, not from transient client state. Confirmed chat data
    // always wins over a blank or stale viewpoint; legacy/direct flows are intact.
    const resolved=resolveGenerationContext(contentId,viewpoint);
    if(!resolved)return Response.json({ok:false,error:'请先写下观点和素材，或先确认 Writing Brief。'},{status:400});
    const {writerContext}=resolved;
    const skill:any=getActiveSkill(),setId=beginCandidateSet(contentId,writerContext),existing=new Set(candidateWriterKeys(setId));
    const missing=writers.filter(w=>!existing.has(w));
    if(missing.length){const writer=missing[Math.floor(Math.random()*missing.length)];const r=await kimiWriterCandidate({writer,viewpoint:writerContext,learnedSkillBody:writer==='ultimate_fusion'?skill?.body:undefined,learnedSkillVersion:writer==='ultimate_fusion'?skill?.version:undefined});saveCandidateVariant(setId,{writerKey:writer,body:r.text,model:r.model,skillVersionId:writer==='ultimate_fusion'?skill?.id:undefined});}
    const keys=candidateWriterKeys(setId),complete=keys.length===3,finalized:any=complete?finalizeCandidateSet(setId):null;
    return Response.json({ok:true,setId,complete,generatedCount:keys.length,missingCount:3-keys.length,candidates:finalized?.candidates||[],retryNeeded:!complete,contextSource:resolved.source});
  }catch(e:any){const missing=e.message==='KIMI_API_KEY_MISSING'||e.message==='GEMINI_API_KEY_MISSING';return Response.json({ok:false,error:e.message,needsKey:missing},{status:missing?503:500})}
}
