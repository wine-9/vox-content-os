import { getContent, listContentLibrary, listUnfinishedContent } from '../../../lib/db';
export const runtime='nodejs';
export async function GET(req:Request){
  const url=new URL(req.url),id=url.searchParams.get('id')||undefined;
  if(url.searchParams.get('list')==='1')return Response.json({items:listContentLibrary()});
  if(url.searchParams.get('list')==='unfinished')return Response.json({items:listUnfinishedContent()});
  // A missing id must never resolve to the most recently touched historical item.
  if(!id)return Response.json({item:null});
  return Response.json({item:getContent(id)});
}
