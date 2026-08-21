import{directPublishStatus,getDirectJob,listDirectJobs}from'../../../../lib/direct-publish';export const runtime='nodejs';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('id')||'';return Response.json({ok:true,status:directPublishStatus(),job:id?getDirectJob(id):null,items:id?undefined:listDirectJobs(12)})}
