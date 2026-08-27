import {appendCreatorCalibrationMessage,confirmCreatorBrief,ensureCreatorCalibration,getContent,getCreatorCalibration,isCreatorCalibrationEligible,saveCreatorBrief,saveCreatorCalibrationObservations,saveCreatorDirectDraft,setCreatorCalibrationState} from '../../../../lib/db';
import {kimiCreatorCalibration} from '../../../../lib/kimi';

export const runtime='nodejs';

function errorMessage(error:any){
  const text=String(error?.message||'对话暂时没有完成').replace(/(?:KIMI|GEMINI)_[A-Z_]+:?\s*/,'').trim();
  if(error?.message==='KIMI_API_KEY_MISSING'||error?.message==='GEMINI_API_KEY_MISSING')return '写前对话服务还没有配置好，请稍后重试，或先用“我已经想清楚了”。';
  return text||'对话暂时没有完成，请重试。';
}
function canUse(contentId:string){return isCreatorCalibrationEligible(contentId)||Boolean(getCreatorCalibration(contentId));}
async function planNext(contentId:string,sourceMessageId?:string){
  const item:any=getContent(contentId);if(!item)throw new Error('content not found');
  const calibration:any=getCreatorCalibration(contentId);if(!calibration)throw new Error('calibration not found');
  const result=await kimiCreatorCalibration({title:item.topic_title,voxAngle:item.vox_angle,source:item.source_summary,messages:calibration.messages||[]});
  appendCreatorCalibrationMessage(contentId,{role:'assistant',body:result.reply,stage:result.ready?'brief':'chat',metadata:{model:result.model,ready:result.ready}});
  saveCreatorBrief(contentId,result.brief,result.ready?'brief_ready':'chatting');
  saveCreatorCalibrationObservations(contentId,result.observations,sourceMessageId);
  setCreatorCalibrationState(contentId,{mode:'chat',status:result.ready?'brief_ready':'chatting',lastError:null});
  return getCreatorCalibration(contentId);
}

export async function POST(req:Request){
  let body:any={};try{body=await req.json()}catch{return Response.json({ok:false,error:'请求格式不正确'},{status:400})}
  const contentId=String(body.contentId||'');const action=String(body.action||'');
  if(!contentId||!action)return Response.json({ok:false,error:'contentId and action required'},{status:400});
  if(!getContent(contentId))return Response.json({ok:false,error:'content not found'},{status:404});
  if(!canUse(contentId))return Response.json({ok:false,error:'这条已有草稿或已定稿内容会沿用原来的写作流程。'},{status:409});
  try{
    if(action==='direct_draft')return Response.json({ok:true,calibration:saveCreatorDirectDraft(contentId,String(body.directText||''))});
    if(action==='save_brief')return Response.json({ok:true,calibration:saveCreatorBrief(contentId,body.brief,'brief_ready')});
    if(action==='confirm_brief'){
      const confirmed=confirmCreatorBrief(contentId,body.brief);
      return Response.json({ok:true,...confirmed});
    }
    if(action==='continue')return Response.json({ok:true,calibration:setCreatorCalibrationState(contentId,{mode:'chat',status:'chatting',lastError:null})});
    if(action==='start'){
      const current:any=ensureCreatorCalibration(contentId,'chat');
      if((current.messages||[]).length)return Response.json({ok:true,calibration:current});
      try{return Response.json({ok:true,calibration:await planNext(contentId)})}
      catch(error:any){const calibration=setCreatorCalibrationState(contentId,{mode:'chat',status:'chatting',lastError:errorMessage(error)});return Response.json({ok:false,error:errorMessage(error),calibration,retryable:true},{status:503})}
    }
    if(action==='reply'){
      const text=String(body.text||'').trim();if(!text)return Response.json({ok:false,error:'请先写下一句想法。'},{status:400});
      const messageId=appendCreatorCalibrationMessage(contentId,{role:'user',body:text,stage:'chat'});
      try{return Response.json({ok:true,calibration:await planNext(contentId,messageId)})}
      catch(error:any){const calibration=setCreatorCalibrationState(contentId,{mode:'chat',status:'chatting',lastError:errorMessage(error)});return Response.json({ok:false,error:errorMessage(error),calibration,retryable:true},{status:503})}
    }
    if(action==='retry'){
      try{return Response.json({ok:true,calibration:await planNext(contentId)})}
      catch(error:any){const calibration=setCreatorCalibrationState(contentId,{mode:'chat',status:'chatting',lastError:errorMessage(error)});return Response.json({ok:false,error:errorMessage(error),calibration,retryable:true},{status:503})}
    }
    return Response.json({ok:false,error:'unknown action'},{status:400});
  }catch(error:any){return Response.json({ok:false,error:errorMessage(error)},{status:500})}
}
