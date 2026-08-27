import {listContentLibrary} from '../../lib/db';
import ContentLibraryClient from './ContentLibraryClient';
import {SagePageHeader,SageStatus} from '../../components/SageUI';
export const dynamic='force-dynamic';
export default function ContentPage(){return <><SagePageHeader eyebrow="Sinote / Content" title="内容" description="这里是所有内容的统一入口：看进度、看发布结果，或从上次停下的地方继续。" status={<SageStatus tone="warning">测试模式 · 不会写入外部平台</SageStatus>} /><ContentLibraryClient items={listContentLibrary(300)}/></>}
