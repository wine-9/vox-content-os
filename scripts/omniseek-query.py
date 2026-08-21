#!/usr/bin/env python3
import asyncio
import json
import sys

from omniseek.server import omniseek_search

SOURCE_LABELS = {
    "tieba": "OmniSeek · 百度贴吧",
    "sogou_weixin": "OmniSeek · 微信公众号",
    "xiaohongshu_search": "OmniSeek · 小红书索引",
}


def signal_values(signals):
    out = {}
    for key, value in (signals or {}).items():
        raw = value.get("value") if isinstance(value, dict) else value
        if isinstance(raw, (int, float)):
            out[key] = raw
    return out


async def fetch_one(source, query, limit):
    try:
        result = await omniseek_search(
            query,
            sources=[source],
            raw=True,
            full=False,
            limit=limit,
            wait_s=10,
            semantic=False,
            staleness="cached_ok",
        )
        docs = []
        for d in result.get("documents", []):
            meta = d.get("metadata") or {}
            if meta.get("doc_type") == "forum":
                continue
            title = str(d.get("title") or "").strip()
            if not title or title in {"小红书", "Xiaohongshu"}:
                continue
            label = SOURCE_LABELS.get(source, f"OmniSeek · {source}")
            forum = str(meta.get("forum_name") or "").strip()
            if forum and source == "tieba":
                label += f" · {forum}吧"
            docs.append({
                "source": label,
                "sourceKey": source,
                "title": title,
                "url": d.get("url") or d.get("source_id"),
                "author": d.get("author") or meta.get("account") or (forum or None),
                "summary": str(d.get("content") or "").strip()[:900],
                "publishedAt": d.get("date"),
                "query": query,
                "engagement": signal_values(d.get("signals")),
            })
        return {"items": docs, "error": None}
    except Exception as exc:
        return {"items": [], "error": f"{source} {query}: {exc}"}


async def main():
    payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    queries = [str(x).strip() for x in payload.get("queries", []) if str(x).strip()][:6]
    sources = payload.get("sources") or ["tieba", "sogou_weixin"]
    limit = max(1, min(int(payload.get("limit", 4)), 8))
    tasks = [fetch_one(source, query, limit) for query in queries for source in sources]
    results = await asyncio.gather(*tasks) if tasks else []
    items, errors = [], []
    for result in results:
        items.extend(result["items"])
        if result["error"]:
            errors.append(result["error"])
    print(json.dumps({"items": items, "errors": errors}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
