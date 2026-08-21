import{runDirectPublish}from'../../../../lib/direct-publish';export const runtime='nodejs';export const maxDuration=1200;
export async function POST(req:Request){try{const x=await req.json();return Response.json({ok:true,job:await runDirectPublish(String(x.jobId||''))})}catch(e:any){return Response.json({ok:false,error:String(e?.stderr||e?.stdout||e?.message||e).slice(0,3000)},{status:400})}}
