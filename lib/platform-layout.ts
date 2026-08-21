import fs from 'node:fs';
import path from 'node:path';
import {load} from 'cheerio';

type Block={id:string,html:string,context:'root'|'story',kind:string,tag:string};
type Layout='cover'|'editorial'|'signal'|'closing'|'standard';
type PagePlan={blocks:Block[],layout:Layout};

function browserAsset(packageId:string,masterHtml:string,src:string){
  if(/^https?:\/\//i.test(src)||src.startsWith('/api/'))return src;
  const root=path.join(process.cwd(),'public','generated',packageId);
  const abs=path.resolve(path.dirname(masterHtml),src),rel=path.relative(root,abs).split(path.sep).join('/');
  if(rel.startsWith('..'))throw new Error('MASTER_ASSET_OUTSIDE_PACKAGE: '+src);
  return `/api/publish/generated-file?packageId=${encodeURIComponent(packageId)}&file=${encodeURIComponent(rel)}`;
}
function rewriteAssets(packageId:string,masterHtml:string,html:string){
  const $=load(html,undefined,false);
  $('img').each((_,el)=>{const src=$(el).attr('src');if(src)$(el).attr('src',browserAsset(packageId,masterHtml,src));$(el).removeAttr('srcset')});
  $('figcaption').each((_,el)=>{if($(el).text().trim().startsWith('图像来源：'))$(el).remove()});
  return $.html();
}
function cleanKind(x:string){return x.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'plain'}
export function extractLockedBlocks(packageId:string,masterHtml:string){
  const source=fs.readFileSync(masterHtml,'utf8'),$=load(source),styles=$('style').map((_,e)=>$(e).html()||'').get().join('\n');
  const root=$('main').first().length?$('main').first():$('body').first();const blocks:Block[]=[];let n=0;
  const add=(el:any,context:'root'|'story')=>{const node=$(el),tag=String((el as any).tagName||'').toLowerCase(),kind=cleanKind(String(node.attr('class')||tag)),txt=node.text().trim();if(kind.includes('endnote')&&(txt.includes('SOURCES.md')||txt.includes('内部排版预览')))return;const raw=$.html(el);if(!raw.trim())return;blocks.push({id:`B${String(++n).padStart(2,'0')}`,html:rewriteAssets(packageId,masterHtml,raw),context,kind,tag})};
  root.children().each((_,el)=>{const tag=String((el as any).tagName||'').toLowerCase();if(tag==='article'&&$(el).children().length>1)$(el).children().each((__,child)=>add(child,'story'));else add(el,'root')});
  if(!blocks.length)throw new Error('MASTER_BLOCKS_EMPTY');return{blocks,styles};
}
function isKind(b:Block,k:string){return b.kind.split('-').includes(k)||b.kind.includes(k)}
function composePages(blocks:Block[]):PagePlan[]{
  const pages:PagePlan[]=[];let i=0;
  const cover:Block[]=[];while(i<blocks.length&&(isKind(blocks[i],'mast')||isKind(blocks[i],'cover')))cover.push(blocks[i++]);
  if(cover.length)pages.push({blocks:cover,layout:'cover'});
  const preface:Block[]=[];while(i<blocks.length&&!isKind(blocks[i],'chapter')&&!isKind(blocks[i],'quote')&&!isKind(blocks[i],'signal'))preface.push(blocks[i++]);
  let firstChapter=true;
  while(i<blocks.length&&isKind(blocks[i],'chapter')){
    const group:Block[]=[];if(firstChapter&&preface.length)group.push(...preface);firstChapter=false;group.push(blocks[i++]);
    while(i<blocks.length&&!isKind(blocks[i],'chapter')&&!isKind(blocks[i],'quote')&&!isKind(blocks[i],'signal')&&!isKind(blocks[i],'course-cta')&&!isKind(blocks[i],'endnote'))group.push(blocks[i++]);
    pages.push({blocks:group,layout:'editorial'});
  }
  if(preface.length&&firstChapter)pages.push({blocks:preface,layout:'standard'});
  const signal:Block[]=[];while(i<blocks.length&&(isKind(blocks[i],'quote')||isKind(blocks[i],'signal')))signal.push(blocks[i++]);
  if(signal.length)pages.push({blocks:signal,layout:'signal'});
  const closing:Block[]=[];while(i<blocks.length)closing.push(blocks[i++]);if(closing.length)pages.push({blocks:closing,layout:'closing'});
  return pages;
}
function blockHtml(b:Block){return `<div class="locked-block kind-${b.kind}" data-block="${b.id}">${b.html}</div>`}
function pageInner(page:PagePlan){
  if(page.layout==='editorial'){const text=page.blocks.filter(b=>b.tag!=='figure'),media=page.blocks.filter(b=>b.tag==='figure');return `<article class="editorial-layout"><div class="editorial-copy">${text.map(blockHtml).join('')}</div><aside class="editorial-media">${media.map(blockHtml).join('')}</aside></article>`}
  if(page.layout==='signal')return `<article class="signal-layout">${page.blocks.map(blockHtml).join('')}</article>`;
  if(page.layout==='closing')return `<article class="closing-layout">${page.blocks.map(blockHtml).join('')}</article>`;
  return `<article class="standard-layout">${page.blocks.map(blockHtml).join('')}</article>`;
}
const override=`
html,body{margin:0!important;width:1080px!important;height:1440px!important;overflow:hidden!important;background:var(--paper,#f2efe6)!important;color:var(--ink,#171715)!important}
body{font-family:var(--serif,"Songti SC",serif)!important;font-size:25px!important;line-height:1.64!important}
.platform-page{position:relative;width:1080px;height:1440px;overflow:hidden;padding:68px 72px 62px;background:inherit;color:inherit}
.platform-page:before{content:"";position:absolute;inset:24px;border:1px solid rgba(23,23,21,.14);pointer-events:none}
.locked-block{position:relative;min-width:0}.platform-page .story,.platform-page .mast,.platform-page .endnote{width:100%!important;max-width:none!important;margin:0!important}
.platform-page p{orphans:2;widows:2}.platform-page .chapter{margin:0 0 24px!important;font:600 18px/1.25 var(--mono,monospace)!important;letter-spacing:.18em!important;color:var(--accent,#9a6b3b)!important}
.platform-page figure{width:100%!important;max-width:none!important;margin:0!important;transform:none!important;padding-top:10px!important;border-top:1px solid var(--ink,#171715)!important}
.platform-page figure img{display:block!important;width:100%!important;height:auto!important;max-height:720px!important;object-fit:contain!important;filter:none!important}
.platform-page figcaption{display:flex!important;justify-content:space-between!important;gap:12px!important;margin-top:10px!important;font:12px/1.4 var(--mono,monospace)!important;color:var(--muted,#746f65)!important;letter-spacing:.01em!important}
.platform-page .quote{max-width:none!important;font-size:34px!important;line-height:1.42!important}

.cover-page{padding:58px 64px}.cover-page:before{inset:22px}.cover-page .cover-art{position:absolute;right:64px;bottom:68px;width:470px;height:784px;object-fit:contain;z-index:0}.cover-page .vox-logo{position:absolute;right:72px;top:66px;width:142px;height:auto;z-index:4}.cover-page .standard-layout{position:relative;z-index:2;width:100%;height:100%}.cover-page .kind-mast{width:620px}.cover-page .mast{font-size:12px!important}.cover-page .kind-cover{width:650px;margin-top:120px}.cover-page .cover{width:650px!important;min-height:0!important;margin:0!important;grid-template-columns:0 1fr 0!important;border-block:0!important}.cover-page .cover-inner{padding:0!important}.cover-page .issue{font-size:13px!important;margin-bottom:28px!important}.cover-page h1{font-size:68px!important;line-height:1.14!important;max-width:620px!important}.cover-page .dek{font-size:21px!important;line-height:1.65!important;max-width:520px!important;margin-top:30px!important}

.editorial-page{padding:72px 70px 58px}.editorial-layout{height:100%;display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:34px;align-items:start}.editorial-copy{min-width:0}.editorial-media{min-width:0;align-self:start;margin-top:72px}.editorial-copy .locked-block+.locked-block{margin-top:20px}.editorial-copy .kind-chapter{margin-top:8px!important}.editorial-copy p{margin:0!important;font-size:23px!important;line-height:1.66!important}.editorial-copy .locked-block:first-child:not(.kind-chapter) p{font-size:20px!important;line-height:1.58!important;color:#4e4a43!important;padding:0 0 20px;border-bottom:1px solid var(--rule,#cfc8ba)}.editorial-media figure{background:rgba(255,255,255,.16);padding:12px 0 0!important}.editorial-media figure img{max-height:940px!important}.editorial-media figcaption{font-size:11px!important;flex-direction:column!important;gap:3px!important}.editorial-media .locked-block+.locked-block{margin-top:26px}

.signal-page{padding:64px 70px}.signal-layout{height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:26px 34px;align-content:start}.signal-layout>.kind-quote{grid-column:1/-1;margin:0!important;padding:18px 0 20px!important}.signal-layout>.kind-signal-explainer{grid-column:1}.signal-layout>.kind-signal-diagram{grid-column:2;align-self:start}.signal-page .signal-explainer{margin:0!important}.signal-page .signal-explainer__lead,.signal-page .signal-explainer__outro{font-size:18px!important;line-height:1.58!important;margin:0 0 16px!important}.signal-page .fx-notes{display:block!important}.signal-page .fx-note{padding:15px 0!important;border-left:0!important}.signal-page .fx-note+.fx-note{border-top:1px solid var(--rule,#cfc8ba)!important}.signal-page .fx-note__label{font-size:12px!important;margin-bottom:8px!important}.signal-page .fx-note p{font-size:17px!important;line-height:1.52!important}.signal-page .signal-diagram{margin:0!important;padding-top:0!important;border-top:0!important}.signal-page .signal-diagram svg{width:100%!important;height:auto!important}.signal-page .signal-diagram figcaption{margin-top:8px!important;font-size:10px!important;flex-direction:column!important;gap:2px!important}

.closing-page{padding:78px 82px 58px}.closing-layout{height:100%;display:flex;flex-direction:column}.closing-layout>.kind-p p{margin:0!important;font-size:25px!important;line-height:1.7!important}.closing-layout>.kind-course-cta{margin-top:44px}.closing-page .course-cta{margin:0!important;padding:22px 0 24px!important}.closing-page .course-cta__eyebrow{font-size:12px!important}.closing-page .course-cta h2{font-size:34px!important;line-height:1.4!important}.closing-page .course-cta__copy{font-size:19px!important;line-height:1.6!important;margin:14px 0 18px!important}.closing-page .course-cover{max-width:520px!important}.closing-page .course-cover img{max-height:360px!important;object-fit:cover!important}.closing-layout>.kind-endnote{margin-top:auto!important;padding-top:14px!important;border-top:1px solid var(--rule,#cfc8ba)!important}.closing-page .endnote{font:10px/1.5 var(--mono,monospace)!important;color:var(--muted,#746f65)!important}
`;

export function buildLockedPlatformPages(args:{packageId:string;masterHtml:string;coverVisualPath:string;platform:string;outDir:string}){
  const {blocks,styles}=extractLockedBlocks(args.packageId,args.masterHtml),pages=composePages(blocks);if(!pages.length||pages.length>16)throw new Error('LOCKED_PAGINATION_INVALID');fs.mkdirSync(args.outDir,{recursive:true});
  const coverRel=path.relative(path.join(process.cwd(),'public','generated',args.packageId),args.coverVisualPath).split(path.sep).join('/'),coverUrl=`/api/publish/generated-file?packageId=${encodeURIComponent(args.packageId)}&file=${encodeURIComponent(coverRel)}`,logoUrl=`/api/publish/cover-file?packageId=${encodeURIComponent(args.packageId)}&kind=logo`;
  const files:string[]=[];
  for(let i=0;i<pages.length;i++){
    const page=pages[i],name=`page-${String(i+1).padStart(2,'0')}.html`,fp=path.join(args.outDir,name),pageClass=`${page.layout}-page`,extras=page.layout==='cover'?`<img class="cover-art" src="${coverUrl}" alt=""><img class="vox-logo" src="${logoUrl}" alt="">`:'';
    const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080,height=1440"><style>${styles}\n${override}</style></head><body><main class="platform-page ${pageClass}" data-platform="${args.platform}" data-page="${i+1}">${extras}${pageInner(page)}</main></body></html>`;
    fs.writeFileSync(fp,html);files.push(fp);
  }
  fs.writeFileSync(path.join(args.outDir,'manifest.json'),JSON.stringify({pages:files.map(f=>path.basename(f)),mode:'locked-master-editorial-groups',layouts:pages.map(p=>p.layout)},null,2));
  return{files,pages:pages.length,blocks:blocks.length};
}
