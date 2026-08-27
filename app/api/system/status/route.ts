import { toolStatus } from '../../../../lib/research';
import { stats } from '../../../../lib/db';
import { KIMI_MODEL } from '../../../../lib/kimi';
import {getLlmStatus} from '../../../../lib/llm-config';
export const runtime='nodejs';
export async function GET(){
  const tools=await toolStatus(),llm=getLlmStatus(),active=llm.options.find(x=>x.provider===llm.activeProvider);
  return Response.json({ok:true,kimiConfigured:!!(process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY),kimiModel:KIMI_MODEL,geminiConfigured:!!(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY),llmProvider:llm.activeProvider,llmModel:active?.model,llmOptions:llm.options,openaiImageConfigured:!!process.env.OPENAI_API_KEY,openaiImageModel:'gpt-image-2',kimiThinking:llm.activeProvider==='kimi'&&/kimi[-_/]?k2\.6/i.test(KIMI_MODEL),tools,stats:stats(),dryRun:process.env.DRY_RUN_ONLY!=='false'})
}
