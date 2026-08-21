import { toolStatus } from '../../../../lib/research';
import { stats } from '../../../../lib/db';
import { KIMI_MODEL } from '../../../../lib/kimi';
export const runtime='nodejs';
export async function GET(){const tools=await toolStatus();return Response.json({ok:true,kimiConfigured:!!(process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY),kimiModel:KIMI_MODEL,openaiImageConfigured:!!process.env.OPENAI_API_KEY,openaiImageModel:'gpt-image-2',kimiThinking:/kimi[-_/]?k2\.6/i.test(KIMI_MODEL),tools,stats:stats(),dryRun:process.env.DRY_RUN_ONLY!=='false'})}
