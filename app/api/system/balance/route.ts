import {KIMI_BASE_URL} from '../../../../lib/kimi';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function endpoint(base:string){const b=base.replace(/\/+$/,'');return /\/v1$/i.test(b)?`${b}/user/info`:`${b}/v1/user/info`}
export async function GET(){
  const key=process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY;
  if(!key)return Response.json({ok:false,error:'API_KEY_MISSING'},{status:503});
  try{
    const res=await fetch(endpoint(KIMI_BASE_URL),{headers:{authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(12000)});
    const raw=await res.text();
    if(!res.ok)return Response.json({ok:false,error:`BALANCE_${res.status}`,updatedAt:new Date().toISOString()},{status:502});
    const x=JSON.parse(raw),d=x?.data||{};
    if(x?.status===false||!d||typeof d!=='object')return Response.json({ok:false,error:'BALANCE_INVALID_RESPONSE',updatedAt:new Date().toISOString()},{status:502});
    return Response.json({ok:true,provider:'SiliconFlow',totalBalance:d.totalBalance??null,chargeBalance:d.chargeBalance??null,balance:d.balance??null,accountStatus:d.status??null,updatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store'}});
  }catch(e:any){return Response.json({ok:false,error:e?.name==='TimeoutError'?'BALANCE_TIMEOUT':'BALANCE_FAILED',updatedAt:new Date().toISOString()},{status:502})}
}
