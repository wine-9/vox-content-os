import { stats } from '../../../lib/db';
import { KIMI_MODEL } from '../../../lib/kimi';
export const runtime='nodejs';
export async function GET(){return Response.json({ok:true,service:'vox-content-os',dry_run_only:process.env.DRY_RUN_ONLY!=='false',kimi_configured:!!(process.env.KIMI_API_KEY||process.env.MOONSHOT_API_KEY),kimi_model:KIMI_MODEL,stats:stats()})}
