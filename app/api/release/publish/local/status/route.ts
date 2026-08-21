import{localPublisherStatus}from'../../../../../../lib/local-social-publish';export const runtime='nodejs';export async function GET(){return Response.json({ok:true,...localPublisherStatus()})}
