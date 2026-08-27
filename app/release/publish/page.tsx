import {redirect} from 'next/navigation';
export default async function LegacyReleasePublish({searchParams}:{searchParams:Promise<{id?:string}>}){const q=await searchParams;redirect(q?.id?`/publish?id=${encodeURIComponent(q.id)}`:'/publish')}
