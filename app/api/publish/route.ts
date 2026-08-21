import {listPublishItems} from '../../../lib/db';
export const runtime='nodejs';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('id')||undefined;return Response.json({ok:true,items:listPublishItems(id)})}
