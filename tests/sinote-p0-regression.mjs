import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const repo=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sinote-p0-'));
process.chdir(temp);
process.env.SQLITE_PATH=path.join(temp,'vox.sqlite');
process.env.DRY_RUN_ONLY='true';
const db=await import(new URL('../lib/db.ts',import.meta.url));
const direct=await import(new URL('../lib/direct-publish.ts',import.meta.url));
const execFileAsync=promisify(execFile),loader=path.join(repo,'tests','ts-extension-loader.mjs'),directUrl=new URL('../lib/direct-publish.ts',import.meta.url).href;

function topic(){return{id:randomUUID(),title:'P0 回归选题',column:'yueli',whyNow:'现在',voxAngle:'VOX',source:'test',sourceUrl:null,freshness:8,voxFit:8,audible:8,format:'文章'}}
function addTopic(){const t=topic();db.upsertTopics([t]);return t}

after(()=>{process.chdir(repo);fs.rmSync(temp,{recursive:true,force:true})});

test('P0-1 选题创建与导航 ID 只在原子写入成功后产生',()=>{
  const t=addTopic(),before=db.stats().content,contentId=db.selectTopic(t.id);
  assert.equal(db.getContent(contentId)?.id,contentId);
  assert.equal(db.stats().content,before+1);
  assert.throws(()=>db.selectTopic(randomUUID()),/选题不存在或已失效/);
  assert.equal(db.stats().content,before+1);
});

test('P0-2 HTML 视觉任务持久化、失败可重试、成功可回读',()=>{
  const t=addTopic(),contentId=db.selectTopic(t.id);
  db.saveFinal(contentId,'测试 Final');
  const packageId=db.upsertPublishPackage(contentId,'wechat_long_image',{title:'标题',body:'正文',visualPrompt:'克制',model:'test'});
  const output=path.join(temp,'visual.html'),first=db.beginHtmlVisualGeneration(packageId,'test_theme','Test Theme',output);
  assert.equal(first.accepted,true);
  assert.equal(db.getHtmlVisualState(packageId).generationJobs[0].status,'generating');
  const duplicate=db.beginHtmlVisualGeneration(packageId,'test_theme','Test Theme',output);
  assert.equal(duplicate.accepted,false);
  db.failHtmlVisualGeneration(first.job.id,'模拟失败');
  assert.equal(db.getHtmlVisualState(packageId).generationJobs[0].status,'failed');
  assert.match(db.getHtmlVisualState(packageId).generationJobs[0].error_text,/模拟失败/);
  const retry=db.beginHtmlVisualGeneration(packageId,'test_theme','Test Theme',output);
  assert.equal(retry.accepted,true);
  fs.writeFileSync(output,'<html></html>');
  const completed=db.completeHtmlVisualGeneration(retry.job.id);
  assert.equal(completed.job.status,'succeeded');
  assert.equal(db.getHtmlVisualState(packageId).variants[0].base_file_path,output);
});

test('P0-3 发布台任务先持久化，重复提交被阻止且状态可恢复',()=>{
  const job=direct.createDirectJob({title:'直发回归',body:'正文',platforms:['wechat'],files:[{name:'cover.png',type:'image/png',size:3}]});
  assert.equal(direct.getDirectJob(job.id)?.status,'uploading');
  const ready=direct.markDirectFileReady(job.id,job.files[0].id);
  assert.equal(ready.status,'ready');
  const started=direct.beginDirectPublish(job.id);
  assert.equal(started.alreadyRunning,false);
  assert.equal(direct.getDirectJob(job.id)?.status,'publishing');
  const duplicate=direct.beginDirectPublish(job.id);
  assert.equal(duplicate.alreadyRunning,true);
  assert.equal(direct.getDirectJob(job.id)?.id,job.id);
});

test('P0-3/D 跨进程重复提交只有一个执行赢得锁，DRY RUN 到本地成功终态',async()=>{
  const job=direct.createDirectJob({title:'DRY RUN 锁回归',body:'只在本机模拟',files:[{name:'local.png',type:'image/png',size:3}]});
  direct.markDirectFileReady(job.id,job.files[0].id);
  const childBegin=async()=>{
    const code=`import {beginDirectPublish} from ${JSON.stringify(directUrl)};console.log(JSON.stringify(beginDirectPublish(${JSON.stringify(job.id)})));`;
    const out=await execFileAsync(process.execPath,['--experimental-loader',loader,'--input-type=module','-e',code],{cwd:temp,env:{...process.env,DRY_RUN_ONLY:'true'},maxBuffer:1024*1024});
    return JSON.parse(String(out.stdout).trim().split(/\n/).at(-1));
  };
  const [a,b]=await Promise.all([childBegin(),childBegin()]);
  assert.deepEqual([a.alreadyRunning,b.alreadyRunning].sort(),[false,true]);
  assert.equal(direct.getDirectJob(job.id)?.executionCount,1);
  assert.equal(fs.readdirSync(path.join(temp,'data','quick-publish',job.id)).some(x=>x.endsWith('.tmp')),false);
  const final=await direct.runDirectPublish(job.id,false,true);
  assert.equal(final.status,'completed');
  assert.equal(final.executionCount,1);
  assert.equal(final.terminalMode,'dry_run_local');
  assert.equal(final.externalWriteOccurred,false);
  for(const platform of final.platforms){
    assert.equal(final.results[platform].status,'succeeded');
    assert.equal(final.results[platform].mode,'dry_run_local');
    assert.equal(final.results[platform].externalWrite,false);
    assert.match(final.results[platform].message,/DRY RUN.*未发生外部平台写入/);
  }
  assert.equal(fs.existsSync(path.join(temp,'data','quick-publish',job.id,'.publish-lock')),false);
});
