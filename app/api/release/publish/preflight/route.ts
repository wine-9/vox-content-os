import { checkSauAccount, checkWechatSyncAuth, localPublisherStatus } from '../../../../../lib/local-social-publish';
import { getReleaseItem } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  const item: any = id ? getReleaseItem(id) : null;
  if (!item?.master) return Response.json({ ok: false, error: 'release item/master missing' }, { status: 404 });

  // SAU account checks launch browsers. Run them serially to avoid local Chromium/Playwright contention.
  const xhs = await checkSauAccount('xiaohongshu');
  const dy = await checkSauAccount('douyin');
  const wx = await checkWechatSyncAuth();

  const title = String(item.master.title || '');
  const fullBody = String(item.master.body || '');
  const body = String(item.master.social_caption || fullBody);
  const titleChars = [...title].length;
  const bodyChars = [...body].length;
  const fullBodyChars = [...fullBody].length;
  const local = localPublisherStatus();
  const xhsLimits = { titleChars, bodyChars, titleOk: titleChars <= 20, bodyOk: bodyChars <= 1000 };
  const dyLimits = { titleChars, bodyChars, titleOk: titleChars <= 20, bodyOk: bodyChars <= 1000 };

  const adaptation = (platform: string) => item.adaptations?.find((a: any) => a.platform === platform);
  const xhsAdapt = adaptation('xiaohongshu');
  const dyAdapt = adaptation('douyin');
  const adaptationState = (a: any) => ({
    approved: a?.status === 'approved',
    revision: Number(a?.current_revision_no || 0),
    pages: Array.isArray(a?.files) ? a.files.length : 0,
    pagesOk: Array.isArray(a?.files) && a.files.length === 8,
    sourcePackageId: a?.source_package_id || null,
    sourceOk: !!a && a.source_package_id === item.master.id,
  });
  const xhsMaterial = adaptationState(xhsAdapt);
  const dyMaterial = adaptationState(dyAdapt);
  const sourceLock = xhsMaterial.sourceOk && dyMaterial.sourceOk;
  const pagesReady = xhsMaterial.pagesOk && dyMaterial.pagesOk;
  const materialReady = item.publish_state === 'ready_to_publish'
    && item.master.status === 'master_approved'
    && xhsMaterial.approved && dyMaterial.approved
    && sourceLock && pagesReady;
  const connectionsReady = !!wx.valid && !!xhs.valid && !!dy.valid;
  const copyCompatible = xhsLimits.titleOk && xhsLimits.bodyOk && dyLimits.titleOk && dyLimits.bodyOk;
  const preflightPassed = materialReady && connectionsReady && copyCompatible;

  return Response.json({
    ok: true,
    preflightPassed,
    materialReady,
    connectionsReady,
    copyCompatible,
    readyForLive: preflightPassed && !local.dryRun,
    dryRun: local.dryRun,
    wechat: wx,
    xiaohongshu: { valid: xhs.valid, error: xhs.valid ? undefined : xhs.output, ...xhsLimits, material: xhsMaterial },
    douyin: { valid: dy.valid, error: dy.valid ? undefined : dy.output, ...dyLimits, material: dyMaterial },
    content: {
      masterPackageId: item.master.id,
      masterStatus: item.master.status,
      publishState: item.publish_state,
      title,
      bodyChars,
      fullBodyChars,
      titleSource: 'item.master.title',
      bodySource: item.master.social_caption ? 'item.master.social_caption' : 'item.master.body',
      socialCaptionConfigured: !!item.master.social_caption,
      sourceLock,
      pagesReady,
    },
    account: local.account,
  });
}
