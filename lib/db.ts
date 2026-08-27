import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ResearchItem = { id:string; source:string; title:string; url?:string; author?:string; summary?:string; publishedAt?:string; query?:string; engagement?:Record<string,unknown> };
export type CreatorBrief={starting_idea:string;problem:string;user_judgment:string;experiences:string[];examples:string[];counterarguments:string[];boundaries:string[];angle:string;desired_reader_reaction:string;useful_original_quotes:string[];evidence_needed:string[];conversation_summary:string};
export type CreatorCalibrationMode='undecided'|'chat'|'direct';
export const emptyCreatorBrief=():CreatorBrief=>({starting_idea:'',problem:'',user_judgment:'',experiences:[],examples:[],counterarguments:[],boundaries:[],angle:'',desired_reader_reaction:'',useful_original_quotes:[],evidence_needed:[],conversation_summary:''});
const dataDir=path.join(process.cwd(),'data'); mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(process.env.SQLITE_PATH || path.join(dataDir,'vox-content-os.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS research_items(id TEXT PRIMARY KEY,source TEXT NOT NULL,title TEXT NOT NULL,url TEXT,author TEXT,summary TEXT,published_at TEXT,query TEXT,engagement_json TEXT,fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS topics(id TEXT PRIMARY KEY,title TEXT NOT NULL,column_key TEXT NOT NULL,why_now TEXT,vox_angle TEXT,source_summary TEXT,source_url TEXT,freshness_score REAL,vox_fit_score REAL,audible_score REAL,suggested_format TEXT,status TEXT NOT NULL DEFAULT 'proposed',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS content_items(id TEXT PRIMARY KEY,topic_id TEXT NOT NULL,content_state TEXT NOT NULL DEFAULT 'awaiting_viewpoint',publish_state TEXT NOT NULL DEFAULT 'dry_run',user_raw_input TEXT,final_text TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(topic_id) REFERENCES topics(id));
CREATE TABLE IF NOT EXISTS article_versions(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,version_type TEXT NOT NULL,body TEXT NOT NULL,model_name TEXT,skill_version_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS learning_labels(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,label TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(content_item_id,label),FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS diff_observations(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,category TEXT NOT NULL,before_text TEXT,after_text TEXT,explanation TEXT,confidence REAL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS skill_proposals(id TEXT PRIMARY KEY,batch_key TEXT NOT NULL,proposal_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',review_note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS skill_versions(id TEXT PRIMARY KEY,version TEXT NOT NULL UNIQUE,body TEXT NOT NULL,changelog TEXT,status TEXT NOT NULL DEFAULT 'draft',source_proposal_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(source_proposal_id) REFERENCES skill_proposals(id));
CREATE TABLE IF NOT EXISTS publish_packages(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,platform TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,visual_prompt TEXT,status TEXT NOT NULL DEFAULT 'package_ready',render_status TEXT NOT NULL DEFAULT 'not_started',model_name TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(content_item_id,platform),FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS rendered_assets(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,kind TEXT NOT NULL,file_path TEXT NOT NULL,width INTEGER,height INTEGER,model_name TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(package_id) REFERENCES publish_packages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS html_visual_variants(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,theme_key TEXT NOT NULL,label TEXT NOT NULL,base_file_path TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'generated',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,selected_at TEXT,UNIQUE(package_id,theme_key),FOREIGN KEY(package_id) REFERENCES publish_packages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS html_visual_generation_jobs(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,theme_key TEXT NOT NULL,label TEXT NOT NULL,output_file_path TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'generating',error_text TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(package_id,theme_key),FOREIGN KEY(package_id) REFERENCES publish_packages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS html_visual_revisions(id TEXT PRIMARY KEY,variant_id TEXT NOT NULL,revision_no INTEGER NOT NULL,file_path TEXT NOT NULL,edit_instruction TEXT NOT NULL,is_final INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(variant_id,revision_no),FOREIGN KEY(variant_id) REFERENCES html_visual_variants(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS cover_specs(package_id TEXT PRIMARY KEY,skill_key TEXT NOT NULL DEFAULT 'gc-minimal-zine-poster-v0-1',status TEXT NOT NULL DEFAULT 'dormant',font_mode TEXT NOT NULL DEFAULT 'serif',logo_asset_path TEXT,notes TEXT,generation_id TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(package_id) REFERENCES publish_packages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS cover_revisions(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,revision_no INTEGER NOT NULL,edit_instruction TEXT NOT NULL,visual_asset_path TEXT NOT NULL,cover_html_path TEXT NOT NULL,cover_png_path TEXT NOT NULL,prompt_text TEXT,model_name TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(package_id,revision_no),FOREIGN KEY(package_id) REFERENCES publish_packages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS platform_adaptations(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,source_package_id TEXT NOT NULL,platform TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'not_started',current_revision_no INTEGER NOT NULL DEFAULT 0,files_json TEXT,model_name TEXT,last_instruction TEXT,error_text TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(content_item_id,platform),FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE,FOREIGN KEY(source_package_id) REFERENCES publish_packages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS platform_adaptation_revisions(id TEXT PRIMARY KEY,adaptation_id TEXT NOT NULL,revision_no INTEGER NOT NULL,files_json TEXT NOT NULL,edit_instruction TEXT,model_name TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(adaptation_id,revision_no),FOREIGN KEY(adaptation_id) REFERENCES platform_adaptations(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS platform_publish_jobs(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,platform TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'not_started',remote_id TEXT,error_text TEXT,meta_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS publish_archives(id TEXT PRIMARY KEY,job_id TEXT UNIQUE,content_item_id TEXT NOT NULL,platform TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,remote_id TEXT,title_snapshot TEXT,master_package_id TEXT,body_snapshot TEXT,social_caption_snapshot TEXT,artifacts_json TEXT,meta_json TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS content_archives(content_item_id TEXT PRIMARY KEY,moments_caption TEXT,drive_status TEXT NOT NULL DEFAULT 'not_configured',drive_folder_id TEXT,drive_folder_url TEXT,drive_last_error TEXT,last_synced_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS platform_oauth_tokens(platform TEXT PRIMARY KEY,access_token TEXT NOT NULL,refresh_token TEXT,open_id TEXT,scope TEXT,expires_at INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS platform_oauth_states(state TEXT PRIMARY KEY,platform TEXT NOT NULL,content_item_id TEXT,expires_at INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS candidate_sets(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,brief_text TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_choice',blind_order_json TEXT NOT NULL,winner_variant_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,chosen_at TEXT,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS candidate_variants(id TEXT PRIMARY KEY,set_id TEXT NOT NULL,writer_key TEXT NOT NULL,body TEXT NOT NULL,model_name TEXT,skill_version_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(set_id,writer_key),FOREIGN KEY(set_id) REFERENCES candidate_sets(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS writer_preferences(id TEXT PRIMARY KEY,set_id TEXT NOT NULL UNIQUE,content_item_id TEXT NOT NULL,winner_variant_id TEXT,choice_label TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(set_id) REFERENCES candidate_sets(id) ON DELETE CASCADE,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
`);
try{db.exec(`ALTER TABLE skill_proposals ADD COLUMN review_note TEXT`)}catch{}
try{db.exec(`ALTER TABLE article_versions ADD COLUMN skill_version_id TEXT`)}catch{}
try{db.exec(`ALTER TABLE content_items ADD COLUMN publish_state TEXT NOT NULL DEFAULT 'dry_run'`)}catch{}
try{db.exec(`ALTER TABLE topics ADD COLUMN source_url TEXT`)}catch{}
try{db.exec(`ALTER TABLE article_versions ADD COLUMN writer_key TEXT`)}catch{}
try{db.exec(`ALTER TABLE article_versions ADD COLUMN candidate_set_id TEXT`)}catch{}
try{db.exec(`ALTER TABLE publish_packages ADD COLUMN render_status TEXT NOT NULL DEFAULT 'not_started'`)}catch{}
try{db.exec(`ALTER TABLE publish_packages ADD COLUMN social_caption TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN generation_id TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN visual_asset_path TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN cover_html_path TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN cover_png_path TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN model_name TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN prompt_text TEXT`)}catch{}
try{db.exec(`ALTER TABLE cover_specs ADD COLUMN error_text TEXT`)}catch{}
try{db.exec(`ALTER TABLE content_items ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'topic'`)}catch{}
db.exec(`
CREATE TABLE IF NOT EXISTS source_assets(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,kind TEXT NOT NULL,original_name TEXT NOT NULL,mime_type TEXT,size_bytes INTEGER,file_path TEXT,cover_path TEXT,status TEXT NOT NULL DEFAULT 'pending_upload',user_notes TEXT,meta_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS content_predictions(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,asset_id TEXT,rubric_version TEXT NOT NULL,prediction_json TEXT NOT NULL,locked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(content_item_id,asset_id),FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS performance_snapshots(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,asset_id TEXT,platform TEXT NOT NULL,window_label TEXT NOT NULL DEFAULT 'T+3',views INTEGER NOT NULL DEFAULT 0,likes INTEGER NOT NULL DEFAULT 0,comments INTEGER NOT NULL DEFAULT 0,shares INTEGER NOT NULL DEFAULT 0,saves INTEGER NOT NULL DEFAULT 0,followers_gained INTEGER NOT NULL DEFAULT 0,captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(content_item_id,asset_id,platform,window_label),FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS performance_rubric_versions(id TEXT PRIMARY KEY,version TEXT NOT NULL UNIQUE,weights_json TEXT NOT NULL,notes TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audience_signals(id TEXT PRIMARY KEY,content_item_id TEXT,platform TEXT,signal_type TEXT NOT NULL,signal_text TEXT NOT NULL,evidence_json TEXT,confidence REAL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS creator_calibrations(content_item_id TEXT PRIMARY KEY,mode TEXT NOT NULL DEFAULT 'undecided',status TEXT NOT NULL DEFAULT 'not_started',direct_text TEXT,brief_json TEXT,last_error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS creator_calibration_messages(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,role TEXT NOT NULL,body TEXT NOT NULL,stage TEXT,metadata_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS creator_calibration_observations(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,kind TEXT NOT NULL,value TEXT NOT NULL,source_message_id TEXT,confidence REAL NOT NULL DEFAULT 0.5,status TEXT NOT NULL DEFAULT 'candidate',correction_text TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE,FOREIGN KEY(source_message_id) REFERENCES creator_calibration_messages(id) ON DELETE SET NULL);
`);
try{db.prepare(`INSERT INTO performance_rubric_versions(id,version,weights_json,notes,status) VALUES (?,?,?,?,?)`).run(randomUUID(),'vox-performance-v1',JSON.stringify({topicStrength:.16,hook:.18,clarity:.14,commentPotential:.14,shareSavePotential:.18,voxFit:.20}),'Cold-start rubric; upgrade only after enough T+3 samples.','active')}catch{}

export function upsertResearch(items:ResearchItem[]){const s=db.prepare(`INSERT INTO research_items(id,source,title,url,author,summary,published_at,query,engagement_json,fetched_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET source=excluded.source,title=excluded.title,url=excluded.url,author=excluded.author,summary=excluded.summary,published_at=excluded.published_at,query=excluded.query,engagement_json=excluded.engagement_json,fetched_at=CURRENT_TIMESTAMP`); for(const i of items)s.run(i.id,i.source,i.title,i.url||null,i.author||null,i.summary||null,i.publishedAt||null,i.query||null,JSON.stringify(i.engagement||{}));}
export function clearProposedTopics(){db.prepare(`DELETE FROM topics WHERE status='proposed'`).run();}
export function upsertTopics(items:any[]){const s=db.prepare(`INSERT INTO topics(id,title,column_key,why_now,vox_angle,source_summary,source_url,freshness_score,vox_fit_score,audible_score,suggested_format,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT status FROM topics WHERE id=?),'proposed')) ON CONFLICT(id) DO UPDATE SET title=excluded.title,column_key=excluded.column_key,why_now=excluded.why_now,vox_angle=excluded.vox_angle,source_summary=excluded.source_summary,source_url=COALESCE(excluded.source_url,topics.source_url),freshness_score=excluded.freshness_score,vox_fit_score=excluded.vox_fit_score,audible_score=excluded.audible_score,suggested_format=excluded.suggested_format`); for(const t of items)s.run(t.id,t.title,t.column,t.whyNow,t.voxAngle,t.source,t.sourceUrl||null,t.freshness,t.voxFit,t.audible,t.format,t.id);}
function topicRowUrl(r:any){if(r.sourceUrl)return r.sourceUrl;const m=String(r.source||'').match(/https?:\/\/[^\s·]+/);return m?.[0]||null}
function mapTopicRow(r:any){const score=+(Number(r.freshness||0)*.22+Number(r.voxFit||0)*.38+Number(r.audible||0)*.40).toFixed(2);return{...r,sourceUrl:topicRowUrl(r),score}}
export function listTopics(limit=20){const rows=db.prepare(`SELECT id,title,column_key as column,why_now as whyNow,vox_angle as voxAngle,source_summary as source,source_url as sourceUrl,freshness_score as freshness,vox_fit_score as voxFit,audible_score as audible,suggested_format as format,status FROM topics WHERE status='proposed' AND vox_fit_score>=5.5 AND source_summary NOT LIKE '抖音热点词%' ORDER BY (freshness_score*.22+vox_fit_score*.38+audible_score*.40) DESC,created_at DESC LIMIT 160`).all() as any[];const bucket=(x:any)=>{const s=String(x.source||'');return s.startsWith('抖音 ·')?'douyin':s.startsWith('小红书 ·')?'xhs':s.startsWith('OmniSeek ·')?'omniseek':'industry'};const family=(x:any)=>{const t=String(x.title||'').toLowerCase();if(/(?:ai|人工智能).{0,8}(?:版权|著作权)|(?:版权|著作权).{0,8}(?:ai|人工智能)/i.test(t))return'aiCopyright';if(/演唱会|巡演|音乐节|演出|livehouse|concert|tour/i.test(t))return'live';if(/摇滚|乐队|朋克|爵士|专辑|band|rock|punk|jazz|album/i.test(t))return'bandHistory';if(/音乐行业|厂牌|唱片|流媒体|音乐平台|音乐人|版权|music industry|label|streaming|royalty/i.test(t))return'industry';if(/学音乐|教学|练琴|乐理|和弦|编曲|混音|录音|吉他|贝斯|鼓|键盘|钢琴|lesson|practice/i.test(t))return'learning';return'other'};const sourceCaps:any={douyin:6,xhs:6,omniseek:8,industry:8},familyCaps:any={aiCopyright:2,live:4,bandHistory:6,industry:5,learning:4,other:4};const usedSource:any={douyin:0,xhs:0,omniseek:0,industry:0},usedFamily:any={aiCopyright:0,live:0,bandHistory:0,industry:0,learning:0,other:0},out:any[]=[];const add=(r:any,checkSource=true,checkFamily=true)=>{const b=bucket(r),f=family(r);if(checkSource&&usedSource[b]>=sourceCaps[b])return;if(checkFamily&&usedFamily[f]>=familyCaps[f])return;if(out.some(x=>x.id===r.id))return;out.push(mapTopicRow(r));usedSource[b]++;usedFamily[f]++};for(const r of rows){add(r,true,true);if(out.length>=limit)break}if(out.length<limit)for(const r of rows){add(r,false,true);if(out.length>=limit)break}if(out.length<limit)for(const r of rows){add(r,false,false);if(out.length>=limit)break}return out.slice(0,limit).sort((a:any,b:any)=>Number(b.score||0)-Number(a.score||0));}
export function listSavedTopics(limit=50){return (db.prepare(`SELECT id,title,column_key as column,why_now as whyNow,vox_angle as voxAngle,source_summary as source,source_url as sourceUrl,freshness_score as freshness,vox_fit_score as voxFit,audible_score as audible,suggested_format as format,status,created_at as createdAt FROM topics WHERE status='saved' ORDER BY created_at DESC LIMIT ?`).all(limit) as any[]).map(mapTopicRow)}
export function setTopicSaved(topicId:string,saved:boolean){const exists=db.prepare(`SELECT id,status FROM topics WHERE id=?`).get(topicId) as any;if(!exists)throw new Error('topic not found');if(exists.status==='selected'&&!saved)throw new Error('selected topic cannot be unsaved');db.prepare(`UPDATE topics SET status=? WHERE id=?`).run(saved?'saved':'proposed',topicId);return saved?'saved':'proposed'}
export function selectTopic(topicId:string){
  const id=randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try{
    const topic=db.prepare(`SELECT id FROM topics WHERE id=?`).get(topicId) as any;
    if(!topic)throw new Error('选题不存在或已失效，请刷新选题后重试');
    db.prepare(`INSERT INTO content_items(id,topic_id) VALUES (?,?)`).run(id,topicId);
    db.prepare(`UPDATE topics SET status='selected' WHERE id=?`).run(topicId);
    db.exec('COMMIT');
    return id;
  }catch(e){
    try{db.exec('ROLLBACK')}catch{}
    throw e;
  }
}
export function createManualTopic(input:{title:string;notes?:string}){
  const title=String(input.title||'').trim().replace(/\s+/g,' ').slice(0,140);
  const notes=String(input.notes||'').trim().slice(0,3000);
  if([...title].length<2)throw new Error('请先写下一句你想讨论的话题。');
  const topicId=`manual-${randomUUID()}`,contentId=randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try{
    // A quick repeat of the same submit should resume the just-created task,
    // rather than quietly creating two indistinguishable writing tasks.
    const duplicate=db.prepare(`SELECT c.id FROM content_items c JOIN topics t ON t.id=c.topic_id
      WHERE c.source_kind='manual_topic' AND t.title=? AND COALESCE(c.user_raw_input,'')=?
        AND c.created_at>=datetime('now','-2 minutes') ORDER BY c.created_at DESC LIMIT 1`).get(title,notes) as any;
    if(duplicate){db.exec('COMMIT');return{topicId:null,contentId:String(duplicate.id),reused:true};}
    const source=notes?`用户补充说明：${notes}`:'用户主动发起的话题；可以先和 Sinote 聊聊，把模糊的想法澄清成可写的内容。';
    db.prepare(`INSERT INTO topics(id,title,column_key,why_now,vox_angle,source_summary,freshness_score,vox_fit_score,audible_score,suggested_format,status) VALUES (?,?,?,?,?,?,?,?,?,?,'selected')`).run(topicId,title,'manual','用户主动发起','从自己的问题、经历或一个模糊念头出发，由写前对话一起澄清。',source,5,8,8,'自定义内容');
    db.prepare(`INSERT INTO content_items(id,topic_id,user_raw_input,source_kind) VALUES (?,?,?,'manual_topic')`).run(contentId,topicId,notes||null);
    db.exec('COMMIT');
    return{topicId,contentId,reused:false};
  }catch(error){
    try{db.exec('ROLLBACK')}catch{}
    throw error;
  }
}
export function getContent(id?:string){
  // Deliberately never fall back to the newest item. A missing id is a route
  // state, not a request for whichever historical draft happened to update last.
  if(!id)return null;
  const row=db.prepare(`SELECT c.*,t.title topic_title,t.vox_angle,t.source_summary FROM content_items c JOIN topics t ON t.id=c.topic_id WHERE c.id=?`).get(id);
  if(!row)return null;
  const r:any=row;
  r.versions=db.prepare(`SELECT id,version_type,body,model_name,skill_version_id,writer_key,candidate_set_id,created_at FROM article_versions WHERE content_item_id=? ORDER BY created_at`).all(r.id);
  r.blindSet=getLatestCandidateSet(r.id);
  r.labels=db.prepare(`SELECT label,created_at FROM learning_labels WHERE content_item_id=?`).all(r.id);
  r.observations=db.prepare(`SELECT * FROM diff_observations WHERE content_item_id=? ORDER BY created_at DESC`).all(r.id);
  r.archive=getContentArchive(r.id);
  r.calibration=getCreatorCalibration(r.id);
  r.calibrationEligible=isCreatorCalibrationEligible(r.id);
  return r;
}
const contentPlatformLabels:Record<string,string>={wechat:'公众号',wechat_long_image:'公众号',xiaohongshu:'小红书',douyin:'抖音'};
function contentStep(contentState:string,publishState:string,hasFinal:boolean){
  if(publishState==='ready_to_publish')return 'publish';
  if(['master_approved','platform_adapting'].includes(publishState))return 'visual';
  if(hasFinal||publishState==='wechat_copy_approved')return 'visual';
  if(contentState==='blind_review')return 'choose';
  if(contentState==='editing')return 'final';
  if(contentState==='generating_candidates')return 'draft';
  return 'viewpoint';
}
function contentDoneSteps(current:string){const order=['viewpoint','draft','choose','final','visual','publish'];const i=order.indexOf(current);return i>0?order.slice(0,i):[];}
function contentStatusLabel(row:any,results:any[],hasFinal:boolean){
  if(results.some(x=>x.status==='succeeded'))return '已发布';
  if(results.some(x=>x.status==='failed'))return '发布失败';
  if(row.publish_state==='ready_to_publish')return '待发布';
  if(['wechat_copy_approved','master_approved','platform_adapting'].includes(row.publish_state))return '制作中';
  if(row.content_state==='blind_review')return '待确认';
  if(['generating_candidates','editing'].includes(row.content_state))return row.content_state==='editing'?'待确认':'制作中';
  if(hasFinal||row.content_state==='final_approved')return '待发布';
  return '草稿中';
}
function contentNextAction(row:any,statusLabel:string,current:string){
  const id=encodeURIComponent(row.id);
  if(statusLabel==='已发布')return{label:'查看详情',href:`/content/${id}`};
  if(statusLabel==='发布失败')return{label:'查看发布问题',href:`/release/publish?id=${id}`};
  if(current==='viewpoint'||current==='draft'||current==='choose'||current==='final')return{label:current==='viewpoint'?'开始写作':'继续制作',href:`/editor?id=${id}`};
  if(current==='visual')return{label:'继续做视觉',href:`/publish?id=${id}`};
  return{label:'进入发布',href:`/release/publish?id=${id}`};
}
export function listContentLibrary(limit=300){
  const rows=db.prepare(`SELECT c.id,c.content_state,c.publish_state,c.source_kind,c.final_text,c.created_at,c.updated_at,t.title topic_title FROM content_items c LEFT JOIN topics t ON t.id=c.topic_id ORDER BY c.updated_at DESC LIMIT ?`).all(limit) as any[];
  const archiveRows=db.prepare(`SELECT content_item_id,platform,status,remote_id,created_at,updated_at FROM publish_archives ORDER BY created_at DESC`).all() as any[];
  const jobRows=db.prepare(`SELECT content_item_id,platform,action,status,remote_id,error_text,created_at,updated_at FROM platform_publish_jobs ORDER BY created_at DESC`).all() as any[];
  const packages=db.prepare(`SELECT content_item_id,platform,status,updated_at FROM publish_packages`).all() as any[];
  const byContent:any={};
  for(const r of [...archiveRows,...jobRows]){if(!byContent[r.content_item_id])byContent[r.content_item_id]={};const old=byContent[r.content_item_id][r.platform];if(!old||String(r.created_at)>String(old.created_at))byContent[r.content_item_id][r.platform]=r;}
  const out=rows.map((row:any)=>{
    const versions=db.prepare(`SELECT 1 FROM article_versions WHERE content_item_id=? AND version_type='final' LIMIT 1`).get(row.id);
    const results=Object.values(byContent[row.id]||{}) as any[];
    const current=contentStep(row.content_state,row.publish_state,Boolean(versions));
    const statusLabel=contentStatusLabel(row,results,Boolean(versions));
    const platformResults=results.sort((a:any,b:any)=>String(a.platform).localeCompare(String(b.platform))).map((r:any)=>({platform:r.platform,platformLabel:contentPlatformLabels[r.platform]||r.platform,status:r.status,statusLabel:r.status==='succeeded'?'已发布':r.status==='failed'?'发布失败':r.status==='running'?'发布中':'待处理',remoteId:r.remote_id||null,error:r.error_text||null}));
    const packageRows=packages.filter((p:any)=>p.content_item_id===row.id);
    const outcome=platformResults.length?platformResults.map((r:any)=>`${r.platformLabel}${r.status==='succeeded'?'已发布':r.status==='failed'?'发布失败':'处理中'}`).join(' · '):'尚未发布';
    return{...row,title:row.topic_title||'未命名内容',updatedAt:row.updated_at,createdAt:row.created_at,statusLabel,currentStep:current,doneSteps:contentDoneSteps(current),nextAction:contentNextAction(row,statusLabel,current),publishOutcome:outcome,platformResults,historyCount:archiveRows.filter((x:any)=>x.content_item_id===row.id).length,packageCount:packageRows.length,sourceLabel:row.source_kind==='imported_video'?'外部成品':row.source_kind==='manual_topic'?'我的选题':'选题',hasFinal:Boolean(versions)};
  }).sort((a:any,b:any)=>{const rank=(x:any)=>x.statusLabel==='已发布'?0:x.statusLabel==='发布失败'?1:2;return rank(a)-rank(b)||String(b.updatedAt).localeCompare(String(a.updatedAt))});
  return out;
}
export function getContentLibraryItem(id:string){return listContentLibrary(500).find((x:any)=>x.id===id)||null;}
export function listUnfinishedContent(limit=24){
  const rows=db.prepare(`SELECT c.id,c.content_state,c.publish_state,c.updated_at,t.title topic_title
    FROM content_items c JOIN topics t ON t.id=c.topic_id
    WHERE c.content_state IN ('awaiting_viewpoint','generating_candidates','blind_review','editing','blind_rejected')
      AND COALESCE(TRIM(c.final_text),'')=''
    ORDER BY c.updated_at DESC LIMIT ?`).all(limit) as any[];
  return rows.map((r:any)=>({id:r.id,title:r.topic_title||'未命名内容',contentState:r.content_state,updatedAt:r.updated_at,
    stateLabel:r.content_state==='awaiting_viewpoint'?'等待开始':r.content_state==='generating_candidates'?'正在生成':r.content_state==='blind_review'?'等待选稿':r.content_state==='editing'?'等待定稿':'待重新开始'}));
}
function safeCreatorJson(value:string|undefined|null,fallback:any){try{return value?JSON.parse(value):fallback}catch{return fallback}}
function creatorText(value:any,max=2400){return String(value??'').trim().slice(0,max)}
function creatorList(value:any,max=10){const values=Array.isArray(value)?value:String(value??'').split(/\n+/);return [...new Set(values.map(x=>creatorText(x,900)).filter(Boolean))].slice(0,max)}
export function normalizeCreatorBrief(value:any):CreatorBrief{
  const raw=value&&typeof value==='object'?value:{};
  return {starting_idea:creatorText(raw.starting_idea),problem:creatorText(raw.problem),user_judgment:creatorText(raw.user_judgment),experiences:creatorList(raw.experiences),examples:creatorList(raw.examples),counterarguments:creatorList(raw.counterarguments),boundaries:creatorList(raw.boundaries),angle:creatorText(raw.angle),desired_reader_reaction:creatorText(raw.desired_reader_reaction),useful_original_quotes:creatorList(raw.useful_original_quotes),evidence_needed:creatorList(raw.evidence_needed),conversation_summary:creatorText(raw.conversation_summary,3600)};
}
export function getCreatorCalibration(contentId:string){
  const row=db.prepare(`SELECT * FROM creator_calibrations WHERE content_item_id=?`).get(contentId) as any;
  if(!row)return null;
  const messages=(db.prepare(`SELECT id,role,body,stage,metadata_json,created_at FROM creator_calibration_messages WHERE content_item_id=? ORDER BY created_at,id`).all(contentId) as any[]).map((m:any)=>({...m,metadata:safeCreatorJson(m.metadata_json,{})}));
  const observations=(db.prepare(`SELECT id,kind,value,source_message_id,confidence,status,correction_text,created_at,updated_at FROM creator_calibration_observations WHERE content_item_id=? ORDER BY created_at,id`).all(contentId) as any[]);
  return {...row,brief:normalizeCreatorBrief(safeCreatorJson(row.brief_json,emptyCreatorBrief())),messages,observations};
}
export function isCreatorCalibrationEligible(contentId:string){
  const item=db.prepare(`SELECT content_state,final_text FROM content_items WHERE id=?`).get(contentId) as any;
  if(!item||item.content_state!=='awaiting_viewpoint'||String(item.final_text||'').trim())return false;
  const hasSet=db.prepare(`SELECT id FROM candidate_sets WHERE content_item_id=? LIMIT 1`).get(contentId) as any;
  const hasFinal=db.prepare(`SELECT id FROM article_versions WHERE content_item_id=? AND version_type='final' LIMIT 1`).get(contentId) as any;
  return !hasSet&&!hasFinal;
}
export function ensureCreatorCalibration(contentId:string,mode:CreatorCalibrationMode='undecided'){
  const item=db.prepare(`SELECT id FROM content_items WHERE id=?`).get(contentId) as any;
  if(!item)throw new Error('content not found');
  db.prepare(`INSERT OR IGNORE INTO creator_calibrations(content_item_id,mode,status,brief_json) VALUES (?,?,'not_started',?)`).run(contentId,mode,JSON.stringify(emptyCreatorBrief()));
  if(mode!=='undecided')db.prepare(`UPDATE creator_calibrations SET mode=?,updated_at=CURRENT_TIMESTAMP WHERE content_item_id=?`).run(mode,contentId);
  return getCreatorCalibration(contentId);
}
export function setCreatorCalibrationState(contentId:string,input:{mode?:CreatorCalibrationMode;status?:string;lastError?:string|null}){
  ensureCreatorCalibration(contentId);
  const old=getCreatorCalibration(contentId);
  db.prepare(`UPDATE creator_calibrations SET mode=?,status=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE content_item_id=?`).run(input.mode||old?.mode||'undecided',input.status||old?.status||'not_started',input.lastError===undefined?old?.last_error||null:input.lastError,contentId);
  return getCreatorCalibration(contentId);
}
export function appendCreatorCalibrationMessage(contentId:string,input:{role:'user'|'assistant';body:string;stage?:string;metadata?:any}){
  ensureCreatorCalibration(contentId);
  const body=creatorText(input.body,7000);if(!body)throw new Error('message is required');
  const id=randomUUID();
  db.prepare(`INSERT INTO creator_calibration_messages(id,content_item_id,role,body,stage,metadata_json) VALUES (?,?,?,?,?,?)`).run(id,contentId,input.role,body,input.stage||null,input.metadata?JSON.stringify(input.metadata):null);
  db.prepare(`UPDATE creator_calibrations SET updated_at=CURRENT_TIMESTAMP WHERE content_item_id=?`).run(contentId);
  return id;
}
export function saveCreatorCalibrationObservations(contentId:string,observations:any[],sourceMessageId?:string){
  for(const raw of observations||[]){
    const kind=creatorText(raw?.kind,80),value=creatorText(raw?.value,1200);if(!kind||!value)continue;
    const confidence=Math.max(0,Math.min(1,Number(raw?.confidence)||.5));
    db.prepare(`INSERT INTO creator_calibration_observations(id,content_item_id,kind,value,source_message_id,confidence,status) VALUES (?,?,?,?,?,?,'candidate')`).run(randomUUID(),contentId,kind,value,sourceMessageId||null,confidence);
  }
  return getCreatorCalibration(contentId);
}
export function saveCreatorBrief(contentId:string,brief:any,status='brief_ready'){
  ensureCreatorCalibration(contentId,'chat');const normalized=normalizeCreatorBrief(brief);
  db.prepare(`UPDATE creator_calibrations SET brief_json=?,status=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE content_item_id=?`).run(JSON.stringify(normalized),status,contentId);
  return getCreatorCalibration(contentId);
}
export function saveCreatorDirectDraft(contentId:string,directText:string){
  const text=creatorText(directText,10000);ensureCreatorCalibration(contentId,'direct');
  db.prepare(`UPDATE creator_calibrations SET mode='direct',status='direct_ready',direct_text=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE content_item_id=?`).run(text,contentId);
  db.prepare(`UPDATE content_items SET user_raw_input=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(text,contentId);
  return getCreatorCalibration(contentId);
}
export function creatorWriterContext(calibration:any){
  const brief=normalizeCreatorBrief(calibration?.brief),userWords=creatorList([...(brief.useful_original_quotes||[]),...((calibration?.messages||[]).filter((m:any)=>m.role==='user').map((m:any)=>m.body))],12);
  const block=(title:string,value:string|string[])=>{const values=Array.isArray(value)?value:[value];const clean=values.map(x=>creatorText(x,1400)).filter(Boolean);return clean.length?`【${title}】\n${clean.map(x=>`- ${x}`).join('\n')}`:''};
  return ['【Sinote 写前对话｜用户已确认的写作理解】',block('起始想法',brief.starting_idea),block('要解决的问题',brief.problem),block('用户判断',brief.user_judgment),block('真实经历',brief.experiences),block('具体例子',brief.examples),block('反例 / 边界', [...brief.counterarguments,...brief.boundaries]),block('内容入口',brief.angle),block('希望读者带走什么',brief.desired_reader_reaction),block('仍需核实',brief.evidence_needed),block('对话总结',brief.conversation_summary),block('用户原话（自然表达优先保留）',userWords)].filter(Boolean).join('\n\n');
}
export function confirmCreatorBrief(contentId:string,brief:any){
  const calibration=saveCreatorBrief(contentId,brief,'confirmed');
  const writerContext=creatorWriterContext(calibration);
  db.prepare(`UPDATE content_items SET user_raw_input=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(writerContext,contentId);
  return {calibration:getCreatorCalibration(contentId),writerContext};
}
export function getConfirmedCreatorWriterContext(contentId:string){
  const calibration=getCreatorCalibration(contentId);
  return calibration?.status==='confirmed'?creatorWriterContext(calibration):null;
}
/**
 * Generation must not rely on a browser keeping the calibration payload alive.
 * A confirmed Brief is rebuilt from persisted messages + Brief on every request,
 * so a refresh or an old tab cannot replace it with a stale textarea value.
 */
export function resolveGenerationContext(contentId:string,suppliedViewpoint?:unknown){
  const confirmed=getConfirmedCreatorWriterContext(contentId);
  if(confirmed)return {writerContext:confirmed,source:'confirmed_calibration' as const};
  const viewpoint=creatorText(suppliedViewpoint,10000);
  return viewpoint?{writerContext:viewpoint,source:'viewpoint' as const}:null;
}
export function saveGenerated(contentId:string,viewpoint:string,body:string,model:string,skillVersionId?:string){db.prepare(`UPDATE content_items SET user_raw_input=?,content_state='editing',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(viewpoint,contentId);const id=randomUUID();db.prepare(`INSERT INTO article_versions(id,content_item_id,version_type,body,model_name,skill_version_id) VALUES (?,?,?,?,?,?)`).run(id,contentId,'candidate',body,model,skillVersionId||null);return id;}
export function getActiveSkill(){return db.prepare(`SELECT id,version,body,changelog,status,source_proposal_id,created_at FROM skill_versions WHERE status='active' ORDER BY created_at DESC LIMIT 1`).get() as any||null;}
export function beginCandidateSet(contentId:string,briefText:string){
  const open=db.prepare(`SELECT id,brief_text FROM candidate_sets WHERE content_item_id=? AND status='generating' ORDER BY created_at DESC LIMIT 1`).get(contentId) as any;
  if(open&&open.brief_text===briefText)return open.id as string;
  if(open)db.prepare(`UPDATE candidate_sets SET status='abandoned' WHERE id=?`).run(open.id);
  const id=randomUUID();db.prepare(`INSERT INTO candidate_sets(id,content_item_id,brief_text,status,blind_order_json) VALUES (?,?,?,'generating','[]')`).run(id,contentId,briefText);db.prepare(`UPDATE content_items SET user_raw_input=?,content_state='generating_candidates',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(briefText,contentId);return id;
}
export function candidateWriterKeys(setId:string){return (db.prepare(`SELECT writer_key FROM candidate_variants WHERE set_id=?`).all(setId) as any[]).map(x=>String(x.writer_key));}
export function saveCandidateVariant(setId:string,v:{writerKey:string;body:string;model:string;skillVersionId?:string}){const old=db.prepare(`SELECT id FROM candidate_variants WHERE set_id=? AND writer_key=?`).get(setId,v.writerKey) as any;const id=old?.id||randomUUID();db.prepare(`INSERT INTO candidate_variants(id,set_id,writer_key,body,model_name,skill_version_id) VALUES (?,?,?,?,?,?) ON CONFLICT(set_id,writer_key) DO UPDATE SET body=excluded.body,model_name=excluded.model_name,skill_version_id=excluded.skill_version_id`).run(id,setId,v.writerKey,v.body,v.model,v.skillVersionId||null);return id;}
export function finalizeCandidateSet(setId:string){const set=db.prepare(`SELECT content_item_id,status FROM candidate_sets WHERE id=?`).get(setId) as any;if(!set)throw new Error('candidate set not found');const ids=(db.prepare(`SELECT id FROM candidate_variants WHERE set_id=?`).all(setId) as any[]).map(x=>String(x.id));if(ids.length!==3)return null;for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}db.prepare(`UPDATE candidate_sets SET status='awaiting_choice',blind_order_json=? WHERE id=?`).run(JSON.stringify(ids),setId);db.prepare(`UPDATE content_items SET content_state='blind_review',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(set.content_item_id);return getCandidateSet(setId,false);}

export function createCandidateSet(contentId:string,briefText:string,variants:{writerKey:string;body:string;model:string;skillVersionId?:string}[]){
  if(variants.length!==3)throw new Error('exactly 3 candidates required');
  const setId=randomUUID(),ids=variants.map(()=>randomUUID());
  const order=[...ids];for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  db.prepare(`INSERT INTO candidate_sets(id,content_item_id,brief_text,blind_order_json) VALUES (?,?,?,?)`).run(setId,contentId,briefText,JSON.stringify(order));
  const ins=db.prepare(`INSERT INTO candidate_variants(id,set_id,writer_key,body,model_name,skill_version_id) VALUES (?,?,?,?,?,?)`);
  variants.forEach((v,i)=>ins.run(ids[i],setId,v.writerKey,v.body,v.model,v.skillVersionId||null));
  db.prepare(`UPDATE content_items SET user_raw_input=?,content_state='blind_review',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(briefText,contentId);
  return getCandidateSet(setId,false);
}
const LABELS=['A','B','C'];
export function getCandidateSet(setId:string,reveal=false){const set=db.prepare(`SELECT * FROM candidate_sets WHERE id=?`).get(setId) as any;if(!set)return null;const rows=db.prepare(`SELECT id,writer_key,body,model_name,skill_version_id FROM candidate_variants WHERE set_id=?`).all(setId) as any[];const byId=new Map(rows.map(r=>[r.id,r]));const order=JSON.parse(set.blind_order_json) as string[];const candidates=order.map((id,i)=>{const r=byId.get(id);return reveal||set.status!=='awaiting_choice'?{label:LABELS[i],id:r.id,body:r.body,writerKey:r.writer_key,model:r.model_name,skillVersionId:r.skill_version_id}:{label:LABELS[i],body:r.body}});return{...set,candidates};}
export function getLatestCandidateSet(contentId:string){const x=db.prepare(`SELECT id FROM candidate_sets WHERE content_item_id=? ORDER BY created_at DESC LIMIT 1`).get(contentId) as any;return x?getCandidateSet(x.id,false):null;}
export function chooseCandidate(contentId:string,setId:string,choiceLabel:string){const set=db.prepare(`SELECT * FROM candidate_sets WHERE id=? AND content_item_id=?`).get(setId,contentId) as any;if(!set)throw new Error('candidate set not found');if(set.status!=='awaiting_choice')throw new Error('candidate set already decided');const order=JSON.parse(set.blind_order_json) as string[];if(choiceLabel==='NONE'){db.prepare(`UPDATE candidate_sets SET status='rejected_all',chosen_at=CURRENT_TIMESTAMP WHERE id=?`).run(setId);db.prepare(`INSERT INTO writer_preferences(id,set_id,content_item_id,winner_variant_id,choice_label) VALUES (?,?,?,?,?)`).run(randomUUID(),setId,contentId,null,'NONE');db.prepare(`UPDATE content_items SET content_state='blind_rejected',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(contentId);return getCandidateSet(setId,true)}const idx=LABELS.indexOf(choiceLabel);if(idx<0)throw new Error('invalid blind label');const variantId=order[idx];const v=db.prepare(`SELECT * FROM candidate_variants WHERE id=? AND set_id=?`).get(variantId,setId) as any;if(!v)throw new Error('variant not found');db.prepare(`UPDATE candidate_sets SET status='winner_selected',winner_variant_id=?,chosen_at=CURRENT_TIMESTAMP WHERE id=?`).run(variantId,setId);db.prepare(`INSERT INTO writer_preferences(id,set_id,content_item_id,winner_variant_id,choice_label) VALUES (?,?,?,?,?)`).run(randomUUID(),setId,contentId,variantId,choiceLabel);db.prepare(`INSERT INTO article_versions(id,content_item_id,version_type,body,model_name,skill_version_id,writer_key,candidate_set_id) VALUES (?,?,?,?,?,?,?,?)`).run(randomUUID(),contentId,'candidate',v.body,v.model_name,v.skill_version_id,v.writer_key,setId);db.prepare(`UPDATE content_items SET content_state='editing',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(contentId);return getCandidateSet(setId,true)}
export function writerPreferenceSummary(){const wins=db.prepare(`SELECT v.writer_key writer,COUNT(*) wins FROM writer_preferences p JOIN candidate_variants v ON v.id=p.winner_variant_id WHERE p.winner_variant_id IS NOT NULL GROUP BY v.writer_key ORDER BY wins DESC`).all();const total=(db.prepare(`SELECT COUNT(*) n FROM writer_preferences`).get() as any).n as number;const none=(db.prepare(`SELECT COUNT(*) n FROM writer_preferences WHERE winner_variant_id IS NULL`).get() as any).n as number;return{total,none,wins};}

export function getContentArchive(contentId:string){return db.prepare(`SELECT content_item_id,moments_caption,drive_status,drive_folder_id,drive_folder_url,drive_last_error,last_synced_at,created_at,updated_at FROM content_archives WHERE content_item_id=?`).get(contentId) as any||null;}
export function setMomentsCaption(contentId:string,caption:string){const v=String(caption||'').trim();db.prepare(`INSERT INTO content_archives(content_item_id,moments_caption,drive_status) VALUES (?,?,'not_configured') ON CONFLICT(content_item_id) DO UPDATE SET moments_caption=excluded.moments_caption,updated_at=CURRENT_TIMESTAMP`).run(contentId,v);return getContentArchive(contentId);}
export function setDriveArchiveState(contentId:string,input:{status:string;folderId?:string|null;folderUrl?:string|null;error?:string|null}){db.prepare(`INSERT INTO content_archives(content_item_id,drive_status,drive_folder_id,drive_folder_url,drive_last_error,last_synced_at) VALUES (?,?,?,?,?,CASE WHEN ?='synced' THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(content_item_id) DO UPDATE SET drive_status=excluded.drive_status,drive_folder_id=COALESCE(excluded.drive_folder_id,content_archives.drive_folder_id),drive_folder_url=COALESCE(excluded.drive_folder_url,content_archives.drive_folder_url),drive_last_error=excluded.drive_last_error,last_synced_at=CASE WHEN excluded.drive_status='synced' THEN CURRENT_TIMESTAMP ELSE content_archives.last_synced_at END,updated_at=CURRENT_TIMESTAMP`).run(contentId,input.status,input.folderId||null,input.folderUrl||null,input.error||null,input.status);return getContentArchive(contentId);}

export function saveFinal(contentId:string,body:string){const current=db.prepare(`SELECT final_text FROM content_items WHERE id=?`).get(contentId) as any;if(current?.final_text===body){const latest=db.prepare(`SELECT id FROM article_versions WHERE content_item_id=? AND version_type='final' ORDER BY created_at DESC LIMIT 1`).get(contentId) as any;db.prepare(`UPDATE content_items SET content_state='final_approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(contentId);return latest?.id||null;}const id=randomUUID();db.prepare(`INSERT INTO article_versions(id,content_item_id,version_type,body) VALUES (?,?,?,?)`).run(id,contentId,'final',body);db.prepare(`DELETE FROM publish_packages WHERE content_item_id=?`).run(contentId);db.prepare(`UPDATE content_items SET final_text=?,content_state='final_approved',publish_state='dry_run',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(body,contentId);return id;}
export function setLabel(contentId:string,label:string){db.prepare(`DELETE FROM learning_labels WHERE content_item_id=?`).run(contentId);db.prepare(`INSERT INTO learning_labels(id,content_item_id,label) VALUES (?,?,?)`).run(randomUUID(),contentId,label);}
export function saveObservations(contentId:string,obs:any[]){db.prepare(`DELETE FROM diff_observations WHERE content_item_id=?`).run(contentId);const s=db.prepare(`INSERT INTO diff_observations(id,content_item_id,category,before_text,after_text,explanation,confidence) VALUES (?,?,?,?,?,?,?)`);for(const o of obs)s.run(randomUUID(),contentId,o.category,o.before,o.after,o.explanation,o.confidence);}
export function learningSummary(){
  const eligible=(db.prepare(`SELECT COUNT(DISTINCT l.content_item_id) n FROM learning_labels l WHERE l.label='worth_learning' AND EXISTS (SELECT 1 FROM article_versions v WHERE v.content_item_id=l.content_item_id AND v.version_type='candidate' AND v.candidate_set_id IS NOT NULL)`).get() as any).n as number;
  const proposals=db.prepare(`SELECT id,batch_key,proposal_json,status,review_note,created_at,reviewed_at FROM skill_proposals ORDER BY created_at DESC`).all().map((x:any)=>({...x,proposal:JSON.parse(x.proposal_json)}));
  const recent=db.prepare(`SELECT d.*,t.title FROM diff_observations d JOIN content_items c ON c.id=d.content_item_id JOIN topics t ON t.id=c.topic_id WHERE EXISTS (SELECT 1 FROM article_versions v WHERE v.content_item_id=c.id AND v.version_type='candidate' AND v.candidate_set_id IS NOT NULL) ORDER BY d.created_at DESC LIMIT 30`).all();
  const skills=db.prepare(`SELECT id,version,body,changelog,status,source_proposal_id,created_at FROM skill_versions ORDER BY created_at DESC`).all();
  return{eligible,nextBatchAt:Math.ceil((eligible+1)/5)*5,proposals,recent,skills,writerPreferences:writerPreferenceSummary()};
}
export function proposalEvidence(proposalId:string){
  const p=db.prepare(`SELECT * FROM skill_proposals WHERE id=?`).get(proposalId) as any;
  if(!p)return null;
  const proposal=JSON.parse(p.proposal_json);
  const limit=Math.max(5,Math.min(Number(proposal?.evidenceCount||5),20));
  const rows=db.prepare(`SELECT d.category,d.before_text,d.after_text,d.explanation,d.confidence,t.title,c.id content_id FROM diff_observations d JOIN content_items c ON c.id=d.content_item_id JOIN topics t ON t.id=c.topic_id JOIN learning_labels l ON l.content_item_id=c.id AND l.label='worth_learning' ORDER BY d.created_at DESC LIMIT ?`).all(limit*4);
  return{...p,proposal,evidence:rows};
}
export function maybeCreateProposal(){
  const s=learningSummary();if(s.eligible<5||s.eligible%5!==0)return null;
  const batchKey=`blind-worth-${s.eligible}`;const e=db.prepare(`SELECT id FROM skill_proposals WHERE batch_key=?`).get(batchKey) as any;if(e)return e.id;
  const rows=db.prepare(`SELECT d.category,d.explanation,COUNT(*) n FROM diff_observations d JOIN learning_labels l ON l.content_item_id=d.content_item_id AND l.label='worth_learning' WHERE EXISTS (SELECT 1 FROM article_versions v WHERE v.content_item_id=d.content_item_id AND v.version_type='candidate' AND v.candidate_set_id IS NOT NULL) GROUP BY d.category,d.explanation ORDER BY n DESC LIMIT 10`).all() as any[];
  const wins=writerPreferenceSummary();const rules:string[]=[];
  if(rows.some(x=>x.category==='rewrite'))rules.push('只学习盲选 Winner → Final 中跨样本反复出现的重写方向。');
  if(rows.some(x=>x.category==='add'))rules.push('关注人工 Final 反复补充的信息类型，例如具体场景、可执行验证、听觉判断或必要解释。');
  if(rows.some(x=>x.category==='delete'))rules.push('关注人工 Final 反复删除的模板化、冗余或过度拔高表达。');
  rules.push('Writer 胜率属于 routing preference，不直接写进风格 Skill；one_off 与 fact_correction 也不进入风格学习。');
  const id=randomUUID();db.prepare(`INSERT INTO skill_proposals(id,batch_key,proposal_json) VALUES (?,?,?)`).run(id,batchKey,JSON.stringify({rule:'Blind Winner → Final 跨样本风格提案',evidenceCount:s.eligible,patterns:rows,writerPreferences:wins,recommendations:rules}));return id;
}
export function reviewProposal(id:string,action:'approve'|'reject',note=''){
  const p=db.prepare(`SELECT id,status FROM skill_proposals WHERE id=?`).get(id) as any;if(!p)throw new Error('proposal not found');
  if(p.status==='promoted')throw new Error('promoted proposal cannot be reviewed again');
  const status=action==='approve'?'approved':'rejected';
  db.prepare(`UPDATE skill_proposals SET status=?,review_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,note||null,id);
  return status;
}
function nextSkillVersion(){const n=(db.prepare(`SELECT COUNT(*) n FROM skill_versions`).get() as any).n as number;return `vox-style-v${n+1}`;}
export function promoteProposal(id:string,body:string){
  const p=db.prepare(`SELECT * FROM skill_proposals WHERE id=?`).get(id) as any;if(!p)throw new Error('proposal not found');
  if(p.status!=='approved')throw new Error('proposal must be approved before promotion');
  const existing=db.prepare(`SELECT * FROM skill_versions WHERE source_proposal_id=?`).get(id) as any;if(existing)return existing;
  if(!body.trim())throw new Error('skill body required');
  db.prepare(`UPDATE skill_versions SET status='archived' WHERE status='active'`).run();
  const skill={id:randomUUID(),version:nextSkillVersion(),body:body.trim()};
  db.prepare(`INSERT INTO skill_versions(id,version,body,changelog,status,source_proposal_id) VALUES (?,?,?,?,?,?)`).run(skill.id,skill.version,skill.body,`Promoted from ${p.batch_key}`,'active',id);
  db.prepare(`UPDATE skill_proposals SET status='promoted',reviewed_at=COALESCE(reviewed_at,CURRENT_TIMESTAMP) WHERE id=?`).run(id);
  return db.prepare(`SELECT * FROM skill_versions WHERE id=?`).get(skill.id);
}

export function listPublishItems(contentId?:string){const rows=(contentId?db.prepare(`SELECT c.id content_id,c.final_text,c.publish_state,c.updated_at,t.title topic_title FROM content_items c JOIN topics t ON t.id=c.topic_id WHERE c.id=? AND c.final_text IS NOT NULL AND c.final_text<>''`).all(contentId):db.prepare(`SELECT c.id content_id,c.final_text,c.publish_state,c.updated_at,t.title topic_title FROM content_items c JOIN topics t ON t.id=c.topic_id WHERE c.final_text IS NOT NULL AND c.final_text<>'' ORDER BY c.updated_at DESC LIMIT 1`).all()) as any[];for(const r of rows){r.archive=getContentArchive(r.content_id);r.packages=db.prepare(`SELECT id,platform,title,body,visual_prompt,status,render_status,model_name,created_at,updated_at FROM publish_packages WHERE content_item_id=? ORDER BY CASE platform WHEN 'xiaohongshu' THEN 1 WHEN 'wechat_long_image' THEN 2 WHEN 'douyin' THEN 3 ELSE 9 END`).all(r.content_id);for(const p of r.packages)p.assets=db.prepare(`SELECT id,kind,width,height,model_name,created_at FROM rendered_assets WHERE package_id=? ORDER BY created_at,id`).all(p.id)}return rows;}
export function upsertPublishPackage(contentId:string,platform:string,pkg:{title:string;body:string;visualPrompt:string;model:string}){const existing=db.prepare(`SELECT id FROM publish_packages WHERE content_item_id=? AND platform=?`).get(contentId,platform) as any;const id=existing?.id||randomUUID();db.prepare(`INSERT INTO publish_packages(id,content_item_id,platform,title,body,visual_prompt,status,model_name) VALUES (?,?,?,?,?,?,'package_ready',?) ON CONFLICT(content_item_id,platform) DO UPDATE SET title=excluded.title,body=excluded.body,visual_prompt=excluded.visual_prompt,status='package_ready',render_status='not_started',model_name=excluded.model_name,updated_at=CURRENT_TIMESTAMP`).run(id,contentId,platform,pkg.title,pkg.body,pkg.visualPrompt,pkg.model);db.prepare(`DELETE FROM html_visual_variants WHERE package_id=?`).run(id);db.prepare(`DELETE FROM html_visual_generation_jobs WHERE package_id=?`).run(id);db.prepare(`DELETE FROM cover_revisions WHERE package_id=?`).run(id);db.prepare(`UPDATE cover_specs SET status='not_started',generation_id=NULL,visual_asset_path=NULL,cover_html_path=NULL,cover_png_path=NULL,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(id);db.prepare(`UPDATE content_items SET publish_state='package_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(contentId);return id;}
export function updatePublishPackage(id:string,input:{title:string;body:string;visualPrompt:string}){const p=db.prepare(`SELECT content_item_id FROM publish_packages WHERE id=?`).get(id) as any;if(!p)throw new Error('package not found');db.prepare(`UPDATE publish_packages SET title=?,body=?,visual_prompt=?,status='package_ready',render_status='not_started',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(input.title,input.body,input.visualPrompt,id);db.prepare(`DELETE FROM html_visual_variants WHERE package_id=?`).run(id);db.prepare(`DELETE FROM html_visual_generation_jobs WHERE package_id=?`).run(id);db.prepare(`DELETE FROM cover_revisions WHERE package_id=?`).run(id);db.prepare(`UPDATE cover_specs SET status='not_started',generation_id=NULL,visual_asset_path=NULL,cover_html_path=NULL,cover_png_path=NULL,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(id);db.prepare(`UPDATE content_items SET publish_state='package_ready' WHERE id=?`).run(p.content_item_id);}
export function approvePublishPackage(id:string){const p=db.prepare(`SELECT content_item_id,platform FROM publish_packages WHERE id=?`).get(id) as any;if(!p)throw new Error('package not found');db.prepare(`UPDATE publish_packages SET status='publish_approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);const state=p.platform==='wechat_long_image'?'wechat_copy_approved':'package_ready';db.prepare(`UPDATE content_items SET publish_state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(state,p.content_item_id);return state;}
export function dashboardStats(){const one=(sql:string)=>(db.prepare(sql).get() as any).n as number;return{proposed:one("SELECT COUNT(*) n FROM topics WHERE status='proposed'"),awaiting:one("SELECT COUNT(*) n FROM content_items WHERE content_state='awaiting_viewpoint'"),generatingCandidates:one("SELECT COUNT(*) n FROM content_items WHERE content_state='generating_candidates'"),blindReview:one("SELECT COUNT(*) n FROM content_items WHERE content_state='blind_review'"),editing:one("SELECT COUNT(*) n FROM content_items WHERE content_state='editing'"),finalApproved:one("SELECT COUNT(*) n FROM content_items WHERE content_state='final_approved'"),wechatCopyApproved:one("SELECT COUNT(*) n FROM content_items WHERE publish_state='wechat_copy_approved'"),masterApproved:one("SELECT COUNT(*) n FROM content_items WHERE publish_state='master_approved'"),platformAdapting:one("SELECT COUNT(*) n FROM content_items WHERE publish_state='platform_adapting'"),readyToPublish:one("SELECT COUNT(*) n FROM content_items WHERE publish_state='ready_to_publish'"),pendingProposals:one("SELECT COUNT(*) n FROM skill_proposals WHERE status='pending'"),activeSkills:one("SELECT COUNT(*) n FROM skill_versions WHERE status='active'")};}
export function stats(){const one=(sql:string)=>(db.prepare(sql).get() as any).n as number;return{research:one('SELECT COUNT(*) n FROM research_items'),topics:one('SELECT COUNT(*) n FROM topics'),content:one('SELECT COUNT(*) n FROM content_items'),finals:one("SELECT COUNT(*) n FROM article_versions WHERE version_type='final'")};}

export function getPublishPackage(id:string){return db.prepare(`SELECT * FROM publish_packages WHERE id=?`).get(id) as any||null;}
export function beginPackageRender(id:string){db.prepare(`DELETE FROM rendered_assets WHERE package_id=?`).run(id);db.prepare(`UPDATE publish_packages SET render_status='rendering' WHERE id=?`).run(id);}
export function failPackageRender(id:string){db.prepare(`UPDATE publish_packages SET render_status='failed' WHERE id=?`).run(id);}
export function saveRenderedAssets(packageId:string,assets:{filePath:string;width:number;height:number;kind:string;model:string}[]){const ins=db.prepare(`INSERT INTO rendered_assets(id,package_id,kind,file_path,width,height,model_name) VALUES (?,?,?,?,?,?,?)`);for(const a of assets)ins.run(randomUUID(),packageId,a.kind,a.filePath,a.width,a.height,a.model);db.prepare(`UPDATE publish_packages SET render_status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(packageId);return db.prepare(`SELECT id,kind,width,height,model_name,created_at FROM rendered_assets WHERE package_id=? ORDER BY created_at,id`).all(packageId);}
export function getRenderedAsset(id:string){return db.prepare(`SELECT a.*,p.content_item_id FROM rendered_assets a JOIN publish_packages p ON p.id=a.package_id WHERE a.id=?`).get(id) as any||null;}

export const VISUAL_TASK_TIMEOUT_MS=12*60*1000;
export const COVER_TASK_TIMEOUT_MS=10*60*1000;
function dbTimeMs(value:any){const s=String(value||'');const t=Date.parse(s.includes('T')?s:`${s.replace(' ','T')}Z`);return Number.isFinite(t)?t:0;}
function staleTask(value:any,timeoutMs=VISUAL_TASK_TIMEOUT_MS){const t=dbTimeMs(value);return !!t&&(Date.now()-t>timeoutMs);}
function staleMessage(timeoutMs=VISUAL_TASK_TIMEOUT_MS){return `生成任务超过 ${Math.round(timeoutMs/60000)} 分钟未完成，已标记为超时，请重试。`;}
function recoverStaleHtmlVisualJobs(packageId?:string){const rows=(packageId?db.prepare(`SELECT id,updated_at FROM html_visual_generation_jobs WHERE package_id=? AND status='generating'`).all(packageId):db.prepare(`SELECT id,updated_at FROM html_visual_generation_jobs WHERE status='generating'`).all()) as any[];for(const r of rows)if(staleTask(r.updated_at))db.prepare(`UPDATE html_visual_generation_jobs SET status='failed',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='generating'`).run(staleMessage(),r.id);}
export function getHtmlVisualGenerationJob(id:string){recoverStaleHtmlVisualJobs();return db.prepare(`SELECT * FROM html_visual_generation_jobs WHERE id=?`).get(id) as any||null;}
export function beginHtmlVisualGeneration(packageId:string,themeKey:string,label:string,outputFilePath:string){
  recoverStaleHtmlVisualJobs(packageId);
  const old=db.prepare(`SELECT * FROM html_visual_generation_jobs WHERE package_id=? AND theme_key=?`).get(packageId,themeKey) as any;
  if(old?.status==='generating')return{accepted:false,alreadyRunning:true,job:old};
  const id=randomUUID();
  db.prepare(`INSERT INTO html_visual_generation_jobs(id,package_id,theme_key,label,output_file_path,status,error_text) VALUES (?,?,?,?,?,'generating',NULL) ON CONFLICT(package_id,theme_key) DO UPDATE SET id=excluded.id,label=excluded.label,output_file_path=excluded.output_file_path,status='generating',error_text=NULL,created_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).run(id,packageId,themeKey,label,outputFilePath);
  return{accepted:true,alreadyRunning:false,job:getHtmlVisualGenerationJob(id)};
}
export function completeHtmlVisualGeneration(jobId:string){const job=getHtmlVisualGenerationJob(jobId);if(!job||job.status!=='generating')throw new Error('HTML 视觉生成任务已结束，结果未写入');const v=upsertHtmlVisualVariant(job.package_id,job.theme_key,job.label,job.output_file_path);db.prepare(`UPDATE html_visual_generation_jobs SET status='succeeded',error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='generating'`).run(jobId);return{job:getHtmlVisualGenerationJob(jobId),variant:v};}
export function failHtmlVisualGeneration(jobId:string,error:string){const job=db.prepare(`SELECT id FROM html_visual_generation_jobs WHERE id=?`).get(jobId) as any;if(job)db.prepare(`UPDATE html_visual_generation_jobs SET status='failed',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='generating'`).run(String(error||'生成失败').slice(0,1500),jobId);return getHtmlVisualGenerationJob(jobId);}
export function upsertHtmlVisualVariant(packageId:string,themeKey:string,label:string,filePath:string){const old=db.prepare(`SELECT id,status FROM html_visual_variants WHERE package_id=? AND theme_key=?`).get(packageId,themeKey) as any;const id=old?.id||randomUUID();db.prepare(`INSERT INTO html_visual_variants(id,package_id,theme_key,label,base_file_path,status) VALUES (?,?,?,?,?,'generated') ON CONFLICT(package_id,theme_key) DO UPDATE SET label=excluded.label,base_file_path=excluded.base_file_path,updated_at=CURRENT_TIMESTAMP`).run(id,packageId,themeKey,label,filePath);return db.prepare(`SELECT * FROM html_visual_variants WHERE id=?`).get(id) as any;}
export function ensureCoverSpec(packageId:string){db.prepare(`INSERT INTO cover_specs(package_id,skill_key,status,font_mode,logo_asset_path,notes) VALUES (?,'gc-minimal-zine-poster-v0-1','not_started','serif','public/brand/vox-music-school-logo.png','Codex may use its built-in $imagegen for GC cover artwork. Final title and VOX logo are composited outside the generated artwork for reliability.') ON CONFLICT(package_id) DO UPDATE SET logo_asset_path=COALESCE(cover_specs.logo_asset_path,excluded.logo_asset_path)`).run(packageId);const c:any=db.prepare(`SELECT * FROM cover_specs WHERE package_id=?`).get(packageId);c.revisions=db.prepare(`SELECT * FROM cover_revisions WHERE package_id=? ORDER BY revision_no`).all(packageId);c.current_revision_no=c.revisions.length?c.revisions[c.revisions.length-1].revision_no:0;return c;}

export function beginCoverGeneration(packageId:string){ensureCoverSpec(packageId);const generationId=randomUUID();db.prepare(`UPDATE cover_specs SET status='generating',generation_id=?,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(generationId,packageId);return ensureCoverSpec(packageId);}
export function completeCoverGeneration(packageId:string,input:{visualPath:string;htmlPath:string;pngPath:string;model:string;promptText?:string},generationId?:string){const current=ensureCoverSpec(packageId);if(generationId&&current.generation_id!==generationId)throw new Error('封面生成任务已结束，结果未写入');invalidateVisualMaster(packageId);db.prepare(`DELETE FROM cover_revisions WHERE package_id=?`).run(packageId);db.prepare(`UPDATE cover_specs SET status='ready',generation_id=NULL,visual_asset_path=?,cover_html_path=?,cover_png_path=?,model_name=?,prompt_text=?,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(input.visualPath,input.htmlPath,input.pngPath,input.model,input.promptText||null,packageId);return ensureCoverSpec(packageId);}
export function addCoverRevision(packageId:string,input:{instruction:string;visualPath:string;htmlPath:string;pngPath:string;model:string;promptText?:string}){invalidateVisualMaster(packageId);ensureCoverSpec(packageId);const n=((db.prepare(`SELECT MAX(revision_no) n FROM cover_revisions WHERE package_id=?`).get(packageId) as any)?.n||0)+1;db.prepare(`INSERT INTO cover_revisions(id,package_id,revision_no,edit_instruction,visual_asset_path,cover_html_path,cover_png_path,prompt_text,model_name) VALUES (?,?,?,?,?,?,?,?,?)`).run(randomUUID(),packageId,n,input.instruction,input.visualPath,input.htmlPath,input.pngPath,input.promptText||null,input.model);db.prepare(`UPDATE cover_specs SET status='ready',generation_id=NULL,visual_asset_path=?,cover_html_path=?,cover_png_path=?,model_name=?,prompt_text=?,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(input.visualPath,input.htmlPath,input.pngPath,input.model,input.promptText||null,packageId);return ensureCoverSpec(packageId);}
export function failCoverGeneration(packageId:string,error:string,generationId?:string){const current=ensureCoverSpec(packageId);if(generationId&&current.generation_id!==generationId)return current;db.prepare(`UPDATE cover_specs SET status='failed',generation_id=NULL,error_text=?,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(String(error||'生成失败').slice(0,1500),packageId);return ensureCoverSpec(packageId);}
export function failCoverRevision(packageId:string,error:string){ensureCoverSpec(packageId);db.prepare(`UPDATE cover_specs SET status=CASE WHEN cover_png_path IS NOT NULL THEN 'ready' ELSE 'failed' END,generation_id=NULL,error_text=?,updated_at=CURRENT_TIMESTAMP WHERE package_id=?`).run(error.slice(0,1500),packageId);return ensureCoverSpec(packageId);}
export function recoverStaleCoverGeneration(packageId:string){const c=ensureCoverSpec(packageId);if(c.status==='generating'&&staleTask(c.updated_at,COVER_TASK_TIMEOUT_MS)){db.prepare(`UPDATE cover_specs SET status='failed',generation_id=NULL,error_text=?,updated_at=CURRENT_TIMESTAMP WHERE package_id=? AND status='generating'`).run(staleMessage(COVER_TASK_TIMEOUT_MS),packageId);return ensureCoverSpec(packageId);}return c;}
export function getHtmlVisualState(packageId:string){recoverStaleHtmlVisualJobs(packageId);const variants=(db.prepare(`SELECT * FROM html_visual_variants WHERE package_id=? ORDER BY created_at`).all(packageId) as any[]);for(const v of variants){v.revisions=db.prepare(`SELECT * FROM html_visual_revisions WHERE variant_id=? ORDER BY revision_no`).all(v.id);const latest=v.revisions?.length?v.revisions[v.revisions.length-1]:null;v.current_file_path=latest?.file_path||v.base_file_path;v.current_revision_no=latest?.revision_no||0;}const selected=variants.find(v=>v.status==='selected'||v.status==='final')||null;const cover=recoverStaleCoverGeneration(packageId);const generationJobs=db.prepare(`SELECT * FROM html_visual_generation_jobs WHERE package_id=? ORDER BY created_at DESC`).all(packageId);return{variants,selected,cover,generationJobs};}
export function selectHtmlVisualVariant(packageId:string,themeKey:string){const v=db.prepare(`SELECT * FROM html_visual_variants WHERE package_id=? AND theme_key=?`).get(packageId,themeKey) as any;if(!v)throw new Error('visual variant not found');db.prepare(`UPDATE html_visual_variants SET status='generated',selected_at=NULL WHERE package_id=? AND id<>?`).run(packageId,v.id);db.prepare(`UPDATE html_visual_variants SET status=CASE WHEN status='final' THEN 'final' ELSE 'selected' END,selected_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(v.id);return getHtmlVisualState(packageId);}
export function getHtmlVisualVariant(id:string){const v=db.prepare(`SELECT * FROM html_visual_variants WHERE id=?`).get(id) as any;if(!v)return null;v.revisions=db.prepare(`SELECT * FROM html_visual_revisions WHERE variant_id=? ORDER BY revision_no`).all(id);const latest=v.revisions?.length?v.revisions[v.revisions.length-1]:null;v.current_file_path=latest?.file_path||v.base_file_path;v.current_revision_no=latest?.revision_no||0;return v;}
export function addHtmlVisualRevision(variantId:string,filePath:string,instruction:string){const v=getHtmlVisualVariant(variantId);if(!v)throw new Error('visual variant not found');invalidateVisualMaster(v.package_id);const n=(v.current_revision_no||0)+1;const id=randomUUID();db.prepare(`INSERT INTO html_visual_revisions(id,variant_id,revision_no,file_path,edit_instruction) VALUES (?,?,?,?,?)`).run(id,variantId,n,filePath,instruction);db.prepare(`UPDATE html_visual_variants SET status='selected',selected_at=COALESCE(selected_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(variantId);return getHtmlVisualVariant(variantId);}
export function finalizeHtmlVisual(variantId:string,revisionId?:string|null){const v=getHtmlVisualVariant(variantId);if(!v)throw new Error('visual variant not found');db.prepare(`UPDATE html_visual_variants SET status='generated',selected_at=NULL WHERE package_id=? AND id<>?`).run(v.package_id,variantId);db.prepare(`UPDATE html_visual_variants SET status='final',selected_at=COALESCE(selected_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(variantId);db.prepare(`UPDATE html_visual_revisions SET is_final=0 WHERE variant_id=?`).run(variantId);if(revisionId)db.prepare(`UPDATE html_visual_revisions SET is_final=1 WHERE id=? AND variant_id=?`).run(revisionId,variantId);return getHtmlVisualState(v.package_id);}

function invalidateVisualMaster(packageId:string){const p=db.prepare(`SELECT content_item_id,status FROM publish_packages WHERE id=?`).get(packageId) as any;if(p?.status==='master_approved'){db.prepare(`UPDATE publish_packages SET status='publish_approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(packageId);db.prepare(`DELETE FROM platform_adaptations WHERE content_item_id=?`).run(p.content_item_id);db.prepare(`UPDATE content_items SET publish_state='wechat_copy_approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(p.content_item_id)}}
export function approveVisualMaster(packageId:string){
  const p=db.prepare(`SELECT id,content_item_id,platform FROM publish_packages WHERE id=?`).get(packageId) as any;
  if(!p)throw new Error('package not found');
  if(p.platform!=='wechat_long_image')throw new Error('WeChat package required');
  const state=getHtmlVisualState(packageId),selected:any=state.selected,cover:any=state.cover;
  if(!selected)throw new Error('请先选择一版公众号 HTML');
  if(selected.status!=='final')throw new Error('请先最终确认公众号 HTML');
  if(!cover?.cover_png_path||cover.status!=='ready')throw new Error('请先生成公众号封面');
  db.prepare(`UPDATE publish_packages SET status='master_approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(packageId);
  db.prepare(`DELETE FROM platform_adaptations WHERE content_item_id=?`).run(p.content_item_id);
  db.prepare(`UPDATE content_items SET publish_state='master_approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(p.content_item_id);
  return{contentId:p.content_item_id,nextUrl:`/release?id=${encodeURIComponent(p.content_item_id)}`};
}
export function getMasterPackage(contentId:string){return db.prepare(`SELECT * FROM publish_packages WHERE content_item_id=? AND platform='wechat_long_image' ORDER BY updated_at DESC LIMIT 1`).get(contentId) as any||null;}
export function setMasterSocialCaption(contentId:string,caption:string){const p=getMasterPackage(contentId);if(!p)throw new Error('master package not found');const v=String(caption||'').trim();if(!v)throw new Error('social caption required');if([...v].length>1000)throw new Error('social caption must be <= 1000 chars');db.prepare(`UPDATE publish_packages SET social_caption=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(v,p.id);return{packageId:p.id,chars:[...v].length,caption:v};}
export function listAdaptations(contentId:string){const rows=db.prepare(`SELECT * FROM platform_adaptations WHERE content_item_id=? ORDER BY CASE platform WHEN 'xiaohongshu' THEN 1 WHEN 'douyin' THEN 2 ELSE 9 END`).all(contentId) as any[];for(const r of rows){r.files=r.files_json?JSON.parse(r.files_json):[];r.revisions=(db.prepare(`SELECT * FROM platform_adaptation_revisions WHERE adaptation_id=? ORDER BY revision_no`).all(r.id) as any[]).map((x:any)=>({...x,files:x.files_json?JSON.parse(x.files_json):[]}))}return rows;}
export function getAdaptation(id:string){const r=db.prepare(`SELECT * FROM platform_adaptations WHERE id=?`).get(id) as any;if(!r)return null;r.files=r.files_json?JSON.parse(r.files_json):[];return r;}
export function beginAdaptation(contentId:string,platform:string,sourcePackageId:string){if(!['xiaohongshu','douyin'].includes(platform))throw new Error('invalid platform');let r=db.prepare(`SELECT * FROM platform_adaptations WHERE content_item_id=? AND platform=?`).get(contentId,platform) as any;if(!r){const id=randomUUID();db.prepare(`INSERT INTO platform_adaptations(id,content_item_id,source_package_id,platform,status) VALUES (?,?,?,?,'generating')`).run(id,contentId,sourcePackageId,platform);r=db.prepare(`SELECT * FROM platform_adaptations WHERE id=?`).get(id)}else{db.prepare(`UPDATE platform_adaptations SET source_package_id=?,status='generating',error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(sourcePackageId,r.id);r=db.prepare(`SELECT * FROM platform_adaptations WHERE id=?`).get(r.id)}db.prepare(`UPDATE content_items SET publish_state='platform_adapting',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(contentId);return r;}
export function completeAdaptation(adaptationId:string,files:any[],model:string,instruction=''){const r=getAdaptation(adaptationId);if(!r)throw new Error('adaptation not found');const n=(r.current_revision_no||0)+1,json=JSON.stringify(files);db.prepare(`INSERT INTO platform_adaptation_revisions(id,adaptation_id,revision_no,files_json,edit_instruction,model_name) VALUES (?,?,?,?,?,?)`).run(randomUUID(),adaptationId,n,json,instruction||null,model);db.prepare(`UPDATE platform_adaptations SET status='ready',current_revision_no=?,files_json=?,model_name=?,last_instruction=?,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(n,json,model,instruction||null,adaptationId);return getAdaptation(adaptationId);}
export function failAdaptation(adaptationId:string,error:string){db.prepare(`UPDATE platform_adaptations SET status='failed',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(error.slice(0,1200),adaptationId);return getAdaptation(adaptationId);}
export function approveAdaptation(adaptationId:string){const r=getAdaptation(adaptationId);if(!r)throw new Error('adaptation not found');if(!r.files?.length)throw new Error('adaptation files missing');db.prepare(`UPDATE platform_adaptations SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(adaptationId);const c=db.prepare(`SELECT COUNT(*) n FROM platform_adaptations WHERE content_item_id=? AND platform IN ('xiaohongshu','douyin') AND status='approved'`).get(r.content_item_id) as any;const state=Number(c?.n||0)>=2?'ready_to_publish':'platform_adapting';db.prepare(`UPDATE content_items SET publish_state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(state,r.content_item_id);return state;}
export function saveOauthState(platform:string,contentId:string,state:string,expiresAt:number){db.prepare(`INSERT OR REPLACE INTO platform_oauth_states(state,platform,content_item_id,expires_at) VALUES (?,?,?,?)`).run(state,platform,contentId,expiresAt)}
export function consumeOauthState(state:string){const r=db.prepare(`SELECT * FROM platform_oauth_states WHERE state=?`).get(state) as any;if(!r||Number(r.expires_at)<Date.now())return null;db.prepare(`DELETE FROM platform_oauth_states WHERE state=?`).run(state);return r}
export function saveOauthToken(platform:string,t:any){db.prepare(`INSERT INTO platform_oauth_tokens(platform,access_token,refresh_token,open_id,scope,expires_at) VALUES (?,?,?,?,?,?) ON CONFLICT(platform) DO UPDATE SET access_token=excluded.access_token,refresh_token=excluded.refresh_token,open_id=excluded.open_id,scope=excluded.scope,expires_at=excluded.expires_at,updated_at=CURRENT_TIMESTAMP`).run(platform,t.accessToken,t.refreshToken||null,t.openId||null,t.scope||null,t.expiresAt||null)}
export function oauthTokenStatus(platform:string){const r=db.prepare(`SELECT platform,open_id,scope,expires_at,updated_at FROM platform_oauth_tokens WHERE platform=?`).get(platform) as any;return r?{...r,valid:!r.expires_at||Number(r.expires_at)>Date.now()}:null}
export function getOauthToken(platform:string){return db.prepare(`SELECT * FROM platform_oauth_tokens WHERE platform=?`).get(platform) as any||null}
export function listPublishJobs(contentId:string){return (db.prepare(`SELECT id,platform,action,status,remote_id,error_text,meta_json,created_at,updated_at FROM platform_publish_jobs WHERE content_item_id=? ORDER BY created_at DESC`).all(contentId) as any[]).map((r:any)=>({...r,meta:r.meta_json?JSON.parse(r.meta_json):null}))}
export function startPublishJob(contentId:string,platform:string,action:string,meta:any=null){const id=randomUUID();db.prepare(`INSERT INTO platform_publish_jobs(id,content_item_id,platform,action,status,meta_json) VALUES (?,?,?,?, 'running',?)`).run(id,contentId,platform,action,meta?JSON.stringify(meta):null);return id}
function archiveArtifacts(contentId:string,master:any){const out:any={};if(master){const c:any=db.prepare(`SELECT cover_png_path,visual_asset_path FROM cover_specs WHERE package_id=?`).get(master.id);if(c?.cover_png_path)out.cover=c.cover_png_path;if(c?.visual_asset_path)out.poster=c.visual_asset_path;const v:any=db.prepare(`SELECT id,base_file_path FROM html_visual_variants WHERE package_id=? AND status IN ('selected','final') ORDER BY updated_at DESC LIMIT 1`).get(master.id);if(v){const r:any=db.prepare(`SELECT file_path FROM html_visual_revisions WHERE variant_id=? ORDER BY revision_no DESC LIMIT 1`).get(v.id);out.masterHtml=r?.file_path||v.base_file_path}const mf=path.join(process.cwd(),'public','generated',master.id,'wechat-mobile','manifest.json');if(existsSync(mf))try{out.wechatMobile=JSON.parse(readFileSync(mf,'utf8'))}catch{}}const ads=listAdaptations(contentId);out.adaptations=ads.map((a:any)=>({platform:a.platform,revision:a.current_revision_no,files:a.files||[]}));return out}
export function archivePublishJob(jobId:string){const j:any=db.prepare(`SELECT * FROM platform_publish_jobs WHERE id=?`).get(jobId);if(!j)return null;const m:any=getMasterPackage(j.content_item_id),c:any=db.prepare(`SELECT c.final_text,t.title topic_title FROM content_items c LEFT JOIN topics t ON t.id=c.topic_id WHERE c.id=?`).get(j.content_item_id),existing:any=db.prepare(`SELECT id FROM publish_archives WHERE job_id=?`).get(jobId),id=existing?.id||randomUUID(),artifacts=archiveArtifacts(j.content_item_id,m);db.prepare(`INSERT INTO publish_archives(id,job_id,content_item_id,platform,action,status,remote_id,title_snapshot,master_package_id,body_snapshot,social_caption_snapshot,artifacts_json,meta_json,created_at,updated_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(job_id) DO UPDATE SET status=excluded.status,remote_id=excluded.remote_id,title_snapshot=excluded.title_snapshot,master_package_id=excluded.master_package_id,body_snapshot=excluded.body_snapshot,social_caption_snapshot=excluded.social_caption_snapshot,artifacts_json=excluded.artifacts_json,meta_json=excluded.meta_json,updated_at=excluded.updated_at,archived_at=CURRENT_TIMESTAMP`).run(id,j.id,j.content_item_id,j.platform,j.action,j.status,j.remote_id||null,m?.title||c?.topic_title||'',m?.id||null,m?.body||c?.final_text||'',m?.social_caption||null,JSON.stringify(artifacts),j.meta_json||null,j.created_at,j.updated_at);return db.prepare(`SELECT * FROM publish_archives WHERE job_id=?`).get(jobId)}
export function finishPublishJob(id:string,remoteId:string|null,meta:any=null){db.prepare(`UPDATE platform_publish_jobs SET status='succeeded',remote_id=?,meta_json=?,error_text=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(remoteId,meta?JSON.stringify(meta):null,id);archivePublishJob(id);return db.prepare(`SELECT * FROM platform_publish_jobs WHERE id=?`).get(id)}
export function failPublishJob(id:string,error:string){db.prepare(`UPDATE platform_publish_jobs SET status='failed',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(error.slice(0,1200),id);archivePublishJob(id);return db.prepare(`SELECT * FROM platform_publish_jobs WHERE id=?`).get(id)}
export function listPublishHistory(limit=200){return (db.prepare(`SELECT * FROM publish_archives ORDER BY created_at DESC LIMIT ?`).all(limit) as any[]).map((r:any)=>({...r,meta:r.meta_json?JSON.parse(r.meta_json):null,artifacts:r.artifacts_json?JSON.parse(r.artifacts_json):{}}))}
export function getPublishHistoryContent(contentId:string){return listPublishHistory(500).filter((r:any)=>r.content_item_id===contentId)}
export function backfillPublishArchives(){const jobs=db.prepare(`SELECT id FROM platform_publish_jobs WHERE status IN ('succeeded','failed') ORDER BY created_at`).all() as any[];for(const j of jobs)archivePublishJob(String(j.id));return jobs.length}
export function getReleaseItem(contentId:string){const item=db.prepare(`SELECT c.id content_id,c.final_text,c.publish_state,t.title topic_title FROM content_items c JOIN topics t ON t.id=c.topic_id WHERE c.id=?`).get(contentId) as any;if(!item)return null;item.archive=getContentArchive(contentId);item.master=getMasterPackage(contentId);item.adaptations=listAdaptations(contentId);item.publishJobs=listPublishJobs(contentId);return item;}
export function getLatestReleaseItem(){const r=db.prepare(`SELECT id FROM content_items WHERE publish_state IN ('master_approved','platform_adapting','ready_to_publish') ORDER BY updated_at DESC LIMIT 1`).get() as any;return r?getReleaseItem(r.id):null;}
try{backfillPublishArchives()}catch{}

// ---- Imported finished-media + content flywheel ----
export function createImportedVideo(input:{originalName:string;mimeType?:string;sizeBytes?:number;title?:string;notes?:string}){
  const topicId=`upload-${randomUUID()}`,contentId=randomUUID(),assetId=randomUUID(),title=String(input.title||input.originalName.replace(/\.[^.]+$/,'')||'上传视频').trim();
  db.prepare(`INSERT INTO topics(id,title,column_key,why_now,vox_angle,source_summary,freshness_score,vox_fit_score,audible_score,suggested_format,status) VALUES (?,?,?,?,?,?,?,?,?,?,'selected')`).run(topicId,title,'yueli','用户主动上传已有成片','已有内容直接分发','用户上传',5,8,8,'video');
  db.prepare(`INSERT INTO content_items(id,topic_id,content_state,publish_state,user_raw_input,source_kind) VALUES (?,?,'uploaded_media','media_ready',?,'imported_video')`).run(contentId,topicId,String(input.notes||''));
  db.prepare(`INSERT INTO source_assets(id,content_item_id,kind,original_name,mime_type,size_bytes,status,user_notes,meta_json) VALUES (?,?,?,?,?,?,'pending_upload',?,?)`).run(assetId,contentId,'video',input.originalName,input.mimeType||null,input.sizeBytes||0,input.notes||null,JSON.stringify({title}));
  return{contentId,assetId,title};
}
export function updateSourceAssetUpload(assetId:string,filePath:string,status='ready'){db.prepare(`UPDATE source_assets SET file_path=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(filePath,status,assetId);return getSourceAsset(assetId)}
export function setSourceAssetCover(assetId:string,coverPath:string){db.prepare(`UPDATE source_assets SET cover_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(coverPath,assetId);return getSourceAsset(assetId)}
export function getSourceAsset(assetId:string){const r=db.prepare(`SELECT a.*,t.title topic_title,c.publish_state FROM source_assets a JOIN content_items c ON c.id=a.content_item_id JOIN topics t ON t.id=c.topic_id WHERE a.id=?`).get(assetId) as any;if(!r)return null;try{r.meta=r.meta_json?JSON.parse(r.meta_json):{}}catch{r.meta={}}return r}
export function listSourceAssets(limit=50){return (db.prepare(`SELECT a.*,t.title topic_title,c.publish_state FROM source_assets a JOIN content_items c ON c.id=a.content_item_id JOIN topics t ON t.id=c.topic_id ORDER BY a.created_at DESC LIMIT ?`).all(limit) as any[]).map((r:any)=>{try{r.meta=r.meta_json?JSON.parse(r.meta_json):{}}catch{r.meta={}}return r})}
export function saveSourceAssetMeta(assetId:string,meta:any,notes?:string){const a=getSourceAsset(assetId);if(!a)throw Error('asset not found');const merged={...(a.meta||{}),...meta};db.prepare(`UPDATE source_assets SET meta_json=?,user_notes=COALESCE(?,user_notes),status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(JSON.stringify(merged),notes||null,assetId);const title=String(merged.selectedTitle||merged.title||merged.titles?.[0]||a.topic_title||'').trim();if(title)db.prepare(`UPDATE topics SET title=? WHERE id=(SELECT topic_id FROM content_items WHERE id=?)`).run(title,a.content_item_id);return getSourceAsset(assetId)}
export function savePrediction(contentId:string,assetId:string|null,prediction:any,rubricVersion='vox-performance-v1'){const old=db.prepare(`SELECT id FROM content_predictions WHERE content_item_id=? AND asset_id IS ?`).get(contentId,assetId) as any,id=old?.id||randomUUID();db.prepare(`INSERT INTO content_predictions(id,content_item_id,asset_id,rubric_version,prediction_json) VALUES (?,?,?,?,?) ON CONFLICT(content_item_id,asset_id) DO UPDATE SET rubric_version=excluded.rubric_version,prediction_json=excluded.prediction_json,locked_at=CURRENT_TIMESTAMP`).run(id,contentId,assetId,rubricVersion,JSON.stringify(prediction));return id}
export function savePerformanceSnapshot(input:{contentId:string;assetId?:string|null;platform:string;windowLabel?:string;views?:number;likes?:number;comments?:number;shares?:number;saves?:number;followersGained?:number}){const id=randomUUID(),w=input.windowLabel||'T+3';db.prepare(`INSERT INTO performance_snapshots(id,content_item_id,asset_id,platform,window_label,views,likes,comments,shares,saves,followers_gained,captured_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(content_item_id,asset_id,platform,window_label) DO UPDATE SET views=excluded.views,likes=excluded.likes,comments=excluded.comments,shares=excluded.shares,saves=excluded.saves,followers_gained=excluded.followers_gained,captured_at=CURRENT_TIMESTAMP`).run(id,input.contentId,input.assetId||null,input.platform,w,input.views||0,input.likes||0,input.comments||0,input.shares||0,input.saves||0,input.followersGained||0);return true}
export function growthSummary(){
  const preds=(db.prepare(`SELECT p.*,t.title,a.original_name FROM content_predictions p JOIN content_items c ON c.id=p.content_item_id JOIN topics t ON t.id=c.topic_id LEFT JOIN source_assets a ON a.id=p.asset_id ORDER BY p.locked_at DESC LIMIT 50`).all() as any[]).map((r:any)=>{try{r.prediction=JSON.parse(r.prediction_json)}catch{r.prediction={}}r.snapshots=db.prepare(`SELECT * FROM performance_snapshots WHERE content_item_id=? AND asset_id IS ? ORDER BY captured_at DESC`).all(r.content_item_id,r.asset_id) as any[];return r});
  const count=(sql:string)=>(db.prepare(sql).get() as any).n as number,active=db.prepare(`SELECT version,weights_json,notes FROM performance_rubric_versions WHERE status='active' ORDER BY created_at DESC LIMIT 1`).get() as any;
  return{predictions:preds,publishedWithData:count(`SELECT COUNT(DISTINCT content_item_id || ':' || COALESCE(asset_id,'')) n FROM performance_snapshots`),pendingRetro:count(`SELECT COUNT(*) n FROM content_predictions p WHERE NOT EXISTS(SELECT 1 FROM performance_snapshots s WHERE s.content_item_id=p.content_item_id AND s.asset_id IS p.asset_id AND s.window_label='T+3')`),rubric:active?{...active,weights:JSON.parse(active.weights_json)}:null};
}
