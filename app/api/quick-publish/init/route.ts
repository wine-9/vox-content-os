import{createDirectJob,listDirectJobs}from'../../../../lib/direct-publish';export const runtime='nodejs';
export async function GET(){return Response.json({ok:true,items:listDirectJobs()})}
export async function POST(req:Request){try{const x=await req.json();return Response.json({ok:true,job:createDirectJob(x)})}catch(e:any){return Response.json({ok:false,error:String(e.message||e)},{status:400})}}
