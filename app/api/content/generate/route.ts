import { beginCandidateSet,candidateWriterKeys,finalizeCandidateSet,getActiveSkill,getContent,saveCandidateVariant } from '../../../../lib/db';
import { kimiWriterCandidate } from '../../../../lib/kimi';
import type { WriterKey } from '../../../../lib/writer-skills';
export const runtime='nodejs';
const writers:WriterKey[]=['control','human_writing','ultimate_fusion'];
export async function POST(req:Request){
  const {contentId,viewpoint}=await req.json();if(!contentId||!viewpoint)return Response.json({ok:false,error:'contentId and viewpoint required'},{status:400});
  const item:any=getContent(contentId);if(!item)return Response.json({ok:false,error:'content not found'},{status:404});
  try{
    const skill:any=getActiveSkill(),setId=beginCandidateSet(contentId,viewpoint),existing=new Set(candidateWriterKeys(setId));
    const missing=writers.filter(w=>!existing.has(w));
    if(missing.length){const writer=missing[Math.floor(Math.random()*missing.length)];const r=await kimiWriterCandidate({writer,viewpoint,learnedSkillBody:writer==='ultimate_fusion'?skill?.body:undefined,learnedSkillVersion:writer==='ultimate_fusion'?skill?.version:undefined});saveCandidateVariant(setId,{writerKey:writer,body:r.text,model:r.model,skillVersionId:writer==='ultimate_fusion'?skill?.id:undefined});}
    const keys=candidateWriterKeys(setId),complete=keys.length===3,finalized:any=complete?finalizeCandidateSet(setId):null;
    return Response.json({ok:true,setId,complete,generatedCount:keys.length,missingCount:3-keys.length,candidates:finalized?.candidates||[],retryNeeded:!complete});
  }catch(e:any){const missing=e.message==='KIMI_API_KEY_MISSING';return Response.json({ok:false,error:e.message,needsKey:missing},{status:missing?503:500})}
}
