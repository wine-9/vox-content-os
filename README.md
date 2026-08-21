# VOX Content OS MVP

这是可以直接启动的第一版工程骨架。

## 本地启动

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开：
`http://localhost:3000`

当前页面：
- `/` Dashboard
- `/topics` 今日 Top 5
- `/editor` Candidate / Final 编辑界面
- `/learning` Skill 学习中心
- `/api/health`
- `/api/topics`

## 可选：启动 PostgreSQL + n8n

```bash
docker compose up -d
```

PostgreSQL: `localhost:5432`
n8n: `http://localhost:5678`

## 当前阶段

当前核心架构已经切换为 Blind Writer Loop：

1. Topic Research Adapter 通过 OpenCLI Browser Bridge 获取小红书 / 抖音真实热点，并合并行业 RSS。
2. 同一 Content Brief 进入三个独立 Writer：
   - Control：稳定基础 VOX Prompt，不读取任何 Skill。
   - Human Writing：执行 human-writing 的中文材料纪律与去模型腔规则。
   - Ultimate Fusion：执行 VOX 音乐写作 Skill；若存在人工批准的 VOX Learned Skill，只叠加在这一分支。
3. 三篇全部生成前不展示正文；缺失分支可单独补生成。
4. 三篇齐全后随机匿名成 A / B / C。盲选前 API 不返回 writer 身份。
5. 用户只选“最想继续改并最终发布”的 Winner，也可以选“三篇都不行”。
6. Reveal 后 Winner 才进入 Editor；Final 只与 Winner 做 Diff。
7. Blind Choice 单独训练 Writer Router；Winner→Final + `worth_learning` 才训练 VOX Style Skill。
8. 每 5 篇有效 Blind Winner→Final 样本生成 `blind-worth-N` Skill Proposal，必须人工批准后才能晋升。
9. `/publish` 把人工 Final 改编为小红书 / 抖音 / 公众号长图三个 Dry Run 发布包，支持人工修改和逐包审批。

2026-08-17 已完成 Blind Loop 的结构验收：盲选前无 writer_key 泄露，选择后身份揭晓，Winner→Final Diff 正常，临时测试数据已清理。Live 三稿生成当前受 AruHub 账户额度不足影响；Key 配置与模型路由本身正常。

默认 `DRY_RUN_ONLY=true`，当前没有自动发布。

## API balance & remote access

Dashboard now includes two operational layers:
- API account card: polls SiliconFlow `/v1/user/info` every 30 seconds and displays only balance/status fields; API keys and account identity are never returned to the browser.
- Access card: discovers the current private LAN URL and Tailscale IPv4 URL. The app continues to bind to `0.0.0.0:3000`.

SiliconFlow note: since 2026-03-26 unused bonus balance was migrated to platform coupons. The public `/v1/user/info` endpoint exposes monetary balance but not coupon balance, so a displayed monetary balance of `0` does not by itself prove inference is unavailable.

For remote access, prefer Tailscale instead of public router port forwarding. LAN access should only be used on trusted networks.


## Saved topics & source links

- Topic cards expose `保存选题` and `查看原文` actions.
- Saved topics use persistent `status='saved'`; research refresh only clears unsaved `proposed` topics.
- Saved items are shown in a dedicated section above the current Top 5.
- `source_url` is stored independently for new research; legacy topics fall back to extracting a URL from `source_summary`.
- API balance is shown globally in the top navigation and polls `/api/system/balance` every 30 seconds.

## Clean Writing Run Isolation

Every blind generation is content-isolated:
- The Writer API receives only the current `Content Brief` plus its fixed Writer Skill.
- Topic title, VOX angle, research source, previous Candidate, previous Final and previous Brief are not injected into the model request.
- Clicking `就写这个` always creates a new `content_item`, even for a previously used topic.
- A new Brief creates a new candidate set; an unfinished older set is abandoned rather than merged.
- Topic metadata shown in Editor is explicitly marked as reference-only and is not generation context.
- All writers are forbidden from fabricating first-person VOX/classroom/rehearsal/friend experiences unless the current Brief explicitly supplies them.
- Ultimate Fusion only applies arranging/song-breakdown structure when the current Brief explicitly asks for arranging or song analysis.

## Canonical Content → Visual Master → Release Workflow (2026-08-18)

The publishing path is sequential. Xiaohongshu and Douyin are no longer independent parallel copy packages.

`3 blind drafts -> Winner -> human Final -> WeChat copy -> WeChat HTML/images/cover visual master -> approve master -> Xiaohongshu/Douyin re-layout -> approve each adaptation -> ready_to_publish`

Rules:
- `/publish` is the **WeChat visual master** workspace. It creates/refines the long-form HTML and GC cover.
- `确认公众号母版 → 平台适配` finalizes the selected HTML if needed, requires a ready cover, locks the master, and redirects to `/release?id=...`.
- `/release` is the platform adaptation and release-prep workspace.
- WeChat and Xiaohongshu share one canonical manuscript and one locked content-image set. Xiaohongshu is only a 1080×1440 reflow; it is not a second copy version. Douyin uses the same content lock.
- Platform layout may change page breaks, positioning, typography, whitespace and image placement/size, but it may not shorten, paraphrase, omit, add, replace or regenerate article text/images. If content does not fit, add pages.
- A post-generation validator requires the exact title, every approved body paragraph in order, every locked content image, the shared Minimal Poster cover artwork and the VOX logo before an adaptation can become `ready`.
- Initial Xiaohongshu/Douyin layout is deterministic: the program parses the confirmed WeChat HTML into immutable text/image/SVG blocks and paginates those blocks into 1080×1440 pages. The model does not copy or rewrite the content.
- `ready` additionally requires the served page images to resolve successfully through the final browser URLs; broken images cannot pass the gate.
- Platform adaptations are asynchronous: the request queues quickly and the release page polls status while Codex works.
- An adaptation supports incremental revisions and uploaded reference images. Repeated generation without a new instruction is idempotent.
- Editing the confirmed WeChat HTML/cover invalidates old platform adaptations, preventing stale cards from being published against a newer master.
- `DRY_RUN_ONLY=true` remains the hard publishing guard; `ready_to_publish` does not auto-post externally.

### Cover invariant

- `gc-minimal-zine-poster-v0-1` / Minimal Zine Poster v0.1 is authoritative for cover artwork. It generates the vertical 3:5 Standard Mode poster.
- The 2350×1000 WeChat cover is only an HTML shell around that complete poster, the verbatim article title and the real VOX logo.
- Cover rendering uses immutable `/api/publish/generated-file` URLs for the newly created artwork/HTML instead of DB paths that are not committed yet. Artwork and logo must both return `image/*` before Chrome screenshots; invalid screenshots cannot enter `ready`.
- The generated-file proxy never rewrites site-absolute `/api/...` URLs. This prevents nested `adaptations/.../api/...` paths that previously caused broken images.

### Platform publishing

Asset approval and external publishing are separate. After Xiaohongshu/Douyin adaptations are approved, open `/release/publish?id=<contentId>`.

Optional server environment variables (names only):

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `DOUYIN_CLIENT_KEY`
- `DOUYIN_CLIENT_SECRET`
- `DOUYIN_REDIRECT_URI`

`DRY_RUN_ONLY=true` remains the safety default and hard-blocks WeChat remote writes. Douyin OAuth tokens are stored server-side in SQLite and are never returned by the status endpoint.
