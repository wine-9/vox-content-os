import { KIMI_BASE_URL } from '../../../../lib/kimi';
export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
  if (!key) return Response.json({ ok: false, error: 'KIMI_API_KEY_MISSING' }, { status: 503 });
  const base = KIMI_BASE_URL.replace(/\/+$/, '').replace(/\/v1$/i, '');
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30000),
    });
    const raw = await res.text();
    if (!res.ok) return Response.json({ ok: false, error: `KIMI_MODELS_${res.status}` }, { status: 502 });
    const data = JSON.parse(raw);
    const ids = (Array.isArray(data?.data) ? data.data : [])
      .map((x: any) => String(x?.id || ''))
      .filter((id: string) => /kimi/i.test(id))
      .sort();
    return Response.json({ ok: true, ids });
  } catch {
    return Response.json({ ok: false, error: 'KIMI_MODELS_FAILED' }, { status: 502 });
  }
}
