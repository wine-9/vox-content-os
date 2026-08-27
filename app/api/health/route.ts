import { stats } from '../../../lib/db';
import { KIMI_MODEL } from '../../../lib/kimi';
import {getLlmStatus} from '../../../lib/llm-config';
export const runtime='nodejs';
export async function GET(){
  const llm=getLlmStatus(),active=llm.options.find(x=>x.provider===llm.activeProvider);
  return Response.json({ok:true,service:'vox-content-os',dry_run_only:process.env.DRY_RUN_ONLY!=='false',kimi_configured:!!(process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY),kimi_model:KIMI_MODEL,llm_provider:llm.activeProvider,llm_model:active?.model,llm_options:llm.options,stats:stats()})
}
