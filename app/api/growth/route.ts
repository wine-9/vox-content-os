import{growthSummary,savePerformanceSnapshot}from'../../../lib/db';
export const runtime='nodejs';
export async function GET(){return Response.json({ok:true,...growthSummary()})}
export async function POST(req:Request){try{const x=await req.json();savePerformanceSnapshot({contentId:x.contentId,assetId:x.assetId,platform:x.platform,windowLabel:x.windowLabel||'T+3',views:+x.views||0,likes:+x.likes||0,comments:+x.comments||0,shares:+x.shares||0,saves:+x.saves||0});return Response.json({ok:true})}catch(e:any){return Response.json({ok:false,error:e.message},{status:400})}}
