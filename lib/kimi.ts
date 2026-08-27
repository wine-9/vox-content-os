import {CONTROL_PROMPT,HUMAN_WRITING_PROMPT,ULTIMATE_FUSION_PROMPT,type WriterKey} from './writer-skills';
import {getActiveLlmProvider} from './llm-config';
import {geminiComplete} from './gemini';
export const KIMI_BASE_URL=process.env.KIMI_BASE_URL||'https://api.moonshot.ai/v1';
export const KIMI_MODEL=process.env.KIMI_MODEL||'kimi-k2.6';
type KimiInput={title:string;voxAngle?:string;source?:string;viewpoint:string;skillBody?:string;skillVersion?:string};
export type PlatformKey='xiaohongshu'|'douyin'|'wechat_long_image';
export type PlatformPackage={title:string;body:string;visualPrompt:string;model:string};
type ParsedKimi={text:string;model?:string};
function safeApiError(raw:string){try{const d=JSON.parse(raw);return String(d?.error?.message||d?.message||'').replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED_KEY]').slice(0,240)}catch{return''}}
function endpoints(baseUrl:string){const b=baseUrl.replace(/\/+$/,'');return /\/v1$/i.test(b)?[`${b}/chat/completions`]:[`${b}/v1/chat/completions`,`${b}/chat/completions`]}
function contentText(c:any){if(typeof c==='string')return c;if(!Array.isArray(c))return'';return c.map((p:any)=>typeof p==='string'?p:p?.text||'').join('').trim()}
function parsePayload(raw:string):ParsedKimi|null{try{const d=JSON.parse(raw),t=contentText(d?.choices?.[0]?.message?.content);if(t)return{text:t,model:d?.model}}catch{}let text='',model='',saw=false;for(const line of raw.split(/\r?\n/)){if(!line.startsWith('data:'))continue;const p=line.slice(5).trim();if(!p||p==='[DONE]')continue;saw=true;try{const d=JSON.parse(p);if(!model&&d?.model)model=String(d.model);const c=d?.choices?.[0];text+=contentText(c?.delta?.content??c?.message?.content)}catch{}}return saw&&text?{text,model:model||undefined}:null}
async function readStreamingBody(res:Response,totalMs=300000,idleMs=90000){
  if(!res.body)return await res.text();
  const reader=res.body.getReader(),decoder=new TextDecoder();let raw='',done=false;
  const started=Date.now();
  while(!done){
    const remaining=totalMs-(Date.now()-started);if(remaining<=0){try{await reader.cancel()}catch{};throw new Error('KIMI_TIMEOUT')}
    let timer:any;
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('KIMI_IDLE_TIMEOUT')),Math.min(idleMs,remaining))});
    try{const chunk:any=await Promise.race([reader.read(),timeout]);done=chunk.done;if(chunk.value)raw+=decoder.decode(chunk.value,{stream:!done})}finally{clearTimeout(timer)}
  }
  return raw;
}
async function kimiComplete(system:string,user:string,temperature=.65,maxTokens=3072){
  if(getActiveLlmProvider()==='gemini')return geminiComplete(system,user,temperature,maxTokens);
  const key=process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY;if(!key)throw new Error('KIMI_API_KEY_MISSING');
  const isK26=/kimi[-_/]?k2\.6/i.test(KIMI_MODEL);let last='KIMI_REQUEST_FAILED';
  for(const endpoint of endpoints(KIMI_BASE_URL)){
    try{
      const payload:any={model:KIMI_MODEL,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:maxTokens,stream:true};
      // Kimi K2.6 keeps its provider-default Thinking mode. Do not disable reasoning.
      if(!isK26)payload.temperature=temperature;
      const controller=new AbortController();const connectTimer=setTimeout(()=>controller.abort(),60000);
      let res:Response;
      try{res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify(payload),signal:controller.signal})}finally{clearTimeout(connectTimer)}
      const ct=res.headers.get('content-type')||'';
      const raw=ct.includes('text/event-stream')?await readStreamingBody(res):await res.text();
      if(!res.ok){const d=safeApiError(raw);last=`KIMI_${res.status}${d?`: ${d}`:''}`;if(ct.includes('json')&&![404,405].includes(res.status))throw new Error(last);continue}
      const parsed=parsePayload(raw);if(!parsed?.text){last='KIMI_INVALID_RESPONSE';continue}
      return{text:parsed.text,model:String(parsed.model||KIMI_MODEL)};
    }catch(e:any){
      const m=String(e?.message||'');if(m.startsWith('KIMI_')&&!['KIMI_TIMEOUT','KIMI_IDLE_TIMEOUT'].includes(m))throw e;
      last=(m==='KIMI_TIMEOUT'||m==='KIMI_IDLE_TIMEOUT'||e?.name==='TimeoutError'||e?.name==='AbortError')?'KIMI_TIMEOUT':'KIMI_NETWORK_ERROR';
    }
  }
  throw new Error(last);
}
export async function kimiWriterCandidate(input:{writer:WriterKey;viewpoint:string;learnedSkillBody?:string;learnedSkillVersion?:string}){
  const learned=input.writer==='ultimate_fusion'&&input.learnedSkillBody?.trim()?`\n\nVOX 后续人工学习增量（${input.learnedSkillVersion||'active'}）：\n${input.learnedSkillBody.trim()}\n它只能作为跨样本风格偏好增量，不能带入任何具体旧文章主题、人物、事实、例子、标题或来源；若与当前 Brief 冲突，以当前 Brief 为最高优先级。`:'';
  const base=input.writer==='control'?CONTROL_PROMPT:input.writer==='human_writing'?HUMAN_WRITING_PROMPT:ULTIMATE_FUSION_PROMPT;
  const system=`${base}${learned}`;
  const user=`【当前 Content Brief｜唯一内容来源｜最高优先级】\n${input.viewpoint}\n\n硬规则：只根据上面的当前 Brief 成稿。不要引用、补全或延续任何未出现在本 Brief 中的旧选题、旧标题、旧来源、上一轮 Candidate/Final、人物经历或主题。不要提到盲选、Writer 或 Skill。`;
  return kimiComplete(system,user,.65,3072);
}

export type CreatorCalibrationReply={reply:string;ready:boolean;brief:any;observations:{kind:string;value:string;confidence?:number}[];model:string};
export async function kimiCreatorCalibration(input:{title:string;voxAngle?:string;source?:string;messages:{role:string;body:string}[]}) : Promise<CreatorCalibrationReply>{
  const system=`你是 Sinote 的写前编辑。你的任务不是写文章，也不是做心理咨询或固定问卷；而是以安静、具体、有判断力的编辑对话，帮助创作者把一条模糊想法收敛成可写的内容理解。

只使用用户在当前对话里说出的事实、经历、判断和给出的选题资料；绝不补造经历、人物、数据或结论。优先保留用户原话中的自然表达。每轮只问一个信息增量最高的问题，不要罗列问题、不要套模板。通常在用户 3–7 次有信息的回答后收束；若一开始已经够写，可在 1–3 次后收束。用户说“不知道/说不清”时，不追问抽象立场，改问一个小而具体的时刻、对象、反例或困扰。若已经能清楚写出：要讨论的问题、用户判断、至少一个真实经历或例子、内容入口/角度，就应结束追问。

只返回严格 JSON，不要 markdown 或额外文字：
{"reply":"给用户看的自然中文回复；准备好时必须包含‘我大概知道你真正想讲什么了。’且不能再提问","ready":true|false,"brief":{"starting_idea":"","problem":"","user_judgment":"","experiences":[],"examples":[],"counterarguments":[],"boundaries":[],"angle":"","desired_reader_reaction":"","useful_original_quotes":[],"evidence_needed":[],"conversation_summary":""},"observations":[{"kind":"problem|judgment|experience|example|boundary|angle|quote","value":"只摘取本轮或先前用户明确说过的内容","confidence":0.0}]}

brief 每轮都应是基于当前对话的可编辑工作稿；未知字段留空或空数组。不要把选题资料误当成用户经历。`;
  const transcript=input.messages.map(m=>`${m.role==='assistant'?'Sinote':'创作者'}：${m.body}`).join('\n\n');
  const user=`【当前选题】\n标题：${input.title}\n选题入口：${input.voxAngle||'未提供'}\n资料摘要：${input.source||'未提供'}\n\n【对话记录】\n${transcript||'尚未开始。请先用一句自然、具体的问题邀请创作者说说他/她真正想讲的事。'}`;
  const r=await kimiComplete(system,user,.45,2200),o=parseJson(r.text);
  if(!o||typeof o.reply!=='string'||typeof o.ready!=='boolean'||!o.brief)throw new Error('KIMI_CALIBRATION_INVALID_RESPONSE');
  return {reply:o.reply.trim(),ready:Boolean(o.ready),brief:o.brief,observations:Array.isArray(o.observations)?o.observations:[],model:r.model};
}

export async function kimiWrite(input:KimiInput){return kimiWriterCandidate({writer:'control',viewpoint:input.viewpoint})}
export async function kimiMomentsCaption(input:{title?:string;finalText:string}){const system='你负责给 VOX 音乐教室已经确认的文章写一条朋友圈转发文案。只写一句，45-80 个中文字符左右，像教室老师或主理人自然转发自己刚发的内容：点出一个具体看点或问题，让人知道为什么值得点开。不要硬招生，不要价格，不要 hashtag，不要标题党，不要用“干货”“建议收藏”“速看”等营销词，不要复述整篇文章，不要输出引号、解释、前缀或多行。';const user=`标题：${input.title||''}\n\n最终正文：\n${input.finalText}`;const r=await kimiComplete(system,user,.5,256);let v=r.text.trim().replace(/^```(?:text)?\s*/i,'').replace(/\s*```$/,'').replace(/[\r\n]+/g,' ').replace(/^[“"']|[”"']$/g,'').trim();if([...v].length>100)v=[...v].slice(0,96).join('').replace(/[，、；：]$/,'')+'。';return{text:v,model:r.model}}
function parseJson(text:string){const c=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(c)}catch{}const a=c.indexOf('{'),b=c.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(c.slice(a,b+1))}catch{}}return null}
const rules:Record<PlatformKey,string>={xiaohongshu:'小红书图文：标题尽量20字以内，正文约450-800字；具体痛点/场景开头；短段自然；禁止价格、金额、二维码、微信、折扣、付款导流；不要硬招生。',douyin:'抖音图文：标题或首句快速说明听觉痛点/反差，正文约300-600字，信息密度高，适合5-8张图；禁止价格、金额、二维码、微信、折扣、付款导流；不要喊麦式营销。',wechat_long_image:'公众号长图：约700-1100字；按场景/问题—原理—例子—可执行方法—收束组织，适合拆成长图卡片；直接写成稿，不要展示分析过程；可以更深入但不得虚构事实，不要硬招生。'};
export async function kimiPlatformPackage(input:{platform:PlatformKey;finalText:string}){const system=`你是 VOX 音乐教室多平台内容编辑。当前人工确认的 Final 是本次平台制作的唯一内容来源。绝对不得读取、猜测或延续旧选题、热点标题、研究来源、旧 Brief、旧 Candidate 或其他文章。只能基于 Final 做结构、长度、标题和视觉形态上的平台适配，不能改变核心观点，也不能新增 Final 不支持的事实。${rules[input.platform]}\n只返回严格 JSON，字段必须是 title、body、visual_prompt。visual_prompt 用中文描述封面/长图视觉方向，只描述设计与配图，不生成二维码和促销信息。`;const user=`平台：${input.platform}\n\n【人工 Final｜唯一内容来源】\n${input.finalText}`;const r=await kimiComplete(system,user,.45,3072),o=parseJson(r.text)||{};const fallbackTitle=String(input.finalText).trim().split(/[。！？\n]/)[0].slice(0,28)||'VOX 音乐内容';return{title:String(o.title||fallbackTitle).trim(),body:String(o.body||r.text).trim(),visualPrompt:String(o.visual_prompt||'基于当前 Final 制作干净、专业、年轻化的音乐教育视觉，突出文章的一个核心概念，避免元素过满。').trim(),model:r.model} satisfies PlatformPackage}

export async function kimiVideoMetadata(input:{filename:string;notes:string}){const system='你是 VOX 音乐教室的视频分发编辑。根据用户已经剪好的成片说明，只负责标题、平台简介、标签和发布前表现预测，不改视频。只返回严格 JSON：titles(5个中文标题)，xiaohongshu{title,desc},douyin{title,desc},tags(5-10个无#标签)，prediction{topicStrength,hook,clarity,commentPotential,shareSavePotential,voxFit,summary}。六项分数均为0-10。标题自然，不要营销腔，不要虚构视频里没有的信息。';const user=`文件名：${input.filename}\n成片内容说明/口述稿：\n${input.notes}`;const r=await kimiComplete(system,user,.45,1600),o=parseJson(r.text)||{};return{...o,model:r.model}}
