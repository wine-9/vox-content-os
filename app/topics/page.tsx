import TopicsClient from './TopicsClient';
import {SagePageHeader,SageStatus} from '../../components/SageUI';
export default function TopicsPage(){return <><SagePageHeader eyebrow="Sinote / Topic pipeline" title="选题" description="先选一个你想讲清楚的问题，下一步会带你写下自己的观点和素材。" status={<SageStatus tone="sage">下一步 · 开始写作</SageStatus>} /><TopicsClient/></>}
