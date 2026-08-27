import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const repo=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sinote-calibration-'));
process.chdir(temp);process.env.SQLITE_PATH=path.join(temp,'vox.sqlite');
const db=await import(new URL('../lib/db.ts',import.meta.url));
after(()=>{process.chdir(repo);fs.rmSync(temp,{recursive:true,force:true})});

function addTopic(title='Creator Calibration 回归选题'){
  const topic={id:randomUUID(),title,column:'yueli',whyNow:'现在',voxAngle:'从一个具体教学时刻进入',source:'test source',sourceUrl:null,freshness:8,voxFit:8,audible:8,format:'文章'};
  db.upsertTopics([topic]);return topic;
}

test('无 content id 绝不回退到最近更新的历史内容',()=>{
  const first=db.selectTopic(addTopic('旧内容').id),second=db.selectTopic(addTopic('新内容').id);
  assert.equal(db.getContent(undefined),null);
  assert.equal(db.getContent(first)?.id,first);
  assert.equal(db.getContent(second)?.id,second);
});

test('新内容的对话、brief 与来源观察可恢复，并只在确认后提供 writer context',()=>{
  const contentId=db.selectTopic(addTopic().id);
  assert.equal(db.isCreatorCalibrationEligible(contentId),true);
  db.ensureCreatorCalibration(contentId,'chat');
  const userMessageId=db.appendCreatorCalibrationMessage(contentId,{role:'user',body:'我总觉得学生把炫技当成会弹琴，课堂里反而听不见节奏。'});
  db.appendCreatorCalibrationMessage(contentId,{role:'assistant',body:'能不能说一个你亲眼看到的时刻？'});
  db.saveCreatorCalibrationObservations(contentId,[{kind:'judgment',value:'炫技不等于会弹琴',confidence:.9}],userMessageId);
  const brief={starting_idea:'炫技与音乐性',problem:'学生为何把速度误当能力',user_judgment:'先听见节奏，再谈速度',experiences:['排练时学生只顾加速'],examples:['合奏进副歌时节奏散掉'],counterarguments:['速度训练仍然必要'],boundaries:['不把慢等同于高级'],angle:'从一节合奏课的失速进入',desired_reader_reaction:'愿意重新听节奏',useful_original_quotes:['听不见节奏'],evidence_needed:['没有'],conversation_summary:'从课堂失速谈音乐性'};
  db.saveCreatorBrief(contentId,brief);
  assert.equal(db.getConfirmedCreatorWriterContext(contentId),null);
  const confirmed=db.confirmCreatorBrief(contentId,brief);
  const restored=db.getCreatorCalibration(contentId);
  assert.equal(restored.messages.length,2);
  assert.equal(restored.observations[0].source_message_id,userMessageId);
  assert.equal(restored.brief.user_judgment,'先听见节奏，再谈速度');
  assert.match(confirmed.writerContext,/用户原话/);
  assert.match(db.getConfirmedCreatorWriterContext(contentId),/合奏课的失速/);
  const blankPayload=db.resolveGenerationContext(contentId,'');
  const stalePayload=db.resolveGenerationContext(contentId,'这是刷新前遗留的旧 textarea 文本，不能覆盖已确认的 Brief。');
  assert.equal(blankPayload?.source,'confirmed_calibration');
  assert.equal(stalePayload?.source,'confirmed_calibration');
  assert.equal(blankPayload?.writerContext,confirmed.writerContext);
  assert.equal(stalePayload?.writerContext,confirmed.writerContext);
  assert.equal(db.isCreatorCalibrationEligible(contentId),true);
});

test('直接输入自动保存为本 content 的独立模式，未完成选择器不自动打开它',()=>{
  const contentId=db.selectTopic(addTopic('直接写回归').id);
  db.saveCreatorDirectDraft(contentId,'这是我已经想清楚的判断。');
  const restored=db.getCreatorCalibration(contentId);
  assert.equal(restored.mode,'direct');
  assert.equal(restored.direct_text,'这是我已经想清楚的判断。');
  assert.equal(db.getContent(contentId)?.user_raw_input,'这是我已经想清楚的判断。');
  assert.deepEqual(db.resolveGenerationContext(contentId,'这是刷新后的直接输入。'),{writerContext:'这是刷新后的直接输入。',source:'viewpoint'});
  assert.ok(db.listUnfinishedContent().some(x=>x.id===contentId));
});

test('手动话题创建真实 topic/content、标记来源并防止快速重复提交',()=>{
  const input={title:'我想写为什么练琴总是拖延',notes:'每次坐下前都会先整理设备。'};
  const first=db.createManualTopic(input),duplicate=db.createManualTopic(input),item=db.getContent(first.contentId),library=db.getContentLibraryItem(first.contentId);
  assert.equal(first.reused,false);
  assert.equal(duplicate.reused,true);
  assert.equal(duplicate.contentId,first.contentId);
  assert.equal(item.topic_title,input.title);
  assert.equal(item.source_kind,'manual_topic');
  assert.equal(item.user_raw_input,input.notes);
  assert.match(item.source_summary,/用户补充说明/);
  assert.equal(db.isCreatorCalibrationEligible(first.contentId),true);
  assert.equal(library.sourceLabel,'我的选题');
});
